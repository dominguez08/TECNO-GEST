'use strict';
(() => {
  const tables = [
    'equipos',
    'usuarios',
    'ubicaciones',
    'sedes',
    'tipos_equipo',
    'prestamos',
    'reportes',
    'mantenimientos',
    'actividad'
  ];
  function validate(data) {
    if (
      !data ||
      data.version !== 1 ||
      !data.configuracion ||
      typeof data.configuracion.nombre !== 'string' ||
      !data.configuracion.nombre.trim() ||
      typeof data.configuracion.institucion !== 'string'
    )
      throw Error('El respaldo no tiene el formato de InventIC.');
    if (!data.configuracion.institucion.trim()) throw Error('Escribe el nombre de la institución.');
    if (data.configuracion.institucion.length > 100)
      throw Error('El nombre del instituto admite hasta 100 caracteres.');
    if (!['USD', 'EUR'].includes(data.configuracion.moneda))
      throw Error('Selecciona una moneda válida.');
    for (const table of tables) {
      if (!Array.isArray(data[table])) throw Error('Falta la colección: ' + table);
      const ids = new Set();
      for (const row of data[table]) {
        if (
          !row ||
          !Number.isInteger(Number(row.id)) ||
          Number(row.id) < 1 ||
          ids.has(String(row.id))
        )
          throw Error('Identificadores inválidos en ' + table);
        ids.add(String(row.id));
      }
    }
    const requiredText = {
      equipos: ['codigo', 'nombre'],
      usuarios: ['nombre', 'email'],
      ubicaciones: ['nombre'],
      sedes: ['nombre'],
      tipos_equipo: ['nombre'],
      reportes: ['descripcion', 'fecha_reporte'],
      actividad: ['descripcion', 'fecha']
    };
    for (const [table, fields] of Object.entries(requiredText))
      for (const row of data[table]) {
        for (const field of fields)
          if (typeof row[field] !== 'string' || !row[field].trim())
            throw Error('Campo obligatorio inválido: ' + table + '.' + field);
      }
    const has = (table, id) => data[table].some((row) => String(row.id) === String(id));
    const relation = (rows, field, table, optional = false) =>
      rows.forEach((row) => {
        if (optional && !row[field]) return;
        if (!has(table, row[field])) throw Error('Referencia inválida: ' + field);
      });
    relation(data.equipos, 'tipo_id', 'tipos_equipo');
    relation(data.equipos, 'ubicacion_id', 'ubicaciones');
    relation(data.equipos, 'responsable_id', 'usuarios', true);
    relation(data.ubicaciones, 'sede_id', 'sedes');
    relation(data.usuarios, 'sede_id', 'sedes', true);
    relation(data.prestamos, 'equipo_id', 'equipos');
    relation(data.prestamos, 'usuario_id', 'usuarios');
    relation(data.prestamos, 'registrado_por', 'usuarios');
    relation(data.reportes, 'equipo_id', 'equipos');
    relation(data.reportes, 'usuario_id', 'usuarios');
    relation(data.mantenimientos, 'reporte_id', 'reportes');
    relation(data.mantenimientos, 'tecnico_id', 'usuarios');
    if (!data.usuarios.some((u) => Number(u.rol_id) === 1))
      throw Error('Debe existir al menos un administrador local.');
    const unique = (rows, field) => {
      const values = rows.map((row) =>
        String(row[field] || '')
          .trim()
          .toLowerCase()
      );
      if (values.some((v) => !v) || new Set(values).size !== values.length)
        throw Error('Valores vacíos o duplicados: ' + field);
    };
    unique(data.equipos, 'codigo');
    unique(data.usuarios, 'email');
    for (const key of ['sedes', 'ubicaciones', 'tipos_equipo']) unique(data[key], 'nombre');
    const active = new Set();
    for (const loan of data.prestamos) {
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(loan.fecha_prestamo) ||
        !/^\d{4}-\d{2}-\d{2}$/.test(loan.fecha_devolucion) ||
        loan.fecha_devolucion < loan.fecha_prestamo
      )
        throw Error('Fechas de préstamo inválidas.');
      if (!loan.devuelto_en) {
        const id = String(loan.equipo_id);
        if (active.has(id)) throw Error('El equipo ya tiene un préstamo activo.');
        active.add(id);
        if (data.equipos.find((e) => String(e.id) === id).estado !== 'Activo')
          throw Error('Un equipo prestado debe estar activo.');
      }
    }
    const open = new Set();
    for (const report of data.reportes) {
      if (![1, 2, 3, 4, 5].includes(Number(report.estado_id)))
        throw Error('Estado de reporte inválido.');
      if (Number(report.estado_id) < 4) {
        const id = String(report.equipo_id);
        if (open.has(id)) throw Error('El equipo ya tiene una falla abierta.');
        if (active.has(id) && Number(report.estado_id) !== 1)
          throw Error('Registra la devolución antes de iniciar el mantenimiento.');
        open.add(id);
        if (
          !active.has(id) &&
          data.equipos.find((e) => String(e.id) === id).estado !== 'En Mantenimiento'
        )
          throw Error('El equipo con falla debe estar en mantenimiento.');
      }
    }
    for (const e of data.equipos)
      if (!['Activo', 'Inactivo', 'En Mantenimiento'].includes(e.estado))
        throw Error('Estado de equipo inválido.');
    for (const u of data.usuarios)
      if (![1, 2, 3].includes(Number(u.rol_id))) throw Error('Rol inválido.');
    return data;
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = validate;
  else window.InventicValidate = validate;
})();
