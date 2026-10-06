const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { migrate } = require('../server/institutions.cjs');
const { hashPassword } = require('../server/security.cjs');
const root = path.resolve(__dirname, '..');
(async () => {
  const password = JSON.parse(
    fs.readFileSync(
      process.env.TEST_MYSQL_ADMIN_FILE || path.join(root, '.runtime/mysql-admin.json'),
      'utf8'
    )
  ).password;
  const connection = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password
  });
  const name = 'inventic_test_migration_' + Date.now();
  try {
    await connection.query(
      `CREATE DATABASE \`${name}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`
    );
    await connection.query(`USE \`${name}\``);
    for (const statement of fs
      .readFileSync(path.join(root, 'database.sql'), 'utf8')
      .split(';')
      .map((s) => s.trim())
      .filter(Boolean))
      await connection.query(statement);
    const hash = await hashPassword('Prueba123!');
    await connection.execute(
      "INSERT INTO usuarios (id,nombre,email,password,rol_id) VALUES (1,'Director','legacy@example.test',?,1)",
      [hash]
    );
    await connection.query(
      "INSERT INTO sedes (id,nombre) VALUES (1,'San Rafael'),(2,'Sede principal')"
    );
    await connection.query(
      "INSERT INTO ubicaciones (id,nombre,sede_id) VALUES (1,'Aula antigua',1)"
    );
    await connection.query("INSERT INTO tipos_equipo (id,nombre) VALUES (1,'Laptop')");
    await connection.query(
      "INSERT INTO equipos (id,codigo,nombre,tipo_id,ubicacion_id) VALUES (1,'LEG-1','Equipo existente',1,1)"
    );
    await connection.query(
      "INSERT INTO configuracion (clave,valor) VALUES ('nombre','InventIC'),('institucion','IEP San Rafael'),('moneda','USD')"
    );
    await migrate(connection);
    await migrate(connection);
    const [users] = await connection.query(
      'SELECT password,instituto_id,aprobado FROM usuarios WHERE id=1'
    );
    assert.deepEqual(users[0], { password: hash, instituto_id: 1, aprobado: 1 });
    const [sites] = await connection.query('SELECT nombre FROM sedes WHERE id=1');
    assert.equal(sites[0].nombre, 'Sede principal 1');
    const [equipment] = await connection.query(
      'SELECT nombre,instituto_id,ubicacion_id FROM equipos WHERE id=1'
    );
    assert.deepEqual(equipment[0], {
      nombre: 'Equipo existente',
      instituto_id: 1,
      ubicacion_id: 1
    });
    const [institutes] = await connection.query('SELECT nombre,codigo FROM institutos');
    assert.equal(institutes.length, 1);
    assert.equal(institutes[0].nombre, 'Mi institución');
    assert.match(institutes[0].codigo, /^[0-9A-F]{24}$/);
    const [settings] = await connection.query(
      "SELECT valor FROM configuracion WHERE instituto_id=1 AND clave='institucion'"
    );
    assert.equal(settings[0].valor, 'Mi institución');
    console.log(
      'Institute migration: legacy accounts, passwords, equipment and relationships preserved; sample sede renamed; repeat startup passed.'
    );
  } finally {
    if (/^inventic_test_migration_\d+$/.test(name))
      await connection.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await connection.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
