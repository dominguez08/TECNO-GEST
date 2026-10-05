const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');

const root = path.resolve(__dirname, '..');
const copy = path.join(root, 'test-results', 'first-run-' + Date.now());
fs.mkdirSync(copy, { recursive: true });
// Reproduce un ZIP de GitHub: no copia .env, node_modules ni archivos de MySQL.
for (const file of [
  'package.json',
  'package-lock.json',
  'database.sql',
  'index.html',
  'assets',
  'auth',
  'modules',
  'server',
  'tools'
]) {
  fs.cpSync(path.join(root, file), path.join(copy, file), { recursive: true });
}
const env = {
  ...process.env,
  npm_config_offline: 'true',
  INVENTIC_MYSQL_PORT: '33470',
  INVENTIC_APP_PORT: '33480'
};
for (const key of ['DB_HOST', 'DB_PORT', 'DB_USER', 'DB_PASS', 'DB_NAME', 'PORT']) delete env[key];

function prepare() {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, ['tools/start.cjs', '--database-only'], {
      cwd: copy,
      env,
      windowsHide: true,
      stdio: 'inherit'
    });
    child.once('error', reject);
    child.once('exit', (code) =>
      code === 0 ? resolve() : reject(Error('Falló el primer inicio: ' + code))
    );
  });
}

(async () => {
  let server;
  try {
    assert.equal(fs.existsSync(path.join(copy, '.env')), false);
    await prepare();
    const configuration = fs.readFileSync(path.join(copy, '.env'), 'utf8');
    const state = JSON.parse(fs.readFileSync(path.join(copy, '.runtime/setup.json'), 'utf8'));
    assert.ok(fs.existsSync(path.join(copy, 'node_modules/mysql2/package.json')));
    server = spawn(process.execPath, ['server/index.cjs'], {
      cwd: copy,
      env,
      windowsHide: true,
      stdio: 'inherit'
    });
    const url = `http://127.0.0.1:${state.appPort}`;
    let ready = false;
    for (let attempt = 0; attempt < 60; attempt++) {
      try {
        if ((await fetch(url + '/api/session')).ok) {
          ready = true;
          break;
        }
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    assert.ok(ready, 'El servidor no arrancó en la copia nueva');
    assert.equal((await (await fetch(url + '/api/session')).json()).setup, true);
    const response = await fetch(url + '/api/setup', {
      method: 'POST',
      headers: { Origin: url, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        nombre: 'Prueba portátil',
        email: 'portable@example.test',
        password: 'Portable123!',
        confirmation: 'Portable123!'
      })
    });
    assert.equal(response.status, 201);
    const cookie = response.headers.get('set-cookie').split(';')[0];
    const data = await (await fetch(url + '/api/data', { headers: { Cookie: cookie } })).json();
    assert.equal(data.equipos.length, 0);
    await prepare();
    assert.equal(fs.readFileSync(path.join(copy, '.env'), 'utf8'), configuration);
    assert.equal((await (await fetch(url + '/api/session')).json()).setup, false);
    console.log(
      'PASS: copia sin .env ni dependencias, instalación de MySQL, cuenta nueva y segundo inicio sin pérdida de datos.'
    );
  } finally {
    if (server) {
      const stopped = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await stopped;
    }
    const statePath = path.join(copy, '.runtime/setup.json');
    if (fs.existsSync(statePath)) {
      const state = JSON.parse(fs.readFileSync(statePath, 'utf8'));
      const connection = await mysql.createConnection({
        host: '127.0.0.1',
        port: state.port,
        user: 'root',
        password: state.rootPassword
      });
      const [rows] = await connection.query('SELECT @@datadir AS directory');
      assert.equal(
        path.resolve(rows[0].directory).toLowerCase(),
        path.join(copy, 'mysql-data').toLowerCase()
      );
      await connection.query('SHUTDOWN');
      await connection.end();
    }
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
