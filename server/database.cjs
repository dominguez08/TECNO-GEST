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

async function loadData(actor, connection = pool) {
  if (!actor?.instituto_id) throw new Error('La cuenta no tiene instituto.');
  if (connection === pool) {
    const snapshot = await pool.getConnection();
    try {
      await snapshot.beginTransaction();
      const result = await loadData(actor, snapshot);
      await snapshot.commit();
      return result;
    } catch (error) {
      await snapshot.rollback();
      throw error;
    } finally {
      snapshot.release();
    }
  }
  const data = { version: 1 };
  for (const table of tables) {
    const [rows] = await connection.execute(
      `SELECT * FROM \`${table}\` WHERE instituto_id = ? ORDER BY id`,
      [actor.instituto_id]
    );
    data[table] = rows.map((row) => {
      if (table === 'usuarios') {
        row.hasPassword = Boolean(row.password);
        delete row.password;
      }
      delete row.activo_equipo;
      delete row.instituto_id;
      return row;
    });
  }
  const [settings] = await connection.execute(
    'SELECT clave, valor FROM configuracion WHERE instituto_id = ?',
    [actor.instituto_id]
  );
  data.configuracion = Object.fromEntries(settings.map((row) => [row.clave, row.valor]));
  const [revision] = await connection.execute(
    'SELECT id,nombre,codigo,revision FROM institutos WHERE id = ?',
    [actor.instituto_id]
  );
  data.revision = revision[0].revision;
  data.instituto = { id: revision[0].id, nombre: revision[0].nombre, codigo: revision[0].codigo };
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

async function saveData(data, validate, checkPermission, actor, restoring = false) {
  if (Number(actor.rol_id) !== 1 || !Number(actor.aprobado)) {
    throw Object.assign(new Error('No tienes permiso para modificar el inventario.'), {
      status: 403
    });
  }
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('SELECT id FROM app_metadata WHERE id = 1 FOR UPDATE');
    await require('./institutions.cjs').authorize(connection, actor, 1);
    const [metadata] = await connection.execute(
      'SELECT revision FROM institutos WHERE id = ? FOR UPDATE',
      [actor.instituto_id]
    );
    if (Number(data.revision) !== metadata[0].revision) {
      const error = new Error(
        'Otro usuario guardó cambios. Recarga la página y vuelve a intentarlo.'
      );
      error.status = 409;
      throw error;
    }
    const previous = await loadData(actor, connection);
    await checkPermission(previous, data, actor, restoring);
    validate(data);
    if (restoring && Number(data.instituto?.id) !== Number(actor.instituto_id))
      throw new Error('Solo puedes restaurar un respaldo de tu propio instituto.');
    const self = data.usuarios.find((u) => Number(u.id) === Number(actor.id));
    if (Number(self?.rol_id) !== 1 || Number(self?.aprobado) !== 1)
      throw new Error('Debes conservar tu cuenta administradora activa.');
    for (const loan of data.prestamos) {
      if (!previous.prestamos.some((old) => Number(old.id) === Number(loan.id))) {
        const student = data.usuarios.find((u) => Number(u.id) === Number(loan.usuario_id));
        if (Number(student?.rol_id) !== 3 || Number(student?.aprobado) === 0)
          throw new Error('Selecciona un estudiante aprobado para el préstamo.');
      }
    }
    // Browser IDs are provisional. Allocate globally unique IDs and remap only new rows.
    const maps = {};
    for (const table of tables) {
      maps[table] = new Map();
      const [maximum] = await connection.query(
        `SELECT COALESCE(MAX(id),0) AS id FROM \`${table}\``
      );
      let next = Number(maximum[0].id);
      for (const row of data[table]) {
        if (!previous[table].some((old) => Number(old.id) === Number(row.id))) {
          maps[table].set(String(row.id), ++next);
          row.id = next;
        }
      }
    }
    const relations = {
      usuarios: { sede_id: 'sedes' },
      ubicaciones: { sede_id: 'sedes' },
      equipos: { tipo_id: 'tipos_equipo', ubicacion_id: 'ubicaciones', responsable_id: 'usuarios' },
      reportes: { equipo_id: 'equipos', usuario_id: 'usuarios' },
      prestamos: { equipo_id: 'equipos', usuario_id: 'usuarios', registrado_por: 'usuarios' },
      mantenimientos: { reporte_id: 'reportes', tecnico_id: 'usuarios' },
      actividad: { equipo_id: 'equipos', usuario_id: 'usuarios' }
    };
    for (const [table, fields] of Object.entries(relations))
      for (const row of data[table])
        for (const [field, target] of Object.entries(fields))
          if (maps[target].has(String(row[field])))
            row[field] = maps[target].get(String(row[field]));

    if (!columns) {
      columns = {};
      for (const table of tables) {
        const [description] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
        columns[table] = description.filter((column) => !column.Extra.includes('GENERATED'));
      }
    }

    const [passwordRows] = await connection.execute(
      'SELECT id, password FROM usuarios WHERE instituto_id = ?',
      [actor.instituto_id]
    );
    const passwords = new Map(passwordRows.map((row) => [String(row.id), row.password]));

    for (const table of tables) {
      for (const record of data[table]) {
        const row = { ...record, instituto_id: actor.instituto_id };
        if (table === 'usuarios') {
          if (row.aprobado === undefined) row.aprobado = 1;
          if (![0, 1].includes(Number(row.aprobado))) throw new Error('Estado de cuenta inválido.');
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
            `UPDATE \`${table}\` SET ${updatedFields.map((column) => `\`${column.Field}\` = ?`).join(',')} WHERE id = ? AND instituto_id = ?`,
            [...updatedValues, row.id, actor.instituto_id]
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
        await connection.execute(`DELETE FROM \`${table}\` WHERE id = ? AND instituto_id = ?`, [
          row.id,
          actor.instituto_id
        ]);
    }
    await connection.execute('DELETE FROM configuracion WHERE instituto_id = ?', [
      actor.instituto_id
    ]);
    for (const [key, value] of Object.entries(data.configuracion)) {
      await connection.execute(
        'INSERT INTO configuracion (clave, valor, instituto_id) VALUES (?, ?, ?)',
        [key, String(value), actor.instituto_id]
      );
    }
    await connection.execute(
      'UPDATE institutos SET revision = revision + 1, nombre = ? WHERE id = ?',
      [data.configuracion.institucion, actor.instituto_id]
    );
    await connection.commit();
    return loadData(actor);
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

module.exports = { pool, loadData, getUser, getUserByEmail, saveData };
