'use strict';

window.InventicAuth = (() => {
  let session = { user: null, setup: false, settings: {} };
  const apiBase =
    window.location.port === '5500' ? `http://${window.location.hostname}:3000/api/` : '/api/';

  async function request(path, values) {
    let response;
    try {
      response = await fetch(apiBase + path, {
        method: values ? 'POST' : 'GET',
        headers: { 'Content-Type': 'application/json' },
        body: values ? JSON.stringify(values) : undefined,
        credentials: 'include'
      });
    } catch {
      throw Error('No se pudo conectar con el servidor de InventIC.');
    }

    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) {
      throw Error(
        'El servidor de InventIC no devolvió JSON. Inicia el servidor con Iniciar InventIC.cmd.'
      );
    }
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'No se pudo completar la solicitud.');
    return result;
  }

  async function load() {
    session = await request('session');
    return session;
  }

  async function signIn(values, setup = false) {
    const result = await request(setup ? 'setup' : 'login', values);
    session.user = result.user;
    session.setup = false;
  }

  async function signOut() {
    await request('logout', {});
    session.user = null;
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
