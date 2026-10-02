'use strict';

window.InventicApi = (() => {
  let base;
  let connecting;

  async function connect() {
    if (location.protocol === 'file:') {
      throw Error('Abre la carpeta en VS Code y pulsa F5 para iniciar InventIC.');
    }
    const candidates = [new URL('api/', document.baseURI).href];
    if (['localhost', '127.0.0.1'].includes(location.hostname)) {
      candidates.push(`http://${location.hostname}:3000/api/`);
    }
    for (const candidate of new Set(candidates)) {
      try {
        const response = await fetch(candidate + 'session', {
          credentials: 'include',
          signal: AbortSignal.timeout(5000)
        });
        if (!response.headers.get('content-type')?.includes('application/json')) continue;
        const result = await response.json();
        if (!response.ok) {
          const error = Error(result.error || 'La base de datos no está disponible.');
          error.code = result.code;
          throw error;
        }
        if (!Object.hasOwn(result, 'setup')) continue;
        base = candidate;
        return;
      } catch (error) {
        if (error.code?.startsWith('DATABASE_') || error.message.includes('base de datos')) {
          throw error;
        }
      }
    }
    throw Error(
      'El servidor está apagado. En VS Code pulsa F5 o ejecuta npm start en la terminal del proyecto.'
    );
  }

  async function request(path, method = 'GET', body) {
    if (!base) {
      connecting ||= connect().catch((error) => {
        connecting = null;
        throw error;
      });
      await connecting;
    }
    let response;
    try {
      response = await fetch(base + path, {
        method,
        credentials: 'include',
        headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: AbortSignal.timeout(15000)
      });
    } catch {
      throw Error(
        'Se perdió la conexión. Comprueba que npm start siga abierto. Los cambios no se guardaron.'
      );
    }
    if (!response.headers.get('content-type')?.includes('application/json')) {
      throw Error(
        'Esta dirección no corresponde al servidor de InventIC. Abre http://localhost:3000.'
      );
    }
    const result = await response.json();
    if (!response.ok) throw Error(result.error || 'No se pudo completar la operación.');
    return result;
  }

  return { request };
})();
