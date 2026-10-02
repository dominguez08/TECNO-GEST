const fs = require('node:fs');
const path = require('node:path');
const mysql = require('mysql2/promise');
const { hashPassword, verifyPassword } = require('./security.cjs');

const root = path.resolve(__dirname, '..');
const tables = [
  'sedes',
  'tipos_equipo',
  'usuarios',
  'ubicaciones',
  'equipos',
  'reportes',
  'prestamos',
  'mantenimientos',
  'actividad'
];
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3307),
  user: process.env.DB_USER || 'inventic_app',
  password: process.env.DB_PASS,
  database: process.env.DB_NAME || 'inventic_html',
  dateStrings: true,
  decimalNumbers: true,
  connectionLimit: 5
});

let columns;

async function loadData(connection = pool) {
  const data = { version: 1 };
  for (const table of tables) {
    const [rows] = await connection.query(`SELECT * FROM \`${table}\` ORDER BY id`);
    data[table] = rows.map((row) => {
      if (table === 'usuarios') {
        row.hasPassword = Boolean(row.password);
        delete row.password;
      }
      delete row.activo_equipo;
      return row;
    });
  }
  const [settings] = await connection.query('SELECT clave, valor FROM configuracion');
  data.configuracion = Object.fromEntries(settings.map((row) => [row.clave, row.valor]));
  const [revision] = await connection.query('SELECT revision FROM app_metadata WHERE id = 1');
  data.revision = revision[0].revision;
  return data;
}

async function getUser(id) {
  const [rows] = await pool.execute('SELECT * FROM usuarios WHERE id = ?', [id]);
  return rows[0];
}

async function getUserByEmail(email) {
  const [rows] = await pool.execute('SELECT * FROM usuarios WHERE email = ?', [email]);
  return rows[0];
}

async function needsSetup() {
  const [rows] = await pool.query(
    "SELECT COUNT(*) AS total FROM usuarios WHERE rol_id = 1 AND password <> ''"
  );
  return rows[0].total === 0;
}

async function setupAdmin({ nombre, email, password, confirmation }) {
  if (!nombre?.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '')) {
    throw new Error('Escribe tu nombre y un correo válido.');
  }
  if (password !== confirmation) throw new Error('Las contraseñas no coinciden.');
  const hash = await hashPassword(password);
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM app_metadata WHERE id = 1 FOR UPDATE');
    const [admins] = await connection.query(
      'SELECT id, password FROM usuarios WHERE rol_id = 1 ORDER BY id'
    );
    if (admins.some((admin) => admin.password))
      throw new Error('La cuenta administradora ya está configurada.');
    let id = admins[0]?.id;
    if (id) {
      await connection.execute(
        'UPDATE usuarios SET nombre = ?, email = ?, password = ? WHERE id = ?',
        [nombre.trim(), email.trim().toLowerCase(), hash, id]
      );
    } else {
      const [result] = await connection.execute(
        'INSERT INTO usuarios (nombre, email, password, rol_id) VALUES (?, ?, ?, 1)',
        [nombre.trim(), email.trim().toLowerCase(), hash]
      );
      id = result.insertId;
    }
    await connection.query('UPDATE app_metadata SET revision = revision + 1 WHERE id = 1');
    await connection.commit();
    return getUser(id);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function saveData(data, validate, checkPermission, actor, restoring = false) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [metadata] = await connection.query(
      'SELECT revision FROM app_metadata WHERE id = 1 FOR UPDATE'
    );
    if (Number(data.revision) !== metadata[0].revision) {
      const error = new Error(
        'Otro usuario guardó cambios. Recarga la página y vuelve a intentarlo.'
      );
      error.status = 409;
      throw error;
    }
    const previous = await loadData(connection);
    await checkPermission(previous, data, actor, restoring);
    validate(data);

    if (!columns) {
      columns = {};
      for (const table of tables) {
        const [description] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
        columns[table] = description.filter((column) => !column.Extra.includes('GENERATED'));
      }
    }

    const [passwordRows] = await connection.query('SELECT id, password FROM usuarios');
    const passwords = new Map(passwordRows.map((row) => [String(row.id), row.password]));

    for (const table of tables) {
      for (const record of data[table]) {
        const row = { ...record };
        if (table === 'usuarios') {
          row.password = passwords.get(String(row.id)) || '';
          if (row.new_password) {
            if (row.new_password !== row.confirmation)
              throw new Error('Las contraseñas no coinciden.');
            if (
              String(row.id) === String(actor.id) &&
              row.password &&
              !(await verifyPassword(row.current_password, row.password))
            ) {
              throw new Error('La contraseña actual no es correcta.');
            }
            row.password = await hashPassword(row.new_password);
          }
          if (!passwords.has(String(row.id)) && !row.password && !restoring) {
            throw new Error('Asigna una contraseña al nuevo usuario.');
          }
        }
        if (table === 'actividad') {
          if (!data.usuarios.some((u) => String(u.id) === String(row.usuario_id)))
            row.usuario_id = null;
          if (!data.equipos.some((e) => String(e.id) === String(row.equipo_id)))
            row.equipo_id = null;
        }
        const fields = columns[table].filter((column) => row[column.Field] !== undefined);
        const values = fields.map((column) => {
          let value = row[column.Field];
          if (value === '' && column.Null === 'YES' && /^(int|decimal|date)/.test(column.Type))
            value = null;
          if (value && column.Type.startsWith('datetime') && String(value).includes('T'))
            value = new Date(value).toISOString().slice(0, 19).replace('T', ' ');
          return value;
        });
        const names = fields.map((column) => `\`${column.Field}\``);
        const existing = previous[table].some((old) => String(old.id) === String(row.id));
        if (existing) {
          const updatedFields = fields.filter((column) => column.Field !== 'id');
          const updatedValues = fields
            .map((column, index) => ({ column, value: values[index] }))
            .filter((item) => item.column.Field !== 'id')
            .map((item) => item.value);
          await connection.execute(
            `UPDATE \`${table}\` SET ${updatedFields.map((column) => `\`${column.Field}\` = ?`).join(',')} WHERE id = ?`,
            [...updatedValues, row.id]
          );
        } else {
          await connection.execute(
            `INSERT INTO \`${table}\` (${names.join(',')}) VALUES (${fields.map(() => '?').join(',')})`,
            values
          );
        }
      }
    }
    for (const table of [...tables].reverse()) {
      const removed = previous[table].filter(
        (old) => !data[table].some((row) => String(row.id) === String(old.id))
      );
      for (const row of removed)
        await connection.execute(`DELETE FROM \`${table}\` WHERE id = ?`, [row.id]);
    }
    await connection.query('DELETE FROM configuracion');
    for (const [key, value] of Object.entries(data.configuracion)) {
      await connection.execute('INSERT INTO configuracion (clave, valor) VALUES (?, ?)', [
        key,
        String(value)
      ]);
    }
    await connection.query('UPDATE app_metadata SET revision = revision + 1 WHERE id = 1');
    await connection.commit();
    return loadData();
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { pool, loadData, getUser, getUserByEmail, needsSetup, setupAdmin, saveData };
