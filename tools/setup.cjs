const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const crypto = require('node:crypto');
const { spawn } = require('node:child_process');

function run(command, args, cwd, output = 'inherit') {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, windowsHide: true, stdio: output });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0
        ? resolve()
        : reject(Error(`No se completó ${path.basename(command)} (código ${code}).`))
    );
  });
}

async function ensureDependencies(root) {
  const major = Number(process.versions.node.split('.')[0]);
  if (major < 22)
    throw Error(
      'Instala Node.js 22 o superior desde https://nodejs.org y vuelve a abrir InventIC.'
    );
  if (fs.existsSync(path.join(root, 'node_modules/mysql2/package.json'))) return;
  console.log('Primera instalación: descargando las dependencias de InventIC…');
  const cli = path.join(path.dirname(process.execPath), 'node_modules/npm/bin/npm-cli.js');
  if (fs.existsSync(cli)) {
    await run(process.execPath, [cli, 'ci', '--omit=dev', '--no-audit', '--no-fund'], root);
  } else if (process.platform === 'win32') {
    await run('cmd.exe', ['/d', '/s', '/c', 'npm ci --omit=dev --no-audit --no-fund'], root);
  } else {
    await run('npm', ['ci', '--omit=dev', '--no-audit', '--no-fund'], root);
  }
}

function findMysql() {
  const name = process.platform === 'win32' ? 'mysqld.exe' : 'mysqld';
  const candidates = [process.env.MYSQL_BIN];
  for (const directory of (process.env.PATH || '').split(path.delimiter))
    candidates.push(path.join(directory, name));
  const drive = process.env.SystemDrive || 'C:';
  const folders = [
    drive + '/wamp64/bin/mysql',
    drive + '/wamp/bin/mysql',
    path.join(process.env.ProgramFiles || drive + '/Program Files', 'MySQL')
  ];
  for (const folder of folders) {
    if (!fs.existsSync(folder)) continue;
    const versions = fs
      .readdirSync(folder)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true }));
    for (const version of versions) candidates.push(path.join(folder, version, 'bin', name));
  }
  const executable = candidates.find(
    (file) => file && fs.existsSync(file) && fs.statSync(file).isFile()
  );
  if (!executable)
    throw Error(
      'No se encontró MySQL. Instala MySQL 8 o WAMP, indica MYSQL_BIN, o utiliza Iniciar con Docker.cmd. Consulta README.md.'
    );
  return path.resolve(executable);
}

function portOpen(port, host = '127.0.0.1') {
  return new Promise((resolve) => {
    const socket = net.connect({ port, host });
    socket.setTimeout(2000);
    const finish = (open) => {
      socket.destroy();
      resolve(open);
    };
    socket.once('connect', () => finish(true));
    socket.once('error', () => finish(false));
    socket.once('timeout', () => finish(false));
  });
}

async function freePort(preferred) {
  for (let port = preferred; port < preferred + 100; port++) {
    const available = await new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', () => resolve(false));
      server.listen(port, '127.0.0.1', () => server.close(() => resolve(true)));
    });
    if (available) return port;
  }
  throw Error('No hay un puerto libre para iniciar InventIC.');
}

function launchMysql(root, executable, port) {
  fs.mkdirSync(path.join(root, '.runtime'), { recursive: true });
  const output = fs.openSync(path.join(root, '.runtime/mysql.log'), 'a');
  const child = spawn(
    executable,
    [
      '--no-defaults',
      '--basedir=' + path.dirname(path.dirname(executable)),
      '--datadir=' + path.join(root, 'mysql-data'),
      '--port=' + port,
      '--bind-address=127.0.0.1',
      '--mysqlx=0',
      '--console'
    ],
    { detached: true, windowsHide: true, stdio: ['ignore', output, output] }
  );
  fs.closeSync(output);
  child.on('error', (error) => console.error('No se pudo iniciar MySQL: ' + error.message));
  child.unref();
  return child;
}

