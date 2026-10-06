const fail = (message, status = 400) => Object.assign(new Error(message), { status });
module.exports = function technicianService(pool) {
  async function data(actor) {
    const [reports] = await pool.execute(
      `SELECT r.id,r.descripcion,r.fecha_reporte,r.estado_id,e.codigo,e.nombre,
      m.tecnico_id,m.diagnostico,m.solucion,m.fecha_inicio,m.fecha_fin,
      EXISTS(SELECT 1 FROM prestamos p WHERE p.equipo_id=r.equipo_id AND p.devuelto_en IS NULL) AS prestado
      FROM reportes r JOIN equipos e ON e.id=r.equipo_id AND e.instituto_id=r.instituto_id
      LEFT JOIN mantenimientos m ON m.reporte_id=r.id AND m.instituto_id=r.instituto_id
      WHERE r.instituto_id=? ORDER BY r.id DESC`,
      [actor.instituto_id]
    );
    const [institute] = await pool.execute('SELECT nombre FROM institutos WHERE id=?', [
      actor.instituto_id
    ]);
    return {
      scope: 'technician',
      reportes: reports,
      usuarios: [{ id: actor.id, nombre: actor.nombre, rol_id: 2 }],
      configuracion: { nombre: 'InventIC', institucion: institute[0].nombre, moneda: 'USD' }
    };
  }
  async function repair(actor, { reporte_id, estado_id, diagnostico = '', solucion = '' }) {
    const state = Number(estado_id);
    if (
      !Number.isSafeInteger(Number(reporte_id)) ||
      Number(reporte_id) < 1 ||
      ![2, 3, 4].includes(state)
    )
      throw fail('Selecciona un reporte y un estado válido.');
    if (
      typeof diagnostico !== 'string' ||
      typeof solucion !== 'string' ||
      diagnostico.length > 4000 ||
      solucion.length > 4000
    )
      throw fail('El diagnóstico y la solución admiten hasta 4000 caracteres.');
    if (!diagnostico.trim()) throw fail('Describe el diagnóstico.');
    if (state === 4 && !solucion.trim())
      throw fail('Indica la solución antes de marcarlo reparado.');
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.query('SELECT id FROM app_metadata WHERE id=1 FOR UPDATE');
      await require('./institutions.cjs').authorize(connection, actor, 2);
      const [rows] = await connection.execute(
        'SELECT * FROM reportes WHERE id=? AND instituto_id=? FOR UPDATE',
        [reporte_id, actor.instituto_id]
      );
      const report = rows[0];
      if (!report) throw fail('El reporte no pertenece a tu instituto.', 404);
      if (Number(report.estado_id) >= 4) throw fail('El reporte ya está finalizado.', 409);
      const [loans] = await connection.execute(
        'SELECT id FROM prestamos WHERE equipo_id=? AND devuelto_en IS NULL',
        [report.equipo_id]
      );
      if (loans.length)
        throw fail(
          'El administrador debe registrar la devolución antes de reparar el equipo.',
          409
        );
      const [maintenance] = await connection.execute(
        'SELECT id,tecnico_id FROM mantenimientos WHERE reporte_id=? AND instituto_id=? FOR UPDATE',
        [report.id, actor.instituto_id]
      );
      if (maintenance.length && Number(maintenance[0].tecnico_id) !== Number(actor.id))
        throw fail('Esta reparación está asignada a otro técnico.', 403);
      if (maintenance.length) {
        await connection.execute(
          'UPDATE mantenimientos SET diagnostico=?,solucion=?,fecha_fin=? WHERE id=? AND instituto_id=?',
          [
            diagnostico.trim(),
            solucion.trim(),
            state === 4 ? new Date() : null,
            maintenance[0].id,
            actor.instituto_id
          ]
        );
      } else {
        await connection.execute(
          'INSERT INTO mantenimientos (instituto_id,reporte_id,tecnico_id,diagnostico,solucion,fecha_fin) VALUES (?,?,?,?,?,?)',
          [
            actor.instituto_id,
            report.id,
            actor.id,
            diagnostico.trim(),
            solucion.trim(),
            state === 4 ? new Date() : null
          ]
        );
      }
      await connection.execute('UPDATE reportes SET estado_id=? WHERE id=? AND instituto_id=?', [
        state,
        report.id,
        actor.instituto_id
      ]);
      await connection.execute('UPDATE equipos SET estado=? WHERE id=? AND instituto_id=?', [
        state === 4 ? 'Activo' : 'En Mantenimiento',
        report.equipo_id,
        actor.instituto_id
      ]);
      await connection.execute(
        'INSERT INTO actividad (instituto_id,usuario_id,equipo_id,descripcion) VALUES (?,?,?,?)',
        [
          actor.instituto_id,
          actor.id,
          report.equipo_id,
          state === 4
            ? 'El técnico finalizó la reparación'
            : 'El técnico actualizó el mantenimiento'
        ]
      );
      await connection.execute('UPDATE institutos SET revision=revision+1 WHERE id=?', [
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
  return { data, repair };
};
