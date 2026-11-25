import { spawn } from 'node:child_process';

const children = [
  spawn(process.execPath, ['server.js'], { stdio: 'inherit', env: process.env }),
  spawn(process.execPath, ['node_modules/vite/bin/vite.js', '--host', '0.0.0.0'], { stdio: 'inherit', env: process.env }),
];
let stopping = false;
function stop(code = 0) {
  if (stopping) return;
  stopping = true;
  for (const child of children) if (!child.killed) child.kill('SIGTERM');
  process.exitCode = code;
}
for (const child of children) {
  child.on('error', error => { console.error('Не вдалося запустити сервер:', error.message); stop(1); });
  child.on('exit', (code, signal) => { if (!stopping) stop(code || (signal ? 1 : 0)); });
}
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
if (!process.env.ADMIN_PASSWORD || process.env.ADMIN_PASSWORD.length < 12) {
  console.log('Для входу в адмінпанель перед запуском задайте ADMIN_PASSWORD (щонайменше 12 символів).');
}
