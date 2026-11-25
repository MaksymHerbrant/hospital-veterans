import bcrypt from 'bcryptjs';
import { readFile, writeFile, rename, mkdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import readline from 'node:readline';

const usersPath = resolve('data/users.json');

function ask(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(res => rl.question(question, ans => { rl.close(); res(ans); }));
}

const login = (process.argv[2] || await ask('Логін (наприклад, admin): ') || 'admin').trim();
const p1 = (process.argv[3] || await ask('Пароль (мін. 8 символів): ')).trim();
if (p1.length < 4) {
  console.error('Помилка: пароль закороткий.');
  process.exit(1);
}

let users = [];
try { users = JSON.parse(await readFile(usersPath, 'utf8')); } catch {}
if (!Array.isArray(users)) users = [];

const hash = bcrypt.hashSync(p1, 12);
const now = new Date().toISOString();
const idx = users.findIndex(u => u.login === login);
if (idx >= 0) {
  users[idx] = { ...users[idx], hash, mustChangePassword: false, active: true, updatedAt: now };
} else {
  users.push({ login, role: 'superadmin', hash, mustChangePassword: false, active: true, createdAt: now, updatedAt: now });
}

await mkdir(dirname(usersPath), { recursive: true });
const tmp = usersPath + '.tmp';
await writeFile(tmp, JSON.stringify(users, null, 2), 'utf8');
await rename(tmp, usersPath);
console.log(`Користувача «${login}» збережено (bcrypt-хеш у data/users.json).`);
