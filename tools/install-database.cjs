const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const vm = require('node:vm');
const mysql = require('mysql2/promise');
const root = path.resolve(__dirname, '..');

async function install(connection, databaseName, existingEmpty = false) {
  if (!/^[a-zA-Z0-9_]+$/.test(databaseName)) throw Error('Nombre de base de datos inválido.');
  if (!existingEmpty) {
    await connection.query(
      `CREATE DATABASE \`${databaseName}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
  }
  await connection.query(`USE \`${databaseName}\``);
  const [tables] = await connection.query('SHOW TABLES');
  if (tables.length) throw Error('La base ya contiene tablas. No se reemplazará su contenido.');
  const schema = fs.readFileSync(path.join(root, 'database.sql'), 'utf8');
  for (const statement of schema
    .split(';')
    .map((value) => value.trim())
    .filter(Boolean)) {
    await connection.query(statement);
  }
  const context = { window: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, 'assets/initial-data.js'), 'utf8'), context);
  const initial = context.window.INVENTIC_INITIAL_DATA;
  for (const table of ['sedes', 'tipos_equipo', 'usuarios', 'ubicaciones', 'equipos']) {
    for (const original of initial[table]) {
      const row = { ...original };
      if (table === 'usuarios') row.password = '';
      if (table === 'equipos') {
        row.fecha_adquisicion ||= null;
        row.precio ||= null;
      }
      const keys = Object.keys(row);
      await connection.execute(
        `INSERT INTO \`${table}\` (${keys.map((key) => `\`${key}\``).join(',')}) VALUES (${keys.map(() => '?').join(',')})`,
        Object.values(row)
      );
    }
  }
  for (const [key, value] of Object.entries(initial.configuracion)) {
    await connection.execute('INSERT INTO configuracion (clave, valor) VALUES (?, ?)', [
      key,
      value
    ]);
  }
}

async function main() {
  const privateFile = path.join(root, '.runtime/mysql-admin.json');
  const admin = fs.existsSync(privateFile)
    ? JSON.parse(fs.readFileSync(privateFile, 'utf8'))
    : { password: '' };
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: admin.password
  });
  try {
    await install(connection, 'inventic_html');
    const password = crypto.randomBytes(24).toString('hex');
    await connection.query("CREATE USER 'inventic_app'@'127.0.0.1' IDENTIFIED BY ?", [password]);
    await connection.query(
      "GRANT SELECT, INSERT, UPDATE, DELETE ON inventic_html.* TO 'inventic_app'@'127.0.0.1'"
    );
    fs.writeFileSync(
      path.join(root, '.env'),
      `DB_HOST=127.0.0.1\nDB_PORT=3307\nDB_NAME=inventic_html\nDB_USER=inventic_app\nDB_PASS=${password}\nPORT=3000\n`
    );
    if (!admin.password) {
      admin.password = crypto.randomBytes(24).toString('hex');
      await connection.query("ALTER USER 'root'@'localhost' IDENTIFIED BY ?", [admin.password]);
      fs.mkdirSync(path.dirname(privateFile), { recursive: true });
      fs.writeFileSync(privateFile, JSON.stringify(admin));
    }
    console.log('Base inventic_html creada: 23 equipos, 23 fotografías y configuración inicial.');
  } finally {
    await connection.end();
  }
}

module.exports = { install };
if (require.main === module)
  main().catch((error) => {
    console.error(error.message);
    process.exitCode = 1;
  });
