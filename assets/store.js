'use strict';

window.InventicStore = (() => {
  let data = { usuarios: [], configuracion: {} };
  const clone = (value) => JSON.parse(JSON.stringify(value));
  const validate = window.InventicValidate;

  function request(method, body) {
    return window.InventicApi.request('data', method, body);
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