async function waitForMysql(port) {
  for (let attempt = 0; attempt < 60; attempt++) {
    if (await portOpen(port)) return;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  throw Error('MySQL no pudo iniciar. Revisa .runtime/mysql.log.');
}

async function checkDataDirectory(connection, root) {
  const [rows] = await connection.query('SELECT @@datadir AS directory');
  const normalize = (directory) =>
    path.resolve(directory).replaceAll('\\', '/').replace(/\/$/, '').toLowerCase();
  if (normalize(rows[0].directory) !== normalize(path.join(root, 'mysql-data'))) {
    await connection.end();
    throw Error(
      'El puerto de instalación pertenece a otra instancia MySQL. No se modificó ese servidor.'
    );
  }
}

async function setup(root) {
  const executable = findMysql();
  const stateFile = path.join(root, '.runtime/setup.json');
  let state;
  if (fs.existsSync(stateFile)) {
    state = JSON.parse(fs.readFileSync(stateFile, 'utf8'));
  } else {
    const dataDirectory = path.join(root, 'mysql-data');
    if (fs.existsSync(dataDirectory) && fs.readdirSync(dataDirectory).length) {
      throw Error(
        'Hay una base local existente, pero falta .env. Recupera su configuración; no se reemplazarán tus datos.'
      );
    }
    state = {
      port: await freePort(Number(process.env.INVENTIC_MYSQL_PORT || 3307)),
      appPort: await freePort(Number(process.env.INVENTIC_APP_PORT || 3000)),
      rootPassword: crypto.randomBytes(24).toString('hex'),
      appPassword: crypto.randomBytes(24).toString('hex'),
      initialized: false
    };
    fs.mkdirSync(path.dirname(stateFile), { recursive: true });
    fs.writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
  }
  if (!state.initialized) {
    console.log('Creando una instancia MySQL privada para esta copia del proyecto…');
    await run(
      executable,
      [
        '--no-defaults',
        '--initialize-insecure',
        '--basedir=' + path.dirname(path.dirname(executable)),
        '--datadir=' + path.join(root, 'mysql-data')
      ],
      root
    );
    state.initialized = true;
    fs.writeFileSync(stateFile, JSON.stringify(state), { mode: 0o600 });
  }
  if (!(await portOpen(state.port))) launchMysql(root, executable, state.port);
  await waitForMysql(state.port);
  const mysql = require('mysql2/promise');
  const options = { host: '127.0.0.1', port: state.port, user: 'root' };
  let connection;
  try {
    connection = await mysql.createConnection({ ...options, password: state.rootPassword });
  } catch (error) {
    if (error.code !== 'ER_ACCESS_DENIED_ERROR') throw error;
    connection = await mysql.createConnection({ ...options, password: '' });
    await checkDataDirectory(connection, root);
    await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [state.rootPassword]);
  }
  try {
    await checkDataDirectory(connection, root);
    const [databases] = await connection.query("SHOW DATABASES LIKE 'inventic_html'");
    if (!databases.length)
      await require('./install-database.cjs').install(connection, 'inventic_html');
    // Una instalación incompleta se informa; nunca se borra ni se reinicializa una base existente.
    await connection.query('SELECT revision FROM inventic_html.app_metadata WHERE id = 1');
    await connection.query("CREATE USER IF NOT EXISTS 'inventic_app'@'127.0.0.1' IDENTIFIED BY ?", [
      state.appPassword
    ]);
    await connection.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON inventic_html.* TO 'inventic_app'@'127.0.0.1'"
    );
    fs.writeFileSync(
      path.join(root, '.runtime/mysql-admin.json'),
      JSON.stringify({ password: state.rootPassword }),
      { mode: 0o600 }
    );
    fs.writeFileSync(
      path.join(root, '.env'),
      `DB_HOST=127.0.0.1\nDB_PORT=${state.port}\nDB_NAME=inventic_html\nDB_USER=inventic_app\nDB_PASS=${state.appPassword}\nPORT=${state.appPort}\nMYSQL_BIN="${executable.replaceAll('\\', '/')}"\n`,
      { flag: 'wx', mode: 0o600 }
    );
    console.log('Instalación terminada. Crea tu cuenta administradora en el primer acceso.');
  } finally {
    await connection.end();
  }
}

module.exports = { ensureDependencies, findMysql, portOpen, launchMysql, waitForMysql, setup };
