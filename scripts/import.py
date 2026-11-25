"""Імпорт вмісту зі старого WordPress-сайту госпіталю.

Запуск з кореня проєкту:
    python3 scripts/import.py              # сторінки, новини, лікарі, проєкти, файли
    python3 scripts/import.py --services   # те саме + платні послуги з оригіналу
    python3 scripts/import.py --no-media   # без завантаження фото й документів

Що робить:
- переносить сторінки (разом із ліниво завантаженими фото, відео YouTube і картами Google),
  усі новини з головними фото, профілі лікарів, команди відділень і проєкти реконструкції;
- переписує посилання на старий сайт на локальні адреси;
- завантажує фото й документи в media/wp-content/uploads/, щоб сайт не залежав від WordPress;
- перед записом зберігає резервну копію data/content.json.

Платні послуги без --services не змінюються, щоб не втратити правки з адмінпанелі.
Новини, створені в адмінпанелі (їх немає на старому сайті), зберігаються.
"""
import argparse, concurrent.futures, html as htmlstd, json, re, shutil, sys, time, urllib.request
from datetime import datetime
from pathlib import Path
from urllib.parse import quote, unquote, urljoin, urlparse
from lxml import html

SITE = 'https://hospital-veterans.lviv.ua'
HOST = 'hospital-veterans.lviv.ua'
ROOT = Path(__file__).resolve().parent.parent
DATA = ROOT / 'data' / 'content.json'
MEDIA = ROOT / 'media'
UA = {'User-Agent': 'Mozilla/5.0 (hospital site migration)'}
IFRAME_HOSTS = ('www.youtube.com', 'youtube.com', 'www.youtube-nocookie.com', 'www.google.com', 'google.com')
MEDIA_EXT = re.compile(r'\.(jpe?g|png|webp|gif|svg|pdf|docx?|xlsx?|pptx?|zip|rar|mp4)$', re.I)


def get(url, binary=False, tries=3):
    for attempt in range(tries):
        try:
            with urllib.request.urlopen(urllib.request.Request(url, headers=UA), timeout=40) as r:
                data = r.read()
                return data if binary else data.decode('utf-8')
        except Exception as e:
            if attempt == tries - 1:
                raise RuntimeError(f'{url}: {e}') from e
            time.sleep(1.5 * (attempt + 1))


def get_json_pages(endpoint):
    out, page = [], 1
    while True:
        sep = '&' if '?' in endpoint else '?'
        batch = json.loads(get(f'{SITE}/wp-json/wp/v2/{endpoint}{sep}per_page=100&page={page}'))
        out += batch
        if len(batch) < 100:
            return out
        page += 1


def pmap(fn, items, workers=6):
    with concurrent.futures.ThreadPoolExecutor(max_workers=workers) as ex:
        return list(ex.map(fn, items))


def text(s):
    return re.sub(r'\s+', ' ', htmlstd.unescape(re.sub(r'<[^>]+>', ' ', s or '')).replace('\xa0', ' ')).strip()


def norm_url(u):
    """Абсолютна адреса старого сайту без фрагмента й кінцевої скісної риски, розкодована."""
    u = urljoin(SITE + '/', u.strip())
    p = urlparse(u)
    return unquote(f'{p.scheme}://{p.netloc}{p.path}').rstrip('/').lower() + (('?' + p.query) if p.query else '')


def is_old_site(u):
    return urlparse(urljoin(SITE + '/', u)).netloc in (HOST, 'www.' + HOST)


def real_src(el, attr='src'):
    """LiteSpeed підміняє адресу заглушкою, а справжню кладе в data-*."""
    src = el.get(attr) or ''
    if not src or src.startswith('data:') or src == 'about:blank':
        for key in ('data-litespeed-src', 'data-src', 'data-lazy-src', 'data-lazyload'):
            if el.get(key):
                return el.get(key)
        return ''
    return src


