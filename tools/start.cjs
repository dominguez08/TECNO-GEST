const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const root = path.resolve(__dirname, '..');

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect(port, '127.0.0.1');
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('error', () => resolve(false));
  });
}

async function start() {
  if (!(await portOpen(3307))) {
    const executable = process.env.MYSQL_BIN || 'C:/wamp64/bin/mysql/mysql8.0.31/bin/mysqld.exe';
    if (!fs.existsSync(executable))
      throw Error('No se encontró MySQL. Configura MYSQL_BIN con la ubicación de mysqld.exe.');
    fs.mkdirSync(path.join(root, '.runtime'), { recursive: true });
    const output = fs.openSync(path.join(root, '.runtime/mysql.log'), 'a');
    const child = spawn(
      executable,
      [
        '--no-defaults',
        '--basedir=' + path.dirname(path.dirname(executable)),
        '--datadir=' + path.join(root, 'mysql-data'),
        '--port=3307',
        '--bind-address=127.0.0.1',
        '--mysqlx=0',
        '--console'
      ],
      { detached: true, windowsHide: true, stdio: ['ignore', output, output] }
    );
    child.on('error', (error) => console.error(error.message));
    child.unref();
    for (let i = 0; i < 30 && !(await portOpen(3307)); i++)
      await new Promise((resolve) => setTimeout(resolve, 1000));
    if (!(await portOpen(3307))) throw Error('MySQL no pudo iniciar. Revisa .runtime/mysql.log.');
  }

  if (process.argv.includes('--database-only')) return;
  if (await portOpen(3000)) {
    console.log('InventIC ya está disponible en http://localhost:3000');
    return;
  }
  const child = spawn(process.execPath, [path.join(root, 'server/index.cjs')], {
    cwd: root,
    windowsHide: true,
    stdio: 'inherit'
  });
  child.on('exit', (code) => {
    process.exitCode = code || 0;
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
