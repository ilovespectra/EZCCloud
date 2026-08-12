const { spawn } = require('child_process');

function start(command, args) {
  const child = spawn(command, args, {
    stdio: 'inherit',
    shell: true
  });

  child.on('exit', (code) => {
    process.exit(code ?? 0);
  });

  return child;
}

const port = process.env.PORT || '3000';
const vite = start('npx', ['vite', '--host', '127.0.0.1', '--port', port]);

setTimeout(() => {
  start('npx', ['electron', '.']);
}, 1500);

process.on('SIGINT', () => {
  vite.kill();
  process.exit(0);
});