def clean(markup):
    """Очищає HTML і повертає його разом зі списком знайдених адрес."""
    try:
        root = html.fragment_fromstring(markup, create_parent='div')
    except Exception:
        return ''
    for el in root.xpath('.//script|.//style|.//form|.//button|.//noscript|.//input|.//select'):
        el.drop_tree()
    for el in root.xpath('.//iframe'):
        src = real_src(el)
        host = urlparse(src).netloc
        ok = host in IFRAME_HOSTS and ('/embed' in src or '/maps/embed' in src)
        if not ok:
            el.drop_tree()
            continue
        title = el.get('title') or ('Карта' if 'maps' in src else 'Відео')
        el.attrib.clear()
        el.set('src', src.replace('http://', 'https://'))
        el.set('title', title)
        el.set('loading', 'lazy')
        el.set('allowfullscreen', '')
        el.set('referrerpolicy', 'strict-origin-when-cross-origin')
    for el in list(root.iter()):
        if not isinstance(el.tag, str):
            continue
        if el.tag == 'img':
            src = real_src(el)
            if src:
                el.set('src', src)
        if el.tag == 'iframe':
            continue
        for key in list(el.attrib):
            if key not in ('href', 'src', 'alt', 'colspan', 'rowspan'):
                del el.attrib[key]
        for key in ('href', 'src'):
            val = (el.get(key) or '').strip()
            if val.startswith('//'):
                el.set(key, 'https:' + val)
            elif val.lower().startswith(('javascript:', 'data:')):
                del el.attrib[key]
        if el.tag == 'img' and not el.get('src'):
            el.drop_tree()
    return ''.join(html.tostring(e, encoding='unicode', method='html') for e in root)


def content_node(page_html):
    tree = html.fromstring(page_html)
    nodes = tree.xpath('//*[@id="content"]')
    return tree, (nodes[0] if nodes else None)


# ---------------------------------------------------------------- сторінки й новини

def fetch_page(p):
    title = htmlstd.unescape(re.sub('<[^>]+>', '', p['title']['rendered']))
    item = {'id': str(p['id']), 'slug': p['slug'], 'title': title, 'source': p['link']}
    try:
        tree, node = content_node(get(p['link']))
        body = clean(html.tostring(node, encoding='unicode')) if node is not None else clean(p['content']['rendered'])
        if p['slug'] in ('platni-poslugy', 'platni-poslugy-kardioczentr') and node is not None:
            item['intro'] = next((text(html.tostring(x, encoding='unicode')) for x in node.xpath('.//p')
                                  if len(text(html.tostring(x, encoding='unicode'))) > 80), '')
            item['_node'] = node
    except Exception as e:
        print('  ! сторінка', p['link'], e)
        body = clean(re.sub(r'\[[^\]]+\]', '', p['content']['rendered']))
    item['content'] = body
    return item


def post_item(p):
    media = (p.get('_embedded', {}).get('wp:featuredmedia') or [{}])[0]
    return {'id': str(p['id']), 'slug': p['slug'], 'title': text(p['title']['rendered']),
            'date': p['date'][:10], 'excerpt': text(p['excerpt']['rendered']),
            'image': media.get('source_url', '') if isinstance(media, dict) else '',
            'content': clean(p['content']['rendered']), 'source': p['link']}


# ---------------------------------------------------------------- платні послуги

def services_from(page, department, idgen):
    node = page.pop('_node', None)
    if node is None:
        return []
    tables = node.xpath('.//table')
    heads = [text(html.tostring(h, encoding='unicode'))
             for h in node.xpath('.//h1|.//h2|.//h3|.//h4|.//*[contains(@class,"title")]')][:len(tables)]
    out = []
    for category, table in zip(heads, tables):
        group = ''
        for tr in table.xpath('.//tr'):
            cells = [text(html.tostring(td, encoding='unicode')) for td in tr.xpath('./td|./th')]
            if len(cells) > 2:
                cells = [c for c in cells if c]
            if not cells or cells[0].lower().startswith('послуга'):
                continue
            if len(cells) == 1 or not cells[1]:
                group = cells[0]
                continue
            out.append({'id': idgen(), 'department': department, 'category': category,
                        'group': group, 'name': cells[0], 'price': cells[1]})
    return out


# ---------------------------------------------------------------- лікарі, команди, проєкти

def team_groups():
    tree = html.fromstring(get(SITE + '/'))
    sel = tree.xpath('//form[contains(@class,"team-search-form")]//select[@name="team_group"]')
    groups = []
    for o in (sel[0].xpath('.//option') if sel else []):
        if o.get('value'):
            groups.append({'slug': unquote(o.get('value')), 'title': o.text_content().strip(),
                           'source': f"{SITE}/team-group/{o.get('value')}/"})
    return groups


