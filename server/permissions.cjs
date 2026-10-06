const assert = (condition, message) => {
  if (!condition) throw Object.assign(new Error(message), { status: 403 });
};
const sameId = (a, b) => String(a) === String(b);

// Student and technician mutations use their dedicated, limited endpoints.
module.exports = function checkPermissions(previous, next, actor, restoring) {
  assert(
    Number(actor.rol_id) === 1 && Number(actor.aprobado) === 1,
    'Solo el administrador puede modificar el inventario.'
  );
  const own = next.usuarios?.find((user) => sameId(user.id, actor.id));
  assert(
    own && Number(own.rol_id) === 1 && Number(own.aprobado) === 1,
    'Debes conservar tu cuenta administradora activa.'
  );
  if (restoring) return;
  for (const old of previous.reportes) {
    const current = next.reportes.find((report) => sameId(report.id, old.id));
    if (Number(old.estado_id) === 5)
      assert(
        JSON.stringify(old) === JSON.stringify(current),
        'Un reporte cerrado no se puede modificar.'
      );
  }
  for (const maintenance of next.mantenimientos) {
    const report = next.reportes.find((report) => sameId(report.id, maintenance.reporte_id));
    if (Number(report?.estado_id) >= 4)
      assert(Boolean(maintenance.solucion?.trim()), 'Indica una solución antes de finalizar.');
  }
};
