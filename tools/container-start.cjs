const mysql = require('mysql2/promise');
const { install } = require('./install-database.cjs');
const { getDatabaseConfig } = require('../server/db-config.cjs');

async function start() {
  const databaseConfig = getDatabaseConfig();
  const connection = await mysql.createConnection(databaseConfig);
  try {
    const [tables] = await connection.query('SHOW TABLES');
    if (!tables.length) await install(connection, databaseConfig.database, true);
    await connection.query('SELECT revision FROM app_metadata WHERE id = 1');
  } finally {
    await connection.end();
  }
  require('../server/index.cjs');
}

start().catch((error) => {
  console.error('No se pudo preparar TECNO-GEST: ' + error.message);
  process.exitCode = 1;
});