def doctor_urls(extra):
    first = html.fromstring(get(f'{SITE}/?teamsearch=1&post_type=team_member&s=&team_group='))
    nums = [int(n) for n in re.findall(r'/page/(\d+)/', ' '.join(a.get('href', '') for a in first.xpath('//a')))]
    pages = [first] + pmap(lambda n: html.fromstring(get(f'{SITE}/page/{n}/?teamsearch=1&post_type=team_member&s=&team_group=')),
                           range(2, max(nums or [1]) + 1))
    urls = {}
    for t in pages:
        for a in t.xpath('//*[@id="content"]//a[contains(@href,"/team-members/")]'):
            urls[norm_url(a.get('href'))] = a.get('href')
    for u in extra:
        urls.setdefault(norm_url(u), u)
    return list(urls.values())


def fetch_doctor(url):
    try:
        tree, node = content_node(get(url))
    except Exception as e:
        print('  ! профіль', url, e)
        return None
    if node is None:
        return None
    name_el = node.xpath('.//*[contains(@class,"thememount-team-title-block")]//h2')
    if name_el:
        for br in name_el[0].xpath('.//br'):
            br.tail = ' ' + (br.tail or '')
    name = text(html.tostring(name_el[0], encoding='unicode')) if name_el else text(tree.findtext('.//title') or '').split(' - ')[0]
    pos = node.xpath('.//*[contains(@class,"thememount-team-position")]')
    groups = [{'slug': unquote(urlparse(a.get('href')).path.strip('/').split('/')[-1]), 'title': a.text_content().strip()}
              for a in node.xpath('.//*[contains(@class,"thememount-team-cat-links")]//a[@href]')]
    img = node.xpath('.//*[contains(@class,"thememount-team-img")]//img')
    photo = real_src(img[0]) if img else ''
    for left in node.xpath('.//*[contains(@class,"single-team-left")]'):
        left.drop_tree()
    slug = unquote(urlparse(url).path.strip('/').split('/')[-1])
    return {'id': 'doctor-' + slug, 'slug': slug, 'name': name,
            'position': text(html.tostring(pos[0], encoding='unicode')) if pos else '',
            'groups': groups, 'photo': photo, 'content': clean(html.tostring(node, encoding='unicode')), 'source': url}


def fetch_project(url):
    try:
        tree, node = content_node(get(url))
    except Exception as e:
        print('  ! проєкт', url, e)
        return None
    h1 = tree.xpath('//h1')
    og = tree.xpath('//meta[@property="og:image"]/@content')
    slug = unquote(urlparse(url).path.strip('/').split('/')[-1])
    return {'id': 'project-' + slug, 'slug': slug,
            'title': text(html.tostring(h1[0], encoding='unicode')) if h1 else text(tree.findtext('.//title') or '').split(' - ')[0],
            'image': og[0] if og else '', 'content': clean(html.tostring(node, encoding='unicode')) if node is not None else '',
            'source': url}


# ---------------------------------------------------------------- посилання й файли

class Relinker:
    def __init__(self):
        self.routes, self.media, self.unresolved = {}, {}, {}

    def add(self, source, route):
        self.routes[norm_url(source)] = route

    def local_media(self, url):
        absu = urljoin(SITE + '/', url.strip())
        path = unquote(urlparse(absu).path)
        if not path.startswith('/wp-content/uploads/') or '..' in path:
            return None
        self.media[path] = absu.split('#')[0].split('?')[0]
        return quote(path, safe="/-_.~()'!*")

    LOCAL = ('/page/', '/news', '/team-members/', '/team-group/', '/project/', '/likari')

    def url(self, u, kind='href'):
        if not u or not is_old_site(u) or u.startswith(self.LOCAL):
            return u
        absu = urljoin(SITE + '/', u.strip())
        path = unquote(urlparse(absu).path)
        if path.startswith('/wp-content/uploads/') and (kind == 'src' or MEDIA_EXT.search(path)):
            return self.local_media(absu) or u
        key = norm_url(absu)
        frag = ('#' + urlparse(absu).fragment) if urlparse(absu).fragment else ''
        if key in self.routes:
            return self.routes[key] + frag
        if path.strip('/') == '':
            return '/' + frag
        if re.fullmatch(r'/novyny(/page/\d+)?/?', path):
            return '/news'
        if '?' in key and 'teamsearch' in key:
            return u
        self.unresolved[key] = self.unresolved.get(key, 0) + 1
        return u

    def html(self, markup):
        if not markup:
            return markup
        root = html.fragment_fromstring(markup, create_parent='div')
        for el in root.xpath('.//*[@href]'):
            el.set('href', self.url(el.get('href')))
        for el in root.xpath('.//img[@src]'):
            el.set('src', self.url(el.get('src'), 'src'))
        return ''.join(html.tostring(e, encoding='unicode', method='html') for e in root)


