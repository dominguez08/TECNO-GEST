const assert = (condition, message) => {
  if (!condition) {
    const error = new Error(message);
    error.status = 403;
    throw error;
  }
};
const equal = (a, b) => JSON.stringify(a) === JSON.stringify(b);
const sameId = (a, b) => String(a) === String(b);

function checkPermissions(previous, next, actor, restoring) {
  const admin = Number(actor.rol_id) === 1;
  const teacher = Number(actor.rol_id) === 3;
  const ownAccount = next.usuarios.find((user) => sameId(user.id, actor.id));
  assert(ownAccount, 'No puedes eliminar tu propia cuenta.');

  if (restoring) {
    assert(admin, 'Solo un administrador puede restaurar respaldos.');
    assert(Number(ownAccount.rol_id) === 1, 'El respaldo debe conservar tu cuenta administradora.');
    return;
  }

  if (!admin) {
    for (const table of ['sedes', 'tipos_equipo', 'configuracion']) {
      assert(
        equal(previous[table], next[table]),
        'No tienes permiso para cambiar la configuración.'
      );
    }
    assert(
      previous.usuarios.length === next.usuarios.length,
      'No tienes permiso para administrar usuarios.'
    );
    for (const old of previous.usuarios) {
      const current = next.usuarios.find((user) => sameId(user.id, old.id));
      if (!sameId(old.id, actor.id)) {
        assert(equal(old, current), 'No puedes modificar otros usuarios.');
      } else {
        assert(
          current && Number(current.rol_id) === Number(old.rol_id),
          'No puedes cambiar tu rol.'
        );
        const allowed = [
          'nombre',
          'email',
          'telefono',
          'cargo',
          'sede_id',
          'apariencia',
          'new_password',
          'confirmation',
          'current_password'
        ];
        for (const key of new Set([...Object.keys(old), ...Object.keys(current)])) {
          if (!allowed.includes(key))
            assert(equal(old[key], current[key]), 'Campo de usuario no permitido.');
        }
      }
    }
    for (const table of ['equipos', 'ubicaciones', 'reportes', 'prestamos', 'mantenimientos']) {
      for (const row of previous[table]) {
        assert(
          next[table].some((current) => sameId(row.id, current.id)),
          'Solo un administrador puede eliminar registros.'
        );
      }
    }
  }

  for (const old of previous.reportes) {
    const current = next.reportes.find((report) => sameId(report.id, old.id));
    if (Number(old.estado_id) === 5)
      assert(equal(old, current), 'Un reporte cerrado no se puede modificar.');
  }
  for (const maintenance of next.mantenimientos) {
    const report = next.reportes.find((report) => sameId(report.id, maintenance.reporte_id));
    if (Number(report?.estado_id) >= 4)
      assert(Boolean(maintenance.solucion?.trim()), 'Indica una solución antes de finalizar.');
  }

  if (teacher) {
    for (const table of ['ubicaciones', 'prestamos', 'mantenimientos']) {
      assert(equal(previous[table], next[table]), 'Tu rol no permite esta operación.');
    }
    for (const old of previous.reportes) {
      assert(
        equal(
          old,
          next.reportes.find((report) => sameId(report.id, old.id))
        ),
        'No puedes editar un reporte existente.'
      );
    }
    const newReports = next.reportes.filter(
      (report) => !previous.reportes.some((old) => sameId(old.id, report.id))
    );
    assert(
      newReports.every(
        (report) => sameId(report.usuario_id, actor.id) && Number(report.estado_id) === 1
      ),
      'El reporte debe pertenecer a tu cuenta.'
    );
    assert(next.equipos.length === previous.equipos.length, 'No puedes registrar equipos.');
    for (const old of previous.equipos) {
      const expected = { ...old };
      if (newReports.some((report) => sameId(report.equipo_id, old.id)))
        expected.estado = 'En Mantenimiento';
      assert(
        equal(
          expected,
          next.equipos.find((equipment) => sameId(equipment.id, old.id))
        ),
        'No puedes editar el inventario.'
      );
    }
  }
}

module.exports = checkPermissions;
