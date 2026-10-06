const { hashPassword } = require('./security.cjs');

const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function studentService(pool) {
  async function register({ nombre, email, password, confirmation }) {
    if (
      typeof nombre !== 'string' ||
      !nombre.trim() ||
      nombre.trim().length > 100 ||
      typeof email !== 'string' ||
      email.length > 100 ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
    ) {
      throw fail('Escribe tu nombre y un correo válido.');
    }
    if (password !== confirmation) throw fail('Las contraseñas no coinciden.');
    const hash = await hashPassword(password);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('SELECT id FROM app_metadata WHERE id = 1 FOR UPDATE');
      const [admins] = await connection.query(
        "SELECT id FROM usuarios WHERE rol_id = 1 AND password <> ''"
      );
      if (!admins.length) throw fail('Primero configura la cuenta administradora.');
      const [result] = await connection.execute(
        'INSERT INTO usuarios (nombre, email, password, rol_id) VALUES (?, ?, ?, 3)',
        [nombre.trim(), email.trim().toLowerCase(), hash]
      );
      await connection.query('UPDATE app_metadata SET revision = revision + 1 WHERE id = 1');
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

  async function data(actor) {
    const [loans] = await pool.execute(
      `SELECT p.id, p.equipo_id, p.fecha_prestamo, p.fecha_devolucion, p.devuelto_en,
        e.codigo, e.nombre, e.marca, e.modelo,
        CONCAT(p.fecha_devolucion, 'T23:59:59-06:00') AS vence_en,
        EXISTS(SELECT 1 FROM reportes r WHERE r.equipo_id = p.equipo_id AND r.estado_id < 4) AS falla_abierta
       FROM prestamos p JOIN equipos e ON e.id = p.equipo_id
       WHERE p.usuario_id = ? ORDER BY p.id DESC`,
      [actor.id]
    );
    const [reports] = await pool.execute(
      `SELECT r.id, r.equipo_id, r.descripcion, r.fecha_reporte, r.estado_id, e.codigo, e.nombre
       FROM reportes r JOIN equipos e ON e.id = r.equipo_id
       WHERE r.usuario_id = ? ORDER BY r.id DESC`,
      [actor.id]
    );
    return {
      scope: 'student',
      serverTime: new Date().toISOString(),
      prestamos: loans,
      reportes: reports,
      usuarios: [{ id: actor.id, nombre: actor.nombre, rol_id: 3 }],
      configuracion: { nombre: 'InventIC', institucion: 'Portal de estudiantes', moneda: 'USD' }
    };
  }

  async function report(actor, { prestamo_id, descripcion }) {
    if (
      !Number.isSafeInteger(Number(prestamo_id)) ||
      Number(prestamo_id) < 1 ||
      typeof descripcion !== 'string' ||
      !descripcion.trim() ||
      descripcion.trim().length > 4000
    ) {
      throw fail('Selecciona tu préstamo y describe la falla (máximo 4000 caracteres).');
    }
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      // Serialize with administrative saves and returns to prevent stale writes.
      await connection.query('SELECT id FROM app_metadata WHERE id = 1 FOR UPDATE');
      const [loans] = await connection.execute(
        'SELECT equipo_id FROM prestamos WHERE id = ? AND usuario_id = ? AND devuelto_en IS NULL FOR UPDATE',
        [prestamo_id, actor.id]
      );
      if (!loans.length) throw fail('El préstamo no está activo o no pertenece a tu cuenta.', 403);
      const equipmentId = loans[0].equipo_id;
      const [open] = await connection.execute(
        'SELECT id FROM reportes WHERE equipo_id = ? AND estado_id < 4',
        [equipmentId]
      );
      if (open.length)
        throw fail(
          'El equipo ya tiene una falla abierta. El administrador le dará seguimiento.',
          409
        );
      const [result] = await connection.execute(
        'INSERT INTO reportes (equipo_id, usuario_id, descripcion, estado_id) VALUES (?, ?, ?, 1)',
        [equipmentId, actor.id, descripcion.trim()]
      );
      await connection.execute(
        'INSERT INTO actividad (usuario_id, equipo_id, descripcion) VALUES (?, ?, ?)',
        [actor.id, equipmentId, 'El estudiante reportó una falla durante su préstamo']
      );
      await connection.query('UPDATE app_metadata SET revision = revision + 1 WHERE id = 1');
      await connection.commit();
      return { id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return { register, data, report };
}
module.exports = studentService;
