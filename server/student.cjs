const fail = (message, status = 400) => Object.assign(new Error(message), { status });

function studentService(pool) {
  async function data(actor) {
    const [loans] = await pool.execute(
      `SELECT p.id, p.equipo_id, p.fecha_prestamo, p.fecha_devolucion, p.devuelto_en,
        e.codigo, e.nombre, e.marca, e.modelo,
        CONCAT(p.fecha_devolucion, 'T23:59:59-06:00') AS vence_en,
        EXISTS(SELECT 1 FROM reportes r WHERE r.equipo_id = p.equipo_id AND r.estado_id < 4) AS falla_abierta
       FROM prestamos p JOIN equipos e ON e.id = p.equipo_id AND e.instituto_id = p.instituto_id
       WHERE p.usuario_id = ? AND p.instituto_id = ? ORDER BY p.id DESC`,
      [actor.id, actor.instituto_id]
    );
    const [reports] = await pool.execute(
      `SELECT r.id, r.equipo_id, r.descripcion, r.fecha_reporte, r.estado_id, e.codigo, e.nombre
       FROM reportes r JOIN equipos e ON e.id = r.equipo_id AND e.instituto_id = r.instituto_id
       WHERE r.usuario_id = ? AND r.instituto_id = ? ORDER BY r.id DESC`,
      [actor.id, actor.instituto_id]
    );
    const [institute] = await pool.execute('SELECT nombre FROM institutos WHERE id = ?', [
      actor.instituto_id
    ]);
    return {
      scope: 'student',
      serverTime: new Date().toISOString(),
      prestamos: loans,
      reportes: reports,
      usuarios: [{ id: actor.id, nombre: actor.nombre, rol_id: 3 }],
      configuracion: { nombre: 'InventIC', institucion: institute[0].nombre, moneda: 'USD' }
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
      await require('./institutions.cjs').authorize(connection, actor, 3);
      const [loans] = await connection.execute(
        'SELECT equipo_id FROM prestamos WHERE id = ? AND usuario_id = ? AND instituto_id = ? AND devuelto_en IS NULL FOR UPDATE',
        [prestamo_id, actor.id, actor.instituto_id]
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
        'INSERT INTO reportes (equipo_id, usuario_id, descripcion, estado_id, instituto_id) VALUES (?, ?, ?, 1, ?)',
        [equipmentId, actor.id, descripcion.trim(), actor.instituto_id]
      );
      await connection.execute(
        'INSERT INTO actividad (usuario_id, equipo_id, descripcion, instituto_id) VALUES (?, ?, ?, ?)',
        [
          actor.id,
          equipmentId,
          'El estudiante reportó una falla durante su préstamo',
          actor.instituto_id
        ]
      );
      await connection.execute('UPDATE institutos SET revision = revision + 1 WHERE id = ?', [
        actor.instituto_id
      ]);
      await connection.commit();
      return { id: result.insertId };
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  }
  return { data, report };
}
module.exports = studentService;
