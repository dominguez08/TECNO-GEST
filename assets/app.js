'use strict';
(() => {
  const view = window.InventicViews.render;
  const store = window.InventicStore;
  const auth = window.InventicAuth;
  const html = (parts, ...values) =>
    parts.reduce((result, part, index) => result + part + (values[index] ?? ''), '');
  const roles = ['Administrador', 'Técnico', 'Estudiante'];
  const states = ['Pendiente', 'En revisión', 'En reparación', 'Reparado', 'Cerrado'];
  const navigation = [
    ['dashboard', 'Panel', '▦'],
    ['equipos', 'Inventario', '▣'],
    ['prestamos', 'Préstamos', '⇄'],
    ['mantenimiento', 'Mantenimiento', '⚒'],
    ['ubicaciones', 'Ubicaciones', '⌖'],
    ['estadisticas', 'Reportes', '▥'],
    ['reportes', 'Reportes de fallas', '!'],
    ['usuarios', 'Usuarios', '♙'],
    ['configuracion', 'Configuración', '⚙']
  ];
  let db, user, route, action, params;
  const esc = (v) =>
    String(v ?? '').replace(
      /[&<>"']/g,
      (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
    );
  const today = () => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };
  const find = (table, id) => db[table].find((row) => String(row.id) === String(id));
  const name = (table, id) => find(table, id)?.nombre || '—';
  const eqName = (id) => {
    const e = find('equipos', id);
    return e ? `${e.codigo} · ${e.nombre}` : '—';
  };
  const activeLoan = (id) =>
    db.prestamos.find((p) => String(p.equipo_id) === String(id) && !p.devuelto_en);
  const openReport = (id) =>
    db.reportes.find((r) => String(r.equipo_id) === String(id) && Number(r.estado_id) < 4);
  const available = (e) => e.estado === 'Activo' && !activeLoan(e.id) && !openReport(e.id);
  const status = (e) => (activeLoan(e.id) ? 'Prestado' : e.estado);
  const badge = (value) => html`
    <span class="status-badge status-${esc(value.replaceAll(' ', '-'))}">
      ${esc(value === 'Activo' ? 'Disponible' : value)}
    </span>
  `;
  const url = (r, a = 'index', id = '') =>
    `#/${r}/${a}${id ? '?id=' + encodeURIComponent(id) : ''}`;
  const link = (r, text, a = 'index', id = '', cls = 'btn btn-light') => html`
    <a class="${cls}" href="${url(r, a, id)}">${esc(text)}</a>
  `;
  const button = (text, act, id = '', cls = 'btn btn-light') => html`
    <button type="button" class="${cls}" data-action="${act}" data-id="${esc(id)}">
      ${esc(text)}
    </button>
  `;
  const title = (text, subtitle = '', actions = '') => html`
    <div class="page-title-box">
      <div>
        <h1 class="page-title">${esc(text)}</h1>
        <p>${esc(subtitle)}</p>
      </div>
      <div class="page-actions">${actions}</div>
    </div>
  `;
  const field = (key, label, value = '', type = 'text', required = false, extra = '') => html`
    <div class="field">
      <label for="${key}">${esc(label)}${required ? ' *' : ''}</label>
      <input
        class="form-control"
        id="${key}"
        name="${key}"
        type="${type}"
        value="${esc(value)}"
        ${required ? 'required' : ''}
        ${extra}
      />
    </div>
  `;
  const select = (key, label, options, value = '', required = false) => html`
    <div class="field">
      <label for="${key}">${esc(label)}${required ? ' *' : ''}</label>
      <select class="form-select" id="${key}" name="${key}" ${required ? 'required' : ''}>
        <option value="">Seleccionar</option>
        ${options
          .map((o) => {
            const id = typeof o === 'string' ? o : o.id;
            const label = typeof o === 'string' ? o : o.nombre;
            return html`
              <option value="${esc(id)}" ${String(id) === String(value) ? 'selected' : ''}>
                ${esc(label)}
              </option>
            `;
          })
          .join('')}
      </select>
    </div>
  `;
  function selectOptions(options, value) {
    return options
      .map((option) => {
        const id = typeof option === 'string' ? option : option.id;
        const label = typeof option === 'string' ? option : option.nombre;
        const selected = String(id) === String(value) ? ' selected' : '';
        return '<option value="' + esc(id) + '"' + selected + '>' + esc(label) + '</option>';
      })
      .join('');
  }
  const area = (key, label, value = '') => html`
    <div class="field field-wide">
      <label for="${key}">${esc(label)}</label>
      <textarea class="form-control" id="${key}" name="${key}" maxlength="4000">
${esc(value)}</textarea>
    </div>
  `;
  function form(type, fields, cancel = route, id = '') {
    const prefix = type + '-' + (id || 'new') + '-';
    const uniqueFields = fields.replace(
      /(id|for)="([^"]+)"/g,
      (_, attribute, value) => `${attribute}="${prefix}${value}"`
    );
    return html`
      <form data-form="${type}" data-id="${esc(id)}">
        <div class="field-grid">${uniqueFields}</div>
        <div class="form-footer">
          ${link(cancel, 'Cancelar')}
          <button class="btn btn-primary" type="submit">Guardar</button>
        </div>
      </form>
    `;
  }
  const table = (headers, rows) => html`
    <div class="table-responsive">
      <table class="table-custom">
        <thead>
          <tr>
            ${headers
              .map(
                (h) => html`
                  <th scope="col">${esc(h)}</th>
                `
              )
              .join('')}
          </tr>
        </thead>
        <tbody>
          ${
            rows.length
              ? rows
                  .map(
                    (row) => html`
                      <tr>
                        ${row
                          .map(
                            (cell, i) => html`
                              <td data-label="${esc(headers[i])}">${cell}</td>
                            `
                          )
                          .join('')}
                      </tr>
                    `
                  )
                  .join('')
              : html`
                  <tr>
                    <td class="empty-state" colspan="${headers.length}">
                      No hay registros para mostrar.
                    </td>
                  </tr>
                `
          }
        </tbody>
      </table>
    </div>
  `;
  const metric = (n, label, tone) => html`
    <div class="metric-card tone-${tone}">
      <strong>${n}</strong>
      <span>${esc(label)}</span>
    </div>
  `;
  const details = (pairs) => html`
    <dl class="detail-grid">
      ${pairs
        .map(
          ([a, b]) => html`
            <div>
              <dt>${esc(a)}</dt>
              <dd>${esc(b ?? '—')}</dd>
            </div>
          `
        )
        .join('')}
    </dl>
  `;
  const photo = (e) =>
    /^(assets\/images\/[a-z0-9-]+\.jpg)$/.test(e.fotografia || '') ||
    /^data:image\/(jpeg|png|webp);base64,[a-zA-Z0-9+/=]+$/.test(e.fotografia || '')
      ? html`
          <img class="equipment-photo" src="${esc(e.fotografia)}" alt="${esc(e.nombre)}" />
        `
      : '<span class="device-symbol" aria-hidden="true">▣</span>';
  const notice = (text, error = false) => {
    const el = document.getElementById('message');
    el.innerHTML = html`
      <div
        class="alert ${error ? 'alert-danger' : 'alert-success'}"
        role="${error ? 'alert' : 'status'}"
      >
        ${esc(text)}
      </div>
    `;
    el.scrollIntoView({ block: 'nearest' });
  };
  const requireRow = (tableName) => {
    const row = find(tableName, params.get('id'));
    if (!row) throw Error('El registro solicitado ya no existe.');
    return row;
  };
  const isAdmin = () => Number(user?.rol_id) === 1;
  const isStaff = () => [1, 2].includes(Number(user?.rol_id));
  const isStudent = () => Number(user?.rol_id) === 3;
  function log(data, description, equipment = null) {
    data.actividad.push({
      id: store.next(data, 'actividad'),
      usuario_id: user.id,
      equipo_id: equipment,
      descripcion: description,
      fecha: new Date().toISOString()
    });
  }
  function saveRecord(data, tableName, values, id) {
    if (id) {
      const row = data[tableName].find((r) => String(r.id) === String(id));
      if (!row) throw Error('El registro ya no existe.');
      Object.assign(row, values);
      return row;
    }
    const row = { ...values, id: store.next(data, tableName) };
    data[tableName].push(row);
    return row;
  }
  function go(r, a = 'index', id = '') {
    const dest = url(r, a, id);
    if (location.hash === dest) render();
    else location.hash = dest;
  }
  function filters(fields) {
    return html`
      <form data-form="filters" class="filter-form">
        ${fields}
        <button class="btn btn-primary">Filtrar</button>
        ${link(route, 'Limpiar')}
      </form>
    `;
  }
  function matchingEquipment() {
    const q = (params.get('q') || '').toLowerCase();
    return db.equipos.filter(
      (e) =>
        (!q ||
          [
            e.codigo,
            e.nombre,
            e.marca,
            e.modelo,
            e.numero_serie,
            name('ubicaciones', e.ubicacion_id)
          ]
            .join(' ')
            .toLowerCase()
            .includes(q)) &&
        (!params.get('tipo_id') || String(e.tipo_id) === params.get('tipo_id')) &&
        (!params.get('estado') || status(e) === params.get('estado')) &&
        (!params.get('sede_id') ||
          String(find('ubicaciones', e.ubicacion_id)?.sede_id) === params.get('sede_id'))
    );
  }
  function summaryPanels() {
    const equipment = db.equipos.filter(
      (e) =>
        !params.get('sede_id') ||
        String(find('ubicaciones', e.ubicacion_id)?.sede_id) === params.get('sede_id')
    );
    const loans = db.prestamos.filter(
      (p) => !p.devuelto_en && equipment.some((e) => String(e.id) === String(p.equipo_id))
    );
    return html`
      <div class="metric-grid">
        ${metric(equipment.length, 'Equipos registrados', 'purple')}${metric(equipment.filter(available).length, 'Disponibles', 'green')}${metric(loans.length, 'Préstamos activos', 'amber')}${metric(equipment.filter((e) => e.estado === 'En Mantenimiento').length, 'En mantenimiento', 'red')}
      </div>
      <div class="panel-grid">
        <section class="surface">
          <h2>Equipos por categoría</h2>
          <div class="chart-list">
            ${db.tipos_equipo
              .map((t) => {
                const count = equipment.filter((e) => String(e.tipo_id) === String(t.id)).length;
                return html`
                  <div class="chart-line">
                    <span>${esc(t.nombre)}</span>
                    <progress max="${Math.max(1, equipment.length)}" value="${count}">
                      ${count}
                    </progress>
                    <b>${count}</b>
                  </div>
                `;
              })
              .join('')}
          </div>
        </section>
        <section class="surface">
          <h2>Próximas devoluciones</h2>
          ${table(
            ['Equipo', 'Fecha', 'Estado'],
            loans
              .sort((a, b) => a.fecha_devolucion.localeCompare(b.fecha_devolucion))
              .slice(0, 5)
              .map((p) => [
                esc(eqName(p.equipo_id)),
                esc(p.fecha_devolucion),
                badge(p.fecha_devolucion < today() ? 'Atrasado' : 'En curso')
              ])
          )}
        </section>
      </div>
    `;
  }
  function dashboard() {
    return view('modules/dashboard/index.html#contenido', {
      contenido: isStaff()
        ? link('equipos', 'Registrar equipo', 'create', '', 'btn btn-primary')
        : '',
      opciones_sede_id: selectOptions(db.sedes, params.get('sede_id')),
      limpiar: link(route, 'Limpiar'),
      summaryPanels: summaryPanels(),
      table: table(
        ['Actividad', 'Fecha'],
        db.actividad
          .slice(-8)
          .reverse()
          .map((a) => [esc(a.descripcion), esc(new Date(a.fecha).toLocaleString('es-SV'))])
      )
    });
  }
  function equipmentPage() {
    if (['create', 'edit'].includes(action)) {
      const e = action === 'edit' ? requireRow('equipos') : {};
      return view(
        'modules/equipos/' + (action === 'edit' ? 'edit' : 'create') + '.html#contenido',
        {
          titulo: esc(e.id ? 'Editar equipo' : 'Registrar equipo'),
          registro: esc(e.id),
          codigo: esc(e.codigo),
          nombre: esc(e.nombre),
          opciones_tipo_id: selectOptions(db.tipos_equipo, e.tipo_id),
          marca: esc(e.marca),
          modelo: esc(e.modelo),
          numero_serie: esc(e.numero_serie),
          opciones_ubicacion_id: selectOptions(db.ubicaciones, e.ubicacion_id),
          opciones_responsable_id: selectOptions(db.usuarios, e.responsable_id),
          opciones_estado: selectOptions(
            ['Activo', 'Inactivo', 'En Mantenimiento'],
            e.estado || 'Activo'
          ),
          fecha_adquisicion: esc(e.fecha_adquisicion),
          precio: esc(e.precio),
          proveedor: esc(e.proveedor),
          observaciones: esc(e.observaciones),
          contenido: e.fotografia
            ? '<p>Se conserva la fotografía actual si no seleccionas otra.</p>'
            : '',
          cancelar: link('equipos', 'Cancelar')
        }
      );
    }
    if (['view', 'photo'].includes(action)) {
      const e = requireRow('equipos');
      return view(
        'modules/equipos/' + (action === 'photo' ? 'photo' : 'view') + '.html#contenido',
        {
          titulo: esc(e.nombre),
          descripcion: esc(e.codigo),
          link: link('equipos', 'Editar', 'edit', e.id),
          link2: link('equipos', '← Inventario', 'index', '', 'back-link'),
          photo: photo(e),
          badge: badge(status(e)),
          details: details([
            ['Marca', e.marca],
            ['Modelo', e.modelo],
            ['Serie', e.numero_serie],
            ['Categoría', name('tipos_equipo', e.tipo_id)],
            ['Ubicación', name('ubicaciones', e.ubicacion_id)],
            ['Responsable', name('usuarios', e.responsable_id)],
            ['Adquisición', e.fecha_adquisicion],
            [
              'Precio',
              e.precio === null || e.precio === ''
                ? '—'
                : new Intl.NumberFormat('es-SV', {
                    style: 'currency',
                    currency: db.configuracion.moneda || 'USD'
                  }).format(Number(e.precio))
            ],
            ['Proveedor', e.proveedor]
          ]),
          esc: esc(e.observaciones || 'Sin observaciones.'),
          table: table(
            ['Persona', 'Salida', 'Devolución prevista', 'Devuelto'],
            db.prestamos
              .filter((p) => String(p.equipo_id) === String(e.id))
              .map((p) => [
                esc(name('usuarios', p.usuario_id)),
                esc(p.fecha_prestamo),
                esc(p.fecha_devolucion),
                esc(p.devuelto_en ? 'Sí' : 'No')
              ])
          ),
          table2: table(
            ['Descripción', 'Estado', 'Detalle'],
            db.reportes
              .filter((r) => String(r.equipo_id) === String(e.id))
              .map((r) => [
                esc(r.descripcion),
                esc(states[r.estado_id - 1]),
                link('reportes', 'Ver', 'view', r.id)
              ])
          )
        }
      );
    }
    const rows = matchingEquipment(),
      pages = Math.max(1, Math.ceil(rows.length / 20)),
      page = Math.max(1, Math.min(pages, Number(params.get('page')) || 1));
    return view('modules/equipos/index.html#contenido', {
      button: button('Exportar CSV', 'csv'),
      link: link('equipos', 'Registrar equipo', 'create', '', 'btn btn-primary'),
      q: esc(params.get('q')),
      opciones_tipo_id: selectOptions(db.tipos_equipo, params.get('tipo_id')),
      opciones_sede_id: selectOptions(db.sedes, params.get('sede_id')),
      opciones_estado: selectOptions(
        ['Activo', 'Inactivo', 'En Mantenimiento', 'Prestado'],
        params.get('estado')
      ),
      limpiar: link(route, 'Limpiar'),
      table: table(
        ['Equipo', 'Categoría', 'Ubicación', 'Estado', 'Acciones'],
        rows.slice((page - 1) * 20, page * 20).map((e) => [
          html`
            <div class="inventory-device">
              <div class="inventory-device-media">${photo(e)}</div>
              <div>
                <strong>${esc(e.nombre)}</strong>
                <small>${esc(e.codigo)}</small>
              </div>
            </div>
          `,
          esc(name('tipos_equipo', e.tipo_id)),
          esc(name('ubicaciones', e.ubicacion_id)),
          badge(status(e)),
          html`
            <div class="table-action">
              ${link('equipos', 'Ver', 'view', e.id)}${link('equipos', 'Editar', 'edit', e.id)}${isAdmin() ? button('Eliminar', 'delete-equipo', e.id) : ''}
            </div>
          `
        ])
      ),
      contenido: rows.length,
      page: page,
      pages: pages,
      contenido2: page > 1 ? button('Anterior', 'page', page - 1) : '',
      contenido3: page < pages ? button('Siguiente', 'page', page + 1) : ''
    });
  }
  function loansPage() {
    if (action === 'create')
      return view('modules/prestamos/create.html#contenido', {
        opciones_equipo_id: selectOptions(
          db.equipos.filter(available).map((e) => ({ id: e.id, nombre: eqName(e.id) })),
          ''
        ),
        opciones_usuario_id: selectOptions(
          db.usuarios.filter((u) => Number(u.rol_id) === 3 && Number(u.aprobado) === 1),
          ''
        ),
        fecha_prestamo: esc(today()),
        fecha_devolucion: esc(today()),
        cancelar: link(route, 'Cancelar')
      });
    const filter = params.get('estado');
    const rows = db.prestamos.filter(
      (p) =>
        !filter ||
        (filter === 'Devuelto'
          ? !!p.devuelto_en
          : !p.devuelto_en && (filter !== 'Atrasado' || p.fecha_devolucion < today()))
    );
    return view('modules/prestamos/index.html#contenido', {
      link: link('prestamos', 'Nuevo préstamo', 'create', '', 'btn btn-primary'),
      opciones_estado: selectOptions(['En curso', 'Atrasado', 'Devuelto'], filter),
      limpiar: link(route, 'Limpiar'),
      table: table(
        ['Equipo', 'Prestatario', 'Salida', 'Devolución prevista', 'Estado', 'Acciones'],
        rows
          .slice()
          .reverse()
          .map((p) => [
            esc(eqName(p.equipo_id)),
            esc(name('usuarios', p.usuario_id)),
            esc(p.fecha_prestamo),
            esc(p.fecha_devolucion),
            badge(
              p.devuelto_en ? 'Devuelto' : p.fecha_devolucion < today() ? 'Atrasado' : 'En curso'
            ),
            p.devuelto_en
              ? esc(p.devuelto_en.slice(0, 10))
              : button('Registrar devolución', 'return', p.id)
          ])
      )
    });
  }
  function locationsPage() {
    if (['create', 'edit'].includes(action)) {
      const l = action === 'edit' ? requireRow('ubicaciones') : {};
      return view(
        'modules/ubicaciones/' + (action === 'edit' ? 'edit' : 'create') + '.html#contenido',
        {
          titulo: esc(l.id ? 'Editar ubicación' : 'Nueva ubicación'),
          registro: esc(l.id),
          nombre: esc(l.nombre),
          opciones_sede_id: selectOptions(db.sedes, l.sede_id),
          tipo: esc(l.tipo || 'Aula'),
          descripcion: esc(l.descripcion),
          cancelar: link('ubicaciones', 'Cancelar')
        }
      );
    }
    return view('modules/ubicaciones/index.html#contenido', {
      link: link('ubicaciones', 'Nueva ubicación', 'create', '', 'btn btn-primary'),
      contenido: db.sedes
        .map(
          (s) => html`
            <div class="site-card tone-blue">
              <div>
                <strong>${esc(s.nombre)}</strong>
                <span>
                  ${db.ubicaciones.filter((l) => String(l.sede_id) === String(s.id)).length}
                  espacios
                </span>
              </div>
            </div>
          `
        )
        .join(''),
      table: table(
        ['Ubicación', 'Sede', 'Equipos', 'Disponibles', 'Mantenimiento', 'Acciones'],
        db.ubicaciones.map((l) => {
          const eq = db.equipos.filter((e) => String(e.ubicacion_id) === String(l.id));
          return [
            esc(l.nombre),
            esc(name('sedes', l.sede_id)),
            eq.length,
            eq.filter(available).length,
            eq.filter((e) => e.estado === 'En Mantenimiento').length,
            html`
              <div class="table-action">
                ${link('ubicaciones', 'Editar', 'edit', l.id)}${isAdmin() ? button('Eliminar', 'delete-ubicacion', l.id) : ''}
              </div>
            `
          ];
        })
      )
    });
  }
  function reportsPage(maintenance = false) {
    if (action === 'create' && !params.get('id'))
      return view(
        'modules/' + (maintenance ? 'mantenimiento' : 'reportes') + '/create.html#contenido',
        {
          opciones_equipo_id: selectOptions(
            db.equipos
              .filter(
                (e) =>
                  ['Activo', 'En Mantenimiento'].includes(e.estado) &&
                  !activeLoan(e.id) &&
                  !openReport(e.id)
              )
              .map((e) => ({ id: e.id, nombre: eqName(e.id) })),
            ''
          ),
          cancelar: link(route, 'Cancelar')
        }
      );
    if (['view', 'assign', 'edit'].includes(action) || (action === 'create' && params.get('id'))) {
      const r = requireRow('reportes');
      if (!isStaff() && String(r.usuario_id) !== String(user.id))
        throw Error('Este reporte pertenece a otro perfil.');
      const m = db.mantenimientos.find((m) => String(m.reporte_id) === String(r.id)) || {};
      return view(
        maintenance
          ? 'modules/mantenimiento/assign.html#contenido'
          : 'modules/reportes/view.html#contenido',
        {
          descripcion: esc(eqName(r.equipo_id)),
          badge: badge(states[r.estado_id - 1]),
          details: details([
            ['Descripción', r.descripcion],
            ['Reportado por', name('usuarios', r.usuario_id)],
            ['Fecha', r.fecha_reporte],
            ['Técnico', name('usuarios', m.tecnico_id)],
            ['Diagnóstico', m.diagnostico],
            ['Solución', m.solucion]
          ]),
          contenido:
            isStaff() && Number(r.estado_id) !== 5
              ? html`
                  <section class="surface">
                    <h2>Seguimiento de mantenimiento</h2>
                    ${form(
                      'mantenimiento',
                      select(
                        'tecnico_id',
                        'Técnico responsable',
                        db.usuarios.filter(
                          (u) => Number(u.rol_id) !== 3 && Number(u.aprobado) === 1
                        ),
                        m.tecnico_id || user.id,
                        true
                      ) +
                        select(
                          'estado_id',
                          'Estado',
                          states.map((s, i) => ({ id: i + 1, nombre: s })),
                          r.estado_id,
                          true
                        ) +
                        area('diagnostico', 'Diagnóstico', m.diagnostico) +
                        area('solucion', 'Solución (obligatoria al finalizar)', m.solucion),
                      route,
                      r.id
                    )}
                  </section>
                `
              : ''
        }
      );
    }
    const rows = db.reportes.filter(
      (r) =>
        (isStaff() || String(r.usuario_id) === String(user.id)) &&
        (!params.get('estado_id') || String(r.estado_id) === params.get('estado_id')) &&
        (!params.get('desde') || r.fecha_reporte.slice(0, 10) >= params.get('desde')) &&
        (!params.get('hasta') || r.fecha_reporte.slice(0, 10) <= params.get('hasta'))
    );
    return view(
      'modules/' + (maintenance ? 'mantenimiento' : 'reportes') + '/index.html#contenido',
      {
        titulo: esc(maintenance ? 'Mantenimiento' : 'Reportes de fallas'),
        descripcion: esc(
          maintenance ? 'Diagnóstico, reparación y cierre' : 'Registro y seguimiento de incidencias'
        ),
        link: link(route, 'Reportar falla', 'create', '', 'btn btn-primary'),
        opciones_estado_id: selectOptions(
          states.map((s, i) => ({ id: i + 1, nombre: s })),
          params.get('estado_id')
        ),
        desde: esc(params.get('desde')),
        hasta: esc(params.get('hasta')),
        limpiar: link(route, 'Limpiar'),
        table: table(
          ['Equipo', 'Falla', 'Fecha', 'Estado', 'Acciones'],
          rows
            .slice()
            .reverse()
            .map((r) => [
              esc(eqName(r.equipo_id)),
              esc(r.descripcion),
              esc(r.fecha_reporte.slice(0, 10)),
              badge(states[r.estado_id - 1]),
              link(route, 'Ver seguimiento', 'view', r.id)
            ])
        )
      }
    );
  }
  function userFields(u) {
    return (
      field('nombre', 'Nombre', u.nombre, 'text', true) +
      field('email', 'Correo', u.email, 'email', true) +
      field('telefono', 'Teléfono', u.telefono, 'tel') +
      field('cargo', 'Cargo', u.cargo) +
      select('sede_id', 'Sede', db.sedes, u.sede_id) +
      select(
        'apariencia',
        'Densidad de la interfaz',
        [
          { id: 'claro', nombre: 'Cómoda' },
          { id: 'compacto', nombre: 'Compacta' }
        ],
        u.apariencia || 'claro',
        true
      )
    );
  }
  function usersPage() {
    if (['create', 'edit'].includes(action)) {
      const u = action === 'edit' ? requireRow('usuarios') : {};
      return view(
        'modules/usuarios/' + (action === 'edit' ? 'edit' : 'create') + '.html#contenido',
        {
          titulo: esc(u.id ? 'Editar usuario' : 'Nuevo usuario'),
          registro: esc(u.id),
          userFields: userFields(u),
          passwordFields: passwordFields(u),
          opciones_rol_id: selectOptions(
            roles.map((nombre, i) => ({ id: i + 1, nombre })),
            u.rol_id || 3
          ),
          cancelar: link('usuarios', 'Cancelar')
        }
      );
    }
    return view('modules/usuarios/index.html#contenido', {
      link: link('usuarios', 'Nuevo usuario', 'create', '', 'btn btn-primary'),
      table: table(
        ['Nombre', 'Correo', 'Rol', 'Acceso', 'Acciones'],
        db.usuarios.map((u) => [
          esc(u.nombre),
          esc(u.email),
          esc(roles[u.rol_id - 1]),
          Number(u.aprobado) ? 'Aprobado' : 'Pendiente / suspendido',
          html`
            <div class="table-action">
              ${link('usuarios', 'Editar', 'edit', u.id)}${String(u.id) !== String(user.id) ? button(Number(u.aprobado) ? 'Suspender acceso' : 'Aprobar acceso', Number(u.aprobado) ? 'suspend-user' : 'approve-user', u.id) + button('Eliminar', 'delete-usuario', u.id) : ''}
            </div>
          `
        ])
      )
    });
  }
  function settingsPage() {
    const tab = params.get('tab') || 'general';
    const tabs = [
      ['general', 'Mi instituto'],
      ['usuarios', 'Usuarios y roles'],
      ['categorias', 'Categorías'],
      ['sedes', 'Sedes'],
      ['respaldo', 'Respaldos']
    ];
    const menu = view('modules/configuracion/index.html#navegacion', {
      contenido: tabs
        .map(
          ([key, label]) => html`
            <a
              href="#/configuracion/index?tab=${key}"
              class="${key === tab ? 'active' : ''}"
              ${key === tab ? 'aria-current="page"' : ''}
            >
              ${label}
            </a>
          `
        )
        .join('')
    });
    let content = '';

    if (tab === 'general') {
      content =
        html`
          <section class="surface spaced">
            <h2>Mi instituto</h2>
            <p>Comparte este código con tus estudiantes y técnicos para que soliciten acceso:</p>
            <p><strong id="institute-code">${esc(db.instituto.codigo)}</strong></p>
            <p>
              Aprueba las solicitudes en Usuarios. Cada administrador que se registra crea un
              instituto independiente.
            </p>
            ${form('configuracion', field('institucion', 'Nombre del instituto', db.configuracion.institucion, 'text', true, 'maxlength="100"'), 'configuracion')}
          </section>
        ` +
        view('modules/configuracion/index.html#apariencia', {
          details: details([
            ['Usuarios', db.usuarios.length],
            ['Equipos', db.equipos.length],
            ['Sedes', db.sedes.length],
            ['Categorías', db.tipos_equipo.length]
          ]),
          link: link('perfil', 'Editar mi perfil')
        });
    } else if (tab === 'usuarios') {
      content = view('modules/configuracion/index.html#usuarios', {
        link: link('usuarios', 'Administrar usuarios', 'index', '', 'btn btn-primary'),
        table: table(
          ['Rol', 'Acceso'],
          [
            ['Administrador', 'Configuración, usuarios y gestión completa del inventario.'],
            [
              'Técnico',
              'Consulta fallas de su instituto y atiende reparaciones. Sin acceso a usuarios, préstamos ni inventario general.'
            ],
            ['Estudiante', 'Consulta sus préstamos y reporta fallas de los equipos prestados.']
          ]
        )
      });
    } else if (tab === 'categorias' || tab === 'sedes') {
      const categories = tab === 'categorias';
      const collection = categories ? 'tipos_equipo' : 'sedes';
      const type = categories ? 'categoria' : 'sede';
      const record = find(collection, params.get('id')) || {};
      content = view('modules/configuracion/index.html#catalogos', {
        contenido: categories ? 'Categorías de equipos' : 'Sedes registradas',
        table: table(
          ['Nombre', 'Acciones'],
          db[collection].map((row) => [
            esc(row.nombre),
            html`
              <div class="table-action">
                <a class="btn btn-light" href="#/configuracion/index?tab=${tab}&id=${row.id}">
                  Editar
                </a>
                ${button('Eliminar', 'delete-' + type, row.id)}
              </div>
            `
          ])
        ),
        contenido2: record.id ? 'Editar' : 'Agregar',
        contenido3: categories ? 'categoría' : 'sede',
        valor: esc(type),
        registro: esc(record.id),
        nombre: esc(record.nombre),
        contenido4: categories
          ? ''
          : field('direccion', 'Dirección', record.direccion, 'text', false, 'maxlength="255"'),
        cancelar: link('configuracion', 'Cancelar')
      });
    } else if (tab === 'respaldo') {
      content = view('modules/configuracion/index.html#respaldos', {
        button: button('Descargar respaldo JSON', 'backup', '', 'btn btn-primary')
      });
    } else {
      content = '<p class="empty-state">Selecciona una sección de configuración.</p>';
    }

    return (
      title('Configuración', 'Administra tu institución y las preferencias del sistema') +
      menu +
      content
    );
  }
  function statsPage() {
    return view('modules/estadisticas/index.html#contenido', {
      button: button('Exportar inventario CSV', 'csv'),
      button2: button('Imprimir / guardar PDF', 'print'),
      opciones_sede_id: selectOptions(db.sedes, params.get('sede_id')),
      limpiar: link(route, 'Limpiar'),
      summaryPanels: summaryPanels(),
      table: table(
        ['Código', 'Equipo', 'Estado', 'Ubicación'],
        matchingEquipment().map((e) => [
          esc(e.codigo),
          esc(e.nombre),
          esc(status(e)),
          esc(name('ubicaciones', e.ubicacion_id))
        ])
      )
    });
  }
  function render() {
    try {
      db = store.read();
      user = auth.currentUser(db);
      const [path, query = ''] = (
        location.hash.slice(1) ||
        '/' + (document.body.dataset.page || 'dashboard/index') + location.search
      ).split('?');
      [route = 'dashboard', action = 'index'] = path.split('/').filter(Boolean);
      params = new URLSearchParams(query);
      if (!user) {
        renderLogin();
        window.dispatchEvent(new Event('inventic:render'));
        return;
      }
      if (route === 'login') {
        go('dashboard');
        return;
      }
      if (route === 'logout') {
        auth.signOut().then(() => go('login'));
        return;
      }
      if (db.scope === 'pending') {
        renderPending();
        window.dispatchEvent(new Event('inventic:render'));
        return;
      }
      if (db.scope === 'technician') {
        renderTechnician();
        window.dispatchEvent(new Event('inventic:render'));
        return;
      }
      if (isStudent()) {
        renderStudent();
        window.dispatchEvent(new Event('inventic:render'));
        return;
      }
      if (
        (['configuracion', 'usuarios'].includes(route) && !isAdmin()) ||
        (['equipos', 'prestamos', 'ubicaciones', 'mantenimiento', 'estadisticas'].includes(route) &&
          !isStaff())
      )
        throw Error('Este perfil no tiene esta vista habilitada. Cambia de perfil para continuar.');
      const views = {
        dashboard,
        equipos: equipmentPage,
        prestamos: loansPage,
        ubicaciones: locationsPage,
        reportes: () => reportsPage(false),
        mantenimiento: () => reportsPage(true),
        usuarios: usersPage,
        configuracion: settingsPage,
        estadisticas: statsPage,
        perfil: () =>
          view('modules/perfil/index.html#contenido', {
            esc: esc(user.nombre.slice(0, 1)),
            esc2: esc(user.nombre),
            esc3: esc(roles[user.rol_id - 1]),
            registro: esc(user.id),
            userFields: userFields(user),
            passwordFields: passwordFields(user),
            cancelar: link('dashboard', 'Cancelar')
          })
      };
      if (!views[route]) throw Error('La página solicitada no existe.');
      document.body.classList.toggle('density-compact', user.apariencia === 'compacto');
      document.title =
        (navigation.find((n) => n[0] === route)?.[1] || 'InventIC') +
        ' · ' +
        db.configuracion.nombre;
      const content = views[route]();
      document.getElementById('app').innerHTML = html`
        <div id="wrapper">
          <aside id="sidebar-wrapper">
            <a class="sidebar-brand" href="#/dashboard/index">
              <img class="sidebar-logo" src="assets/logo.svg" alt="Logo InventIC" />
              <div>
                ${esc(db.configuracion.nombre)}
                <span>${esc(db.configuracion.institucion)}</span>
              </div>
            </a>
            <nav class="sidebar-nav" aria-label="Navegación principal">
              ${navigation
                .filter(
                  (n) =>
                    (isStaff() || ['dashboard', 'reportes'].includes(n[0])) &&
                    (isAdmin() || n[0] !== 'configuracion')
                )
                .map(
                  ([r, t, i]) => html`
                    <a
                      class="list-group-item-sidebar ${r === route ? 'active' : ''}"
                      ${r === route ? 'aria-current="page"' : ''}
                      href="${url(r)}"
                    >
                      <i aria-hidden="true">${i}</i>
                      ${t}
                    </a>
                  `
                )
                .join('')}
            </nav>
            <div class="sidebar-account">
              <a href="#/perfil/index">
                <span class="avatar avatar-small">${esc(user.nombre.slice(0, 1))}</span>
                <span>
                  <strong>${esc(user.nombre)}</strong>
                  <small>${esc(roles[user.rol_id - 1])}</small>
                </span>
              </a>
              ${button('Cerrar sesión', 'logout')}
            </div>
          </aside>
          <div id="page-content-wrapper">
            <div class="mobile-topbar">
              <button
                class="btn btn-light"
                data-action="menu"
                aria-controls="sidebar-wrapper"
                aria-expanded="false"
              >
                ☰ Menú
              </button>
              <strong>${esc(db.configuracion.nombre)}</strong>
            </div>
            <main class="p-content" id="main-content" tabindex="-1">
              <p class="local-notice">
                <span class="local-tag">Conectado</span>
                · ${esc(db.configuracion.institucion)}
              </p>
              <div id="message" aria-live="polite"></div>
              ${content}
            </main>
          </div>
        </div>
      `;
      window.dispatchEvent(new Event('inventic:render'));
    } catch (error) {
      document.getElementById('app').innerHTML = html`
        <main class="surface login-card">
          <h1>InventIC</h1>
          <div id="message"><p role="alert">${esc(error.message)}</p></div>
          <a class="btn btn-primary" href="#/login/index">Volver al acceso local</a>
        </main>
      `;
    }
  }
  function passwordFields(account) {
    let fields = '';
    if (account.id && String(account.id) === String(user.id)) {
      fields += field(
        'current_password',
        'Contraseña actual (para cambiarla)',
        '',
        'password',
        false,
        'autocomplete="current-password"'
      );
    }
    fields += field(
      'new_password',
      account.id ? 'Nueva contraseña (opcional)' : 'Contraseña',
      '',
      'password',
      !account.id,
      'minlength="8" maxlength="128" autocomplete="new-password"'
    );
    fields += field(
      'confirmation',
      'Confirmar contraseña',
      '',
      'password',
      !account.id,
      'minlength="8" maxlength="128" autocomplete="new-password"'
    );
    return fields;
  }

  function portalHeader(heading, description) {
    return (
      title(
        heading,
        description,
        button('Actualizar', 'student-refresh') + button('Cerrar sesión', 'logout')
      ) + '<div id="message" aria-live="polite"></div>'
    );
  }
  function renderPending() {
    document.title = 'Acceso pendiente · InventIC';
    document.getElementById('app').innerHTML = html`
      <main class="p-content" id="main-content">
        ${portalHeader('Acceso pendiente', db.configuracion.institucion)}
        <section class="surface">
          <h2>Hola, ${esc(user.nombre)}</h2>
          <p>
            Tu cuenta de ${esc(roles[user.rol_id - 1].toLowerCase())} está registrada. El director
            debe aprobar tu acceso al instituto.
          </p>
          <p>
            Si tu acceso fue suspendido, comunícate con el director. Cuando te autorice, pulsa
            Actualizar.
          </p>
        </section>
      </main>
    `;
  }
  function renderTechnician() {
    document.title = 'Fallas y reparaciones · InventIC';
    document.getElementById('app').innerHTML = html`
      <main class="p-content" id="main-content">
        ${portalHeader('Fallas y reparaciones', db.configuracion.institucion + ' · ' + user.nombre)}
        <section class="surface">
          <p>
            Atiende las fallas de tu instituto. Al guardar una falla sin asignar, la reparación
            quedará a tu cargo.
          </p>
          <p>El administrador debe recibir el equipo antes de iniciar la reparación.</p>
        </section>
        ${
          db.reportes.length
            ? db.reportes
                .map(
                  (report) => html`
                    <section class="surface spaced">
                      <h2>${esc(report.codigo)} · ${esc(report.nombre)}</h2>
                      ${badge(states[report.estado_id - 1])}
                      <p>${esc(report.descripcion)}</p>
                      <p>Reportado: ${esc(report.fecha_reporte)}</p>
                      ${
                        Number(report.estado_id) >= 4
                          ? details([
                              ['Diagnóstico', report.diagnostico],
                              ['Solución', report.solucion],
                              ['Finalizado', report.fecha_fin]
                            ])
                          : Number(report.prestado)
                            ? '<p>Pendiente de devolución: el administrador debe recibir el equipo.</p>'
                            : report.tecnico_id && Number(report.tecnico_id) !== Number(user.id)
                              ? '<p>Esta reparación está asignada a otro técnico.</p>'
                              : form(
                                  'technician-repair',
                                  select(
                                    'estado_id',
                                    'Estado',
                                    states.slice(1, 4).map((nombre, i) => ({ id: i + 2, nombre })),
                                    Number(report.estado_id) === 1 ? 2 : report.estado_id,
                                    true
                                  ) +
                                    area('diagnostico', 'Diagnóstico', report.diagnostico) +
                                    area(
                                      'solucion',
                                      'Solución (obligatoria al finalizar)',
                                      report.solucion
                                    ),
                                  'dashboard',
                                  report.id
                                )
                      }
                    </section>
                  `
                )
                .join('')
            : '<section class="surface spaced"><p>No hay fallas reportadas en tu instituto.</p></section>'
        }
      </main>
    `;
  }
  let studentClockOffset = 0;
  let studentSnapshot;
  function updateLoanTimers() {
    document.querySelectorAll('[data-loan-deadline]').forEach((element) => {
      const left = Date.parse(element.dataset.loanDeadline) - (Date.now() + studentClockOffset);
      const minutes = Math.max(0, Math.ceil(left / 60000));
      const days = Math.floor(minutes / 1440);
      const hours = Math.floor((minutes % 1440) / 60);
      element.textContent =
        left <= 0
          ? 'Plazo vencido: contacta al administrador'
          : `${days} días, ${hours} horas y ${minutes % 60} minutos`;
    });
  }
  setInterval(updateLoanTimers, 30000);

  function renderStudent() {
    if (studentSnapshot !== db.serverTime) {
      studentClockOffset = Date.parse(db.serverTime) - Date.now();
      studentSnapshot = db.serverTime;
    }
    document.title = 'Mis préstamos · InventIC';
    document.body.classList.remove('density-compact');
    const active = db.prestamos.filter((loan) => !loan.devuelto_en);
    const reportable = active.filter((loan) => !Number(loan.falla_abierta));
    document.getElementById('app').innerHTML = html`
      <main class="p-content" id="main-content" tabindex="-1">
        <header class="page-title-box">
          <div>
            <span class="eyebrow">
              ${esc(db.configuracion.institucion)} · PORTAL DE ESTUDIANTES
            </span>
            <h1 class="page-title">Mis préstamos</h1>
            <p>
              Hola, ${esc(user.nombre)}. Aquí puedes consultar tus equipos y reportar una falla.
            </p>
          </div>
          <div class="page-actions">
            ${button('Actualizar', 'student-refresh')}${button('Cerrar sesión', 'logout')}
          </div>
        </header>
        <div id="message" aria-live="polite"></div>
        <section class="surface">
          <h2>Equipos que tienes prestados</h2>
          <p>El plazo termina a las 23:59 de la fecha de devolución, hora de El Salvador.</p>
          ${
            active.length
              ? active
                  .map(
                    (loan) => html`
                      <article class="surface spaced">
                        <h3>${esc(loan.codigo)} · ${esc(loan.nombre)}</h3>
                        <p>${esc(loan.marca)} ${esc(loan.modelo)}</p>
                        <p>
                          Prestado: ${esc(loan.fecha_prestamo)} · Devolución:
                          ${esc(loan.fecha_devolucion)}
                        </p>
                        <p>
                          <strong>Tiempo restante:</strong>
                          <span data-loan-deadline="${esc(loan.vence_en)}"></span>
                        </p>
                        ${Number(loan.falla_abierta) ? '<p>Este equipo tiene una falla abierta. El administrador le dará seguimiento.</p>' : '<a class="btn btn-primary" href="#student-fault">Reportar una falla</a>'}
                      </article>
                    `
                  )
                  .join('')
              : '<p>No tienes préstamos activos. El administrador debe asignarte uno usando tu cuenta.</p>'
          }
        </section>
        <section class="surface spaced" id="student-fault">
          <h2>Reportar una falla</h2>
          ${
            reportable.length
              ? html`
                  <form data-form="student-report">
                    ${select(
                      'prestamo_id',
                      'Equipo prestado',
                      reportable.map((loan) => ({
                        id: loan.id,
                        nombre: `${loan.codigo} · ${loan.nombre}`
                      })),
                      reportable.length === 1 ? reportable[0].id : '',
                      true
                    )}
                    <div class="field">
                      <label for="descripcion">Describe la falla *</label>
                      <textarea
                        class="form-control"
                        id="descripcion"
                        name="descripcion"
                        required
                        maxlength="4000"
                      ></textarea>
                    </div>
                    <button class="btn btn-primary" type="submit">Enviar falla</button>
                  </form>
                `
              : '<p>Necesitas un préstamo activo sin una falla pendiente para enviar un reporte.</p>'
          }
        </section>
        <section class="surface spaced">
          <h2>Mis reportes</h2>
          ${table(
            ['Equipo', 'Falla', 'Fecha', 'Estado'],
            db.reportes.map((report) => [
              esc(`${report.codigo} · ${report.nombre}`),
              esc(report.descripcion),
              esc(report.fecha_reporte),
              badge(states[report.estado_id - 1])
            ])
          )}
        </section>
        <section class="surface spaced">
          <h2>Préstamos devueltos</h2>
          ${table(
            ['Equipo', 'Devolución'],
            db.prestamos
              .filter((loan) => loan.devuelto_en)
              .map((loan) => [esc(`${loan.codigo} · ${loan.nombre}`), esc(loan.devuelto_en)])
          )}
        </section>
      </main>
    `;
    updateLoanTimers();
  }

  function renderLogin() {
    const setup = action === 'register';
    document.body.classList.remove('density-compact');
    document.title = setup ? 'Crear cuenta · InventIC' : 'Iniciar sesión · InventIC';
    document.getElementById('app').innerHTML = view('auth/login.html#contenido', {
      opcionesAcceso: html`
        <a class="btn ${setup ? 'btn-light' : 'btn-primary'}" href="#/login/signin">
          Iniciar sesión
        </a>
        <a class="btn ${setup ? 'btn-primary' : 'btn-light'}" href="#/login/register">
          Crear cuenta
        </a>
      `,
      nombreSistema: esc(db.configuracion.nombre),
      institucion: esc(db.configuracion.institucion),
      tituloAcceso: setup ? 'Crea tu cuenta' : 'Iniciar sesión',
      instrucciones: setup
        ? 'Elige tu rol. Si diriges un instituto, crea su espacio; si eres estudiante o técnico, solicita acceso con el código de tu director.'
        : 'Ingresa tu correo y contraseña para continuar.',
      tipoFormulario: setup ? 'register' : 'login',
      camposRegistro: setup
        ? select(
            'rol_id',
            'Soy',
            [
              { id: 1, nombre: 'Administrador / director' },
              { id: 2, nombre: 'Técnico' },
              { id: 3, nombre: 'Estudiante' }
            ],
            '',
            true
          ) +
          html`
            <div id="register-institute" hidden>
              ${field('institucion', 'Nombre de tu instituto', '', 'text', false, 'maxlength="100" disabled')}
              <p>Crearás un instituto vacío y serás su administrador.</p>
            </div>
            <div id="register-code" hidden>
              ${field('codigo', 'Código del instituto', '', 'text', false, 'maxlength="32" autocomplete="off" disabled')}
              <p>Pide el código al director. Tu cuenta quedará pendiente de su aprobación.</p>
            </div>
          `
        : '',
      campoNombre: setup
        ? field(
            'nombre',
            'Nombre completo',
            '',
            'text',
            true,
            'maxlength="100" autocomplete="name"'
          )
        : '',
      autocompletar: setup ? 'new-password' : 'current-password',
      confirmacion: setup
        ? field(
            'confirmation',
            'Confirmar contraseña',
            '',
            'password',
            true,
            'minlength="8" maxlength="128" autocomplete="new-password"'
          )
        : '',
      textoBoton: setup ? 'Crear cuenta' : 'Iniciar sesión',
      ayuda: setup
        ? 'Usa una contraseña de al menos 8 caracteres.'
        : 'Si olvidaste tu contraseña, solicita el cambio al administrador.'
    });
  }
  document.addEventListener('change', (event) => {
    if (!event.target.matches('form[data-form="register"] [name="rol_id"]')) return;
    const role = Number(event.target.value);
    for (const [id, visible] of [
      ['register-institute', role === 1],
      ['register-code', [2, 3].includes(role)]
    ]) {
      const group = document.getElementById(id);
      group.hidden = !visible;
      group.querySelector('input').disabled = !visible;
      group.querySelector('input').required = visible;
    }
  });
  function download(filename, content, type) {
    const blob = new Blob([content], { type });
    const href = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = href;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(href), 1000);
  }
  async function readPhoto(file) {
    if (!file?.size) return undefined;
    if (
      file.size > 3 * 1024 * 1024 ||
      !['image/jpeg', 'image/png', 'image/webp'].includes(file.type)
    )
      throw Error('Usa una imagen JPG, PNG o WebP de hasta 3 MB.');
    const source = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = source;
      await img.decode();
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, 640 / img.width, 640 / img.height);
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
      return canvas.toDataURL('image/jpeg', 0.8);
    } catch {
      throw Error('No se pudo leer la imagen seleccionada.');
    } finally {
      URL.revokeObjectURL(source);
    }
  }
  document.addEventListener('submit', async (event) => {
    const target = event.target.closest('form[data-form]');
    if (!target) return;
    event.preventDefault();
    if (target.dataset.busy === 'true') return;
    target.dataset.busy = 'true';
    const submitButton = target.querySelector('button[type="submit"], button:not([type])');
    if (submitButton) submitButton.disabled = true;
    const kind = target.dataset.form,
      id = target.dataset.id;
    const data = new FormData(target),
      values = Object.fromEntries(
        [...data]
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [k, k.includes('password') || k === 'confirmation' ? v : v.trim()])
      );
    try {
      if (['login', 'setup', 'register'].includes(kind)) {
        await auth.signIn(values, kind);
        await store.load();
        go('dashboard');
        return;
      }
      if (!auth.currentUser(store.read())) throw Error('Inicia sesión para continuar.');
      if (kind === 'student-report') {
        await window.InventicApi.request('student/reports', 'POST', values);
        await store.load();
        render();
        notice('Falla enviada. El administrador puede consultarla en Reportes de fallas.');
        return;
      }
      if (kind === 'technician-repair') {
        await window.InventicApi.request('technician/repairs', 'POST', {
          ...values,
          reporte_id: id
        });
        await store.load();
        render();
        notice('Reparación actualizada correctamente.');
        return;
      }
      if (kind === 'filters') {
        const p = new URLSearchParams(Object.entries(values).filter(([, v]) => v));
        location.hash = `/${route}/index?${p}`;
        return;
      }
      if (kind === 'import') {
        const file = data.get('backup');
        if (!file?.size || file.size > 20 * 1024 * 1024)
          throw Error('Selecciona un respaldo JSON de hasta 20 MB.');
        const imported = store.validate(JSON.parse(await file.text()));
        if (
          !confirm(
            '¿Reemplazar los registros de MySQL con este respaldo? Descarga antes una copia de tus datos actuales.'
          )
        )
          return;
        await store.write(imported, true);
        await auth.signOut();
        go('login');
        return;
      }
      const photograph = kind === 'equipo' ? await readPhoto(data.get('fotografia')) : undefined;
      db = await store.change((current) => {
        db = current;
        if (kind === 'equipo') {
          if (photograph !== undefined) values.fotografia = photograph;
          const previous = id ? find('equipos', id) : null;
          if (previous && openReport(id) && values.estado !== 'En Mantenimiento')
            throw Error('Finaliza primero el reporte de mantenimiento.');
          if (previous && activeLoan(id) && values.estado !== 'Activo')
            throw Error('Registra primero la devolución del préstamo.');
          if (
            values.precio &&
            (!Number.isFinite(Number(values.precio)) || Number(values.precio) < 0)
          )
            throw Error('Precio inválido.');
          const record = saveRecord(current, 'equipos', values, id);
          log(current, `${id ? 'Actualizó' : 'Registró'} el equipo ${record.codigo}`, record.id);
        } else if (kind === 'ubicacion') {
          saveRecord(current, 'ubicaciones', values, id);
          log(current, 'Guardó una ubicación');
        } else if (kind === 'usuario' || kind === 'perfil') {
          saveRecord(current, 'usuarios', values, id);
          log(current, 'Actualizó un perfil local');
        } else if (kind === 'prestamo') {
          const equipment = find('equipos', values.equipo_id);
          if (!equipment || !available(equipment)) throw Error('El equipo ya no está disponible.');
          saveRecord(current, 'prestamos', {
            ...values,
            registrado_por: user.id,
            devuelto_en: null
          });
          log(current, 'Registró un préstamo', equipment.id);
        } else if (kind === 'reporte') {
          const e = find('equipos', values.equipo_id);
          if (
            !e ||
            !['Activo', 'En Mantenimiento'].includes(e.estado) ||
            activeLoan(e.id) ||
            openReport(e.id)
          )
            throw Error('El equipo no admite una nueva falla.');
          if (!values.descripcion) throw Error('Describe la falla.');
          e.estado = 'En Mantenimiento';
          saveRecord(current, 'reportes', {
            ...values,
            estado_id: 1,
            usuario_id: user.id,
            fecha_reporte: new Date().toISOString()
          });
          log(current, 'Reportó una falla', e.id);
        } else if (kind === 'mantenimiento') {
          const r = find('reportes', id);
          if (!r || Number(r.estado_id) === 5)
            throw Error('El reporte está cerrado o ya no existe.');
          const finish = Number(values.estado_id) >= 4;
          if (finish && !values.solucion) throw Error('Indica la solución antes de finalizar.');
          if (
            !finish &&
            (activeLoan(r.equipo_id) ||
              current.reportes.some(
                (other) =>
                  String(other.id) !== String(r.id) &&
                  String(other.equipo_id) === String(r.equipo_id) &&
                  Number(other.estado_id) < 4
              ))
          )
            throw Error('El equipo está prestado o tiene otra falla abierta.');
          const technician = find('usuarios', values.tecnico_id);
          if (!technician || Number(technician.rol_id) === 3)
            throw Error('Selecciona un técnico o administrador.');
          r.estado_id = Number(values.estado_id);
          const m = current.mantenimientos.find((m) => String(m.reporte_id) === String(id));
          saveRecord(
            current,
            'mantenimientos',
            {
              reporte_id: r.id,
              tecnico_id: values.tecnico_id,
              diagnostico: values.diagnostico,
              solucion: values.solucion,
              fecha_inicio: m?.fecha_inicio || new Date().toISOString(),
              fecha_fin: finish ? m?.fecha_fin || new Date().toISOString() : null
            },
            m?.id
          );
          find('equipos', r.equipo_id).estado = openReport(r.equipo_id)
            ? 'En Mantenimiento'
            : 'Activo';
          log(current, 'Actualizó mantenimiento', r.equipo_id);
        } else if (kind === 'configuracion') {
          Object.assign(current.configuracion, values);
        } else if (kind === 'categoria') {
          saveRecord(current, 'tipos_equipo', values, id);
        } else if (kind === 'sede') {
          saveRecord(current, 'sedes', values, id);
        } else throw Error('Formulario desconocido.');
      });
      if (['equipo', 'ubicacion', 'usuario', 'prestamo', 'reporte'].includes(kind)) go(route);
      else {
        render();
        notice('Cambios guardados correctamente.');
      }
    } catch (error) {
      db = store.read();
      notice(error.message, true);
    } finally {
      target.dataset.busy = 'false';
      if (submitButton) submitButton.disabled = false;
    }
  });
  document.addEventListener('click', async (event) => {
    const el = event.target.closest('[data-action]');
    if (!el) return;
    const act = el.dataset.action,
      id = el.dataset.id;
    try {
      if (act === 'menu') {
        const open = document.getElementById('sidebar-wrapper').classList.toggle('is-open');
        el.setAttribute('aria-expanded', String(open));
        return;
      }
      if (act === 'logout') {
        await auth.signOut();
        go('login');
        return;
      }
      if (act === 'student-refresh') {
        await store.load();
        render();
        return;
      }
      if (['approve-user', 'suspend-user'].includes(act)) {
        await window.InventicApi.request('institute/approval', 'POST', {
          usuario_id: id,
          aprobado: act === 'approve-user' ? 1 : 0
        });
        await store.load();
        render();
        notice(act === 'approve-user' ? 'Acceso aprobado.' : 'Acceso suspendido.');
        return;
      }
      if (act === 'toggle-password') {
        const input = document.getElementById('password');
        const visible = input.type === 'password';
        input.type = visible ? 'text' : 'password';
        el.textContent = visible ? 'Ocultar contraseña' : 'Mostrar contraseña';
        el.setAttribute('aria-pressed', String(visible));
        return;
      }
      if (act === 'page') {
        params.set('page', id);
        location.hash = `/${route}/index?${params}`;
        return;
      }
      if (act === 'print') {
        window.print();
        return;
      }
      if (act === 'backup') {
        download(
          `InventIC-${today()}.json`,
          JSON.stringify(await store.load(), null, 2),
          'application/json'
        );
        return;
      }
      if (act === 'csv') {
        const safe = (v) => {
          let s = String(v ?? '');
          if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
          return '"' + s.replaceAll('"', '""') + '"';
        };
        const rows = [
          ['Código', 'Nombre', 'Categoría', 'Marca', 'Modelo', 'Ubicación', 'Estado'],
          ...matchingEquipment().map((e) => [
            e.codigo,
            e.nombre,
            name('tipos_equipo', e.tipo_id),
            e.marca,
            e.modelo,
            name('ubicaciones', e.ubicacion_id),
            status(e)
          ])
        ];
        download(
          `Inventario-${today()}.csv`,
          '\ufeff' + rows.map((r) => r.map(safe).join(',')).join('\r\n'),
          'text/csv;charset=utf-8'
        );
        return;
      }
      if (
        !confirm(
          act === 'return'
            ? '¿Confirmar la devolución de este equipo?'
            : '¿Eliminar este registro? Esta acción no se puede deshacer.'
        )
      )
        return;
      db = await store.change((current) => {
        db = current;
        if (act === 'return') {
          const p = find('prestamos', id);
          if (!p || p.devuelto_en) throw Error('Este préstamo ya fue devuelto.');
          p.devuelto_en = new Date().toISOString();
          if (openReport(p.equipo_id)) find('equipos', p.equipo_id).estado = 'En Mantenimiento';
          log(current, 'Registró una devolución', p.equipo_id);
          return;
        }
        if (!isAdmin()) throw Error('Selecciona un perfil administrador.');
        const tableName = {
          'delete-equipo': 'equipos',
          'delete-ubicacion': 'ubicaciones',
          'delete-usuario': 'usuarios',
          'delete-categoria': 'tipos_equipo',
          'delete-sede': 'sedes'
        }[act];
        if (!tableName) throw Error('Acción desconocida.');
        if (
          tableName === 'equipos' &&
          (current.prestamos.some((p) => String(p.equipo_id) === id) ||
            current.reportes.some((r) => String(r.equipo_id) === id))
        )
          throw Error('Este equipo tiene historial. Puedes marcarlo como inactivo.');
        if (
          tableName === 'ubicaciones' &&
          current.equipos.some((e) => String(e.ubicacion_id) === id)
        )
          throw Error('La ubicación todavía contiene equipos.');
        if (
          tableName === 'usuarios' &&
          (String(user.id) === id ||
            current.equipos.some((e) => String(e.responsable_id) === id) ||
            current.prestamos.some(
              (p) => String(p.usuario_id) === id || String(p.registrado_por) === id
            ) ||
            current.reportes.some((r) => String(r.usuario_id) === id) ||
            current.mantenimientos.some((m) => String(m.tecnico_id) === id))
        )
          throw Error('El perfil está en uso o tiene historial.');
        if (tableName === 'tipos_equipo' && current.equipos.some((e) => String(e.tipo_id) === id))
          throw Error('La categoría está asignada a equipos.');
        if (
          tableName === 'sedes' &&
          (current.ubicaciones.some((l) => String(l.sede_id) === id) ||
            current.usuarios.some((u) => String(u.sede_id) === id))
        )
          throw Error('La sede está asignada a ubicaciones o usuarios.');
        current[tableName] = current[tableName].filter((r) => String(r.id) !== id);
        log(current, 'Eliminó un registro de ' + tableName);
      });
      render();
      notice('Operación guardada.');
    } catch (error) {
      db = store.read();
      notice(error.message, true);
    }
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      document.getElementById('sidebar-wrapper')?.classList.remove('is-open');
      document.querySelector('[data-action="menu"]')?.setAttribute('aria-expanded', 'false');
    }
  });
  document.addEventListener('click', (event) => {
    if (event.target.closest('.skip-link')) {
      event.preventDefault();
      document.getElementById('main-content')?.focus();
    }
  });
  window.addEventListener('hashchange', render);
  async function start() {
    try {
      await auth.load();
      await window.InventicViews.load();
      if (auth.user()) await store.load();
      else store.setSettings(auth.settings());
      render();
    } catch (error) {
      document.getElementById('app').innerHTML = html`
        <main class="surface connection-error">
          <h1>No se pudo conectar</h1>
          <p>${esc(error.message)}</p>
          <p>
            Inicia el proyecto con
            <strong>Iniciar InventIC.cmd</strong>
            y abre
            <strong>http://localhost:3000</strong>
            .
          </p>
          <button class="btn btn-primary" onclick="location.reload()">Volver a intentar</button>
        </main>
      `;
      window.dispatchEvent(new Event('inventic:render'));
    }
  }
  start();
})();
