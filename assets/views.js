'use strict';

window.InventicViews = (() => {
  const templates = new Map();
  const files = [
    'auth/login.html',
    'modules/equipos/edit.html',
    'modules/equipos/photo.html',
    'modules/usuarios/edit.html',
    'modules/ubicaciones/edit.html',
    'modules/mantenimiento/index.html',
    'modules/mantenimiento/create.html',
    'modules/mantenimiento/assign.html',
    'modules/dashboard/index.html',
    'modules/equipos/index.html',
    'modules/equipos/create.html',
    'modules/equipos/view.html',
    'modules/prestamos/index.html',
    'modules/prestamos/create.html',
    'modules/ubicaciones/index.html',
    'modules/ubicaciones/create.html',
    'modules/reportes/index.html',
    'modules/reportes/create.html',
    'modules/reportes/view.html',
    'modules/usuarios/index.html',
    'modules/usuarios/create.html',
    'modules/configuracion/index.html',
    'modules/estadisticas/index.html',
    'modules/perfil/index.html'
  ];

  async function load() {
    await Promise.all(
      files.map(async (file) => {
        const response = await fetch(new URL(file, document.baseURI));
        if (!response.ok) throw Error('No se pudo cargar la pantalla: ' + file);
        const documentView = new DOMParser().parseFromString(await response.text(), 'text/html');
        documentView.querySelectorAll('template').forEach((template) => {
          templates.set(file + '#' + template.id, template.innerHTML);
        });
      })
    );
  }

  // Los textos procedentes de MySQL llegan escapados desde el controlador.
  function render(name, values = {}) {
    const template = templates.get(name);
    if (!template) throw Error('No existe la plantilla: ' + name);
    return template.replace(/\{\{(\w+)\}\}/g, (_, key) => values[key] ?? '');
  }

  return { load, render };
})();
