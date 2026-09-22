'use strict';

window.InventicStore = (() => {
  let data = { usuarios: [], configuracion: {} };
  const apiBase = window.location.port === '3000' ? '/api/data' : 'http://localhost:3000/api/data';
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const validate = window.InventicValidate;

  async function request(method, body) {
    let response;
    try {
      response = await fetch(apiBase, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
        credentials: 'include'
      });
    } catch {
      throw Error('No se pudo conectar con el servidor. Tus cambios no se han guardado.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw Error(
        'El servidor de InventIC no devolvió JSON. Inicia el servidor con Iniciar InventIC.cmd.'
      );
    }
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'No se pudo guardar en la base de datos.');
    return result;
  }

  async function load() {
    data = validate(await request('GET'));
    return clone(data);
  }

  async function write(changes, restoring = false) {
    validate(changes);
    if (restoring) changes.revision = data.revision;
    const result = await request('PUT', { data: changes, restoring });
    data = validate(result);
    return clone(data);
  }

  async function change(callback) {
    const copy = clone(data);
    callback(copy);
    return write(copy);
  }

  function next(source, table) {
    return Math.max(0, ...source[table].map((record) => Number(record.id))) + 1;
  }

  return {
    read: () => clone(data),
    setSettings: (settings) => {
      data = { usuarios: [], configuracion: settings };
    },
    load,
    write,
    change,
    validate,
    clone,
    next
  };
})();