def download(items, workers=8):
    def one(pair):
        path, url = pair
        target = MEDIA / path.lstrip('/')
        if target.exists() and target.stat().st_size > 0:
            return 'є', 0
        try:
            data = get(quote(url, safe=':/%?=&-_.~()\'!*'), binary=True)
        except Exception as e:
            return 'помилка: ' + str(e)[:120], 0
        target.parent.mkdir(parents=True, exist_ok=True)
        tmp = target.with_suffix(target.suffix + '.part')
        tmp.write_bytes(data)
        tmp.replace(target)
        return 'ok', len(data)
    results = pmap(one, sorted(items.items()), workers)
    errors = [(p, r[0]) for p, r in zip(sorted(items), results) if r[0].startswith('помилка')]
    return sum(1 for r in results if r[0] == 'ok'), sum(r[1] for r in results), errors


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--services', action='store_true', help='перезаписати платні послуги даними з оригіналу')
    ap.add_argument('--no-media', action='store_true', help='не завантажувати фото й документи')
    args = ap.parse_args()

    old = json.loads(DATA.read_text('utf-8')) if DATA.exists() else {}
    print('1/6 Сторінки…')
    pages = pmap(fetch_page, get_json_pages('pages?_fields=id,slug,title,link,content'))
    print(f'    {len(pages)} сторінок')
    print('2/6 Новини…')
    posts = [post_item(p) for p in get_json_pages('posts?_embed=wp:featuredmedia')]
    known = {p['id'] for p in posts}
    own = [p for p in old.get('posts', []) if p['id'] not in known and not str(p['id']).isdigit()]
    posts = sorted(posts + own, key=lambda p: p.get('date', ''), reverse=True)
    print(f'    {len(posts)} новин (з них створено в адмінпанелі: {len(own)})')

    print('3/6 Лікарі, команди відділень і проєкти…')
    linked = set()
    for x in pages + posts:
        for h in re.findall(r'href="([^"]+)"', x['content']):
            if is_old_site(h):
                linked.add(h)
    groups = team_groups()
    doctors = [d for d in pmap(fetch_doctor, doctor_urls([h for h in linked if '/team-members/' in h])) if d]
    doctors.sort(key=lambda d: d['name'])
    for d in doctors:
        for g in d['groups']:
            if g['slug'] not in {x['slug'] for x in groups}:
                groups.append({'slug': g['slug'], 'title': g['title'], 'source': f"{SITE}/team-group/{quote(g['slug'])}/"})
    project_links = {norm_url(h): h for h in linked if '/portfolio/' in h}
    for h in re.findall(r'https://hospital-veterans\.lviv\.ua/portfolio/[^"\'\s<>]+', get(SITE + '/')):
        project_links.setdefault(norm_url(h), h)
    # Проєкти посилаються один на одного, тому шукаємо нові посилання, поки вони з'являються.
    projects, done = [], set()
    while set(project_links) - done:
        batch = [project_links[k] for k in sorted(set(project_links) - done)]
        done |= set(project_links)
        for pr in pmap(fetch_project, batch):
            if not pr:
                continue
            projects.append(pr)
            for h in re.findall(r'href="([^"]+)"', pr['content']):
                if is_old_site(h) and '/portfolio/' in h:
                    project_links.setdefault(norm_url(h), h)
    for d in doctors:
        for h in re.findall(r'href="([^"]+)"', d['content']):
            if is_old_site(h) and '/portfolio/' in h and norm_url(h) not in done:
                pr = fetch_project(h)
                if pr:
                    projects.append(pr); done.add(norm_url(h))
    print(f'    лікарів: {len(doctors)}, команд: {len(groups)}, проєктів: {len(projects)}')

    print('4/6 Платні послуги…')
    counter = iter(range(1, 10**6))
    idgen = lambda: f'service-{next(counter)}'
    fresh = []
    for p in pages:
        if p['slug'] == 'platni-poslugy':
            fresh += services_from(p, 'Госпіталь', idgen)
        elif p['slug'] == 'platni-poslugy-kardioczentr':
            fresh += services_from(p, 'Кардіоцентр', idgen)
        else:
            p.pop('_node', None)
    if args.services or not old.get('services'):
        services = fresh
        print(f'    перенесено з оригіналу: {len(services)}')
    else:
        services = old['services']
        print(f'    залишено поточні ({len(services)}). Щоб оновити з оригіналу, запустіть з --services')

    print('5/6 Посилання…')
    rl = Relinker()
    for p in pages:
        rl.add(p['source'], '/news' if p['slug'] == 'novyny' else '/' if p['slug'] == 'front-page' else '/page/' + quote(p['slug'], safe=''))
    for p in posts:
        if p.get('source'):
            rl.add(p['source'], '/news/' + quote(p['slug'], safe=''))
    for d in doctors:
        rl.add(d['source'], '/team-members/' + quote(d['slug'], safe=''))
    for g in groups:
        rl.add(g['source'], '/team-group/' + quote(g['slug'], safe=''))
    for p in projects:
        rl.add(p['source'], '/project/' + quote(p['slug'], safe=''))
    for coll in (pages, posts, doctors, projects):
        for x in coll:
            x['content'] = rl.html(x['content'])
    for x in posts + projects:
        if x.get('image') and is_old_site(x['image']):
            x['image'] = rl.url(x['image'], 'src')
    for d in doctors:
        if d['photo'] and is_old_site(d['photo']):
            d['photo'] = rl.url(d['photo'], 'src')
    for f in list((ROOT / 'src').glob('*.js')) + list((ROOT / 'src').glob('*.jsx')) + list((ROOT / 'src').glob('*.css')):
        for m in re.findall(r'(?:https://hospital-veterans\.lviv\.ua)?/wp-content/uploads/[^\s\'"`)]+', f.read_text('utf-8')):
            rl.local_media(m)
        for m in re.findall(r"['\"](\d{4}/\d{2}/[^'\"\s]+\.(?:jpe?g|png|webp|gif))['\"]", f.read_text('utf-8')):
            rl.local_media('/wp-content/uploads/' + m)
    # Сторінки окремих фото з галерей WordPress (attachment) замінюємо посиланням на сам файл.
    def attachment_file(url):
        try:
            with urllib.request.urlopen(urllib.request.Request(url + '/', headers=UA, method='HEAD'), timeout=40) as r:
                final = r.geturl()
            if '/wp-content/uploads/' in final and is_old_site(final):
                return final
            tree = html.fromstring(get(url))
        except Exception:
            return None
        if 'attachment' not in (tree.xpath('//body/@class') or [''])[0]:
            return None
        img = tree.xpath('//*[contains(@class,"attachment")]//img') or tree.xpath('//*[@id="content"]//img')
        src = real_src(img[0]) if img else ''
        return src if src and is_old_site(src) else None
    pending = list(rl.unresolved)
    found = dict(zip(pending, pmap(attachment_file, pending)))
    if any(found.values()):
        for k, src in found.items():
            if src:
                rl.add(k, rl.local_media(src))
                rl.unresolved.pop(k, None)
        rl.unresolved = {}
        for coll in (pages, posts, doctors, projects):
            for x in coll:
                x['content'] = rl.html(x['content'])
    if rl.unresolved:
        print(f'    посилань на старий сайт без локальної сторінки: {len(rl.unresolved)}')
        for k, n in sorted(rl.unresolved.items(), key=lambda x: -x[1])[:15]:
            print('      ', n, k)

    print('6/6 Файли…')
    if args.no_media:
        print(f'    пропущено ({len(rl.media)} файлів)')
    else:
        n, size, errors = download(rl.media)
        print(f'    усього файлів: {len(rl.media)}, завантажено нових: {n} ({size / 1048576:.1f} МБ)')
        for p, e in errors:
            print('    ! не вдалося:', p, e)

    if DATA.exists():
        backup = DATA.with_name(f'content.backup-{datetime.now():%Y%m%d-%H%M%S}.json')
        shutil.copy2(DATA, backup)
        print('Резервна копія:', backup.relative_to(ROOT))
    out = {'pages': pages, 'posts': posts, 'services': services, 'doctors': doctors,
           'teams': sorted(groups, key=lambda g: g['title'].lstrip('T')), 'projects': projects}
    tmp = DATA.with_suffix('.json.tmp')
    tmp.write_text(json.dumps(out, ensure_ascii=False, indent=2), 'utf-8')
    tmp.replace(DATA)
    bad = DATA.read_text('utf-8').count('�')
    print(f'Готово: {DATA.relative_to(ROOT)}' + (f' (увага: битих символів {bad})' if bad else ', битих символів немає'))


if __name__ == '__main__':
    sys.exit(main())
