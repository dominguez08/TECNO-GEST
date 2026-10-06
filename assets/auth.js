'use strict';

window.InventicAuth = (() => {
  let session = { user: null, setup: false, settings: {} };
  function request(path, values) {
    return window.InventicApi.request(path, values ? 'POST' : 'GET', values);
  }

  async function load() {
    session = await request('session');
    return session;
  }

  async function signIn(values, mode = 'login') {
    const result = await request(mode === true ? 'setup' : mode === false ? 'login' : mode, values);
    session.user = result.user;
    session.setup = false;
  }

  async function signOut() {
    await request('logout', {});
    session.user = null;
    window.InventicStore.setSettings({
      nombre: 'InventIC',
      institucion: 'Plataforma para institutos',
      moneda: 'USD'
    });
  }

  function currentUser(data) {
    if (!session.user) return null;
    return data.usuarios.find((user) => String(user.id) === String(session.user.id)) || null;
  }

  return {
    load,
    signIn,
    signOut,
    currentUser,
    needsSetup: () => session.setup,
    settings: () => session.settings,
    user: () => session.user
  };
})();
