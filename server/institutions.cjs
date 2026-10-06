const crypto = require('node:crypto');
const { hashPassword } = require('./security.cjs');
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
const fail = (message, status = 400) => Object.assign(new Error(message), { status });
async function authorize(connection, actor, role) {
  const [rows] = await connection.execute(
    'SELECT id FROM usuarios WHERE id=? AND instituto_id=? AND rol_id=? AND aprobado=1',
    [actor.id, actor.instituto_id, role]
  );
  if (!rows.length)
    throw fail('Tu cuenta ya no tiene permiso para esta operación. Actualiza la página.', 403);
}

// Resumable migration: existing records stay together; new institutes start empty.
async function migrate(connection) {
  const [lock] = await connection.query(
    "SELECT GET_LOCK(CONCAT(DATABASE(), ':institutes'), 60) AS acquired"
  );
  if (Number(lock[0].acquired) !== 1)
    throw Error('No se pudo bloquear la actualización de la base.');
  try {
    const [meta] = await connection.query('SHOW COLUMNS FROM app_metadata');
    if (!meta.some((c) => c.Field === 'schema_version'))
      await connection.query('ALTER TABLE app_metadata ADD schema_version INT NOT NULL DEFAULT 0');
    const [version] = await connection.query(
      'SELECT schema_version FROM app_metadata WHERE id = 1'
    );
    if (version[0].schema_version >= 1) return;
    await connection.query(`CREATE TABLE IF NOT EXISTS institutos (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      nombre VARCHAR(100) NOT NULL,
      codigo VARCHAR(32) NOT NULL UNIQUE,
      revision INT NOT NULL DEFAULT 0
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
    await connection.execute(
      "INSERT IGNORE INTO institutos (id,nombre,codigo) VALUES (1,'Mi institución',?)",
      [crypto.randomBytes(12).toString('hex').toUpperCase()]
    );
    for (const table of [...tables, 'configuracion']) {
      const [columns] = await connection.query(`SHOW COLUMNS FROM \`${table}\``);
      if (!columns.some((c) => c.Field === 'instituto_id'))
        await connection.query(
          `ALTER TABLE \`${table}\` ADD instituto_id INT NOT NULL DEFAULT 1, ADD INDEX idx_instituto (instituto_id)`
        );
    }
    const [users] = await connection.query('SHOW COLUMNS FROM usuarios');
    if (!users.some((c) => c.Field === 'aprobado'))
      await connection.query('ALTER TABLE usuarios ADD aprobado TINYINT NOT NULL DEFAULT 1');
    for (const [table, oldName, column] of [
      ['sedes', 'nombre', 'nombre'],
      ['ubicaciones', 'uq_ubicacion_nombre', 'nombre'],
      ['equipos', 'codigo', 'codigo']
    ]) {
      const [indexes] = await connection.query(`SHOW INDEX FROM \`${table}\``);
      if (indexes.some((i) => i.Key_name === oldName))
        await connection.query(
          `ALTER TABLE \`${table}\` DROP INDEX \`${oldName}\`, ADD UNIQUE KEY uq_instituto_${column} (instituto_id, \`${column}\`)`
        );
    }
    const [indexes] = await connection.query('SHOW INDEX FROM configuracion');
    if (!indexes.some((i) => i.Key_name === 'PRIMARY' && i.Column_name === 'instituto_id'))
      await connection.query(
        'ALTER TABLE configuracion DROP PRIMARY KEY, ADD PRIMARY KEY (instituto_id, clave)'
      );
    await connection.query("UPDATE roles SET nombre = 'Estudiante' WHERE id = 3");
    await connection.query(
      "UPDATE configuracion SET valor = 'Mi institución' WHERE clave = 'institucion' AND LOWER(TRIM(valor)) IN ('iep san rafael','san rafael','i.e.p. san rafael')"
    );
    // Preserve linked locations/equipment; replace the sample label without deleting their sede.
    const [sites] = await connection.query(
      "SELECT id,instituto_id FROM sedes WHERE LOWER(TRIM(nombre)) IN ('iep san rafael','san rafael','i.e.p. san rafael','sede san rafael')"
    );
    for (const site of sites) {
      let label = 'Sede principal';
      const [duplicate] = await connection.execute(
        'SELECT id FROM sedes WHERE instituto_id = ? AND nombre = ? AND id <> ?',
        [site.instituto_id, label, site.id]
      );
      if (duplicate.length) label += ' ' + site.id;
      await connection.execute('UPDATE sedes SET nombre = ? WHERE id = ?', [label, site.id]);
    }
    await connection.query(
      "UPDATE institutos i JOIN configuracion c ON c.instituto_id = i.id AND c.clave = 'institucion' SET i.nombre = LEFT(c.valor,100)"
    );
    await connection.query('UPDATE app_metadata SET schema_version = 1 WHERE id = 1');
  } finally {
    await connection.query("SELECT RELEASE_LOCK(CONCAT(DATABASE(), ':institutes'))");
  }
}

