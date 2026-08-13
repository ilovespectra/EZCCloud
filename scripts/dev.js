const { spawn, execSync } = require('child_process');

let vite = null;
let electron = null;

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

function killPortProcess(port) {
  try {
    console.log(`Checking if port ${port} is in use...`);
    
    let output;
    try {
      output = execSync(`lsof -i :${port} -t`, { encoding: 'utf-8', stdio: ['pipe', 'pipe', 'pipe'] }).trim();
    } catch (e) {
      return;
    }
    
    if (output) {
      const pids = output.split('\n').filter(p => p.trim());
      for (const pid of pids) {
        if (pid) {
          console.log(`Killing process ${pid} on port ${port}`);
          try {
            execSync(`kill -9 ${pid}`, { stdio: 'pipe' });
            console.log(`Successfully killed process ${pid}`);
          } catch (e) {
            console.log(`Failed to kill ${pid}`);
          }
        }
      }
    }
  } catch (err) {
    console.log(`Could not check port ${port}`);
  }
}

function cleanup() {
  if (vite) vite.kill();
  if (electron) electron.kill();
  process.exit(0);
}

process.on('SIGINT', cleanup);
process.on('SIGTERM', cleanup);

const port = process.env.PORT || '3000';
killPortProcess(port);

// Add a small delay to ensure the port is released
setTimeout(() => {
  console.log('Starting Vite dev server...');
  vite = start('npx', ['vite', '--host', '127.0.0.1', '--port', port]);

  setTimeout(() => {
    console.log('Starting Electron...');
    electron = start('npx', ['electron', '.']);
  }, 1500);
}, 500);
