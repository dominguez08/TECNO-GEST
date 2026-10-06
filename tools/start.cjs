const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const {
  ensureDependencies,
  setup,
  findMysql,
  portOpen,
  launchMysql,
  waitForMysql
} = require('./setup.cjs');
const root = path.resolve(__dirname, '..');

async function start() {
  await ensureDependencies(root);
  const envFile = path.join(root, '.env');
  if (!fs.existsSync(envFile)) await setup(root);
  process.loadEnvFile(envFile);
  const appPort = Number(process.env.PORT || 3000);
  const databasePort = Number(process.env.DB_PORT || 3307);
  const databaseHost = process.env.DB_HOST || '127.0.0.1';
  if (!(await portOpen(databasePort, databaseHost))) {
    if (
      !['127.0.0.1', 'localhost'].includes(databaseHost) ||
      !fs.existsSync(path.join(root, 'mysql-data/auto.cnf'))
    ) {
      throw Error(
        'El servidor MySQL configurado en .env no responde. Inicia ese servidor o revisa DB_HOST y DB_PORT.'
      );
    }
    launchMysql(root, findMysql(), databasePort);
    await waitForMysql(databasePort);
  }

  const adminFile = path.join(root, '.runtime/mysql-admin.json');
  if (['127.0.0.1', 'localhost'].includes(databaseHost) && fs.existsSync(adminFile)) {
    const connection = await require('mysql2/promise').createConnection({
      host: databaseHost,
      port: databasePort,
      user: 'root',
      password: JSON.parse(fs.readFileSync(adminFile, 'utf8')).password,
      database: process.env.DB_NAME
    });
    try {
      await require('../server/institutions.cjs').migrate(connection);
    } finally {
      await connection.end();
    }
  }
  if (process.argv.includes('--database-only')) return;
  if (await portOpen(appPort)) {
    const response = await fetch(`http://127.0.0.1:${appPort}/api/session`, {
      signal: AbortSignal.timeout(5000)
    });
    const session = response.headers.get('content-type')?.includes('application/json')
      ? await response.json()
      : null;
    if (!response.ok || !session || !Object.hasOwn(session, 'setup')) {
      throw Error(
        `El puerto ${appPort} está ocupado o la base de datos no responde. Revisa la consola del servidor.`
      );
    }
    console.log(`InventIC ya está disponible en http://localhost:${appPort}`);
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
  child.on('error', (error) => {
    console.error('No se pudo iniciar Node: ' + error.message);
    process.exitCode = 1;
  });
}

start().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
