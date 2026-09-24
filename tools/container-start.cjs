const mysql = require('mysql2/promise');
const { install } = require('./install-database.cjs');

async function start() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME
  });
  try {
    const [tables] = await connection.query('SHOW TABLES');
    if (!tables.length) await install(connection, process.env.DB_NAME, true);
    await connection.query('SELECT revision FROM app_metadata WHERE id = 1');
  } finally {
    await connection.end();
  }
  require('../server/index.cjs');
}

start().catch((error) => {
  console.error('No se pudo preparar InventIC: ' + error.message);
  process.exitCode = 1;
});