function service(pool) {
  async function register({ nombre, email, password, confirmation, rol_id, institucion, codigo }) {
    if (
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      nombre.trim().length > 100 ||
      typeof email !== 'string' ||
      email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    )
      throw fail('Escribe tu nombre y un correo válido.');
    const role = Number(rol_id);
    if (![1, 2, 3].includes(role))
      throw fail('Selecciona si eres administrador, técnico o estudiante.');
    if (
      role === 1 &&
      (typeof institucion !== 'string' || !institucion.trim() || institucion.trim().length > 100)
    )
      throw fail('Escribe el nombre de tu instituto (máximo 100 caracteres).');
    if (role !== 1 && (typeof codigo !== 'string' || !codigo.trim() || codigo.length > 32))
      throw fail('Solicita el código del instituto a su director.');
    if (password !== confirmation) throw fail('Las contraseñas no coinciden.');
    const hash = await hashPassword(password);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('SELECT id FROM app_metadata WHERE id = 1 FOR UPDATE');
      let instituteId;
      if (role === 1) {
        const [result] = await connection.execute(
          'INSERT INTO institutos (nombre,codigo) VALUES (?,?)',
          [institucion.trim(), crypto.randomBytes(12).toString('hex').toUpperCase()]
        );
        instituteId = result.insertId;
        for (const [key, value] of Object.entries({
          nombre: 'InventIC',
          institucion: institucion.trim(),
          moneda: 'USD'
        }))
          await connection.execute(
            'INSERT INTO configuracion (instituto_id,clave,valor) VALUES (?,?,?)',
            [instituteId, key, value]
          );
      } else {
        const [rows] = await connection.execute('SELECT id FROM institutos WHERE codigo = ?', [
          codigo.trim().toUpperCase()
        ]);
        if (!rows.length)
          throw fail('El código del instituto no es válido. Solicítalo al director.');
        instituteId = rows[0].id;
      }
      const [result] = await connection.execute(
        'INSERT INTO usuarios (instituto_id,nombre,email,password,rol_id,aprobado) VALUES (?,?,?,?,?,?)',
        [instituteId, nombre.trim(), email.trim().toLowerCase(), hash, role, role === 1 ? 1 : 0]
      );
      await connection.execute('UPDATE institutos SET revision = revision + 1 WHERE id = ?', [
        instituteId
      ]);
      await connection.commit();
      return result.insertId;
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY')
        throw fail('Ya existe una cuenta con ese correo. Inicia sesión.', 409);
      throw error;
    } finally {
      connection.release();
    }
  }
  async function pending(actor) {
    const [rows] = await pool.execute('SELECT nombre FROM institutos WHERE id = ?', [
      actor.instituto_id
    ]);
    return {
      scope: 'pending',
      usuarios: [{ id: actor.id, nombre: actor.nombre, rol_id: actor.rol_id, aprobado: 0 }],
      configuracion: { nombre: 'InventIC', institucion: rows[0].nombre, moneda: 'USD' }
    };
  }
  async function approve(actor, { usuario_id, aprobado }) {
    if (Number(actor.rol_id) !== 1) throw fail('Solo el director puede autorizar cuentas.', 403);
    if (![0, 1].includes(Number(aprobado)) || Number(usuario_id) === actor.id)
      throw fail('Solicitud inválida.');
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('SELECT id FROM app_metadata WHERE id = 1 FOR UPDATE');
      await authorize(connection, actor, 1);
      const [result] = await connection.execute(
        'UPDATE usuarios SET aprobado = ? WHERE id = ? AND instituto_id = ?',
        [Number(aprobado), usuario_id, actor.instituto_id]
      );
      if (!result.affectedRows) throw fail('La cuenta no pertenece a tu instituto.', 404);
      await connection.execute('UPDATE institutos SET revision = revision + 1 WHERE id = ?', [
        actor.instituto_id
      ]);
      await connection.commit();
      return { ok: true };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return { register, pending, approve };
}
module.exports = { migrate, service, tables, authorize };
