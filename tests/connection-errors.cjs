const assert = require('node:assert/strict');
const { test } = require('node:test');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const publicError = require('../server/errors.cjs');

test('los errores de MySQL distinguen credenciales, conexión y datos inválidos', () => {
  for (const code of ['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR']) {
    const result = publicError({ code, sqlState: '28000', message: 'private details' });
    assert.equal(result.status, 503);
    assert.equal(result.code, 'DATABASE_CONFIGURATION');
    assert.match(result.error, /DB_PASS/);
    assert.doesNotMatch(result.error, /private details/);
  }
  assert.equal(publicError({ code: 'ECONNREFUSED' }).code, 'DATABASE_UNAVAILABLE');
  assert.equal(publicError({ code: 'ER_BAD_DB_ERROR' }).code, 'DATABASE_CONFIGURATION');
  assert.equal(publicError({ code: 'ER_NO_SUCH_TABLE' }).status, 503);
  const duplicate = publicError({ code: 'ER_DUP_ENTRY', sqlState: '23000' });
  assert.equal(duplicate.status, 400);
  assert.match(duplicate.error, /duplicados/);
});

test('el navegador conserva el diagnóstico de MySQL al detectar el servidor', async () => {
  const diagnostic = publicError({ code: 'ER_ACCESS_DENIED_ERROR', sqlState: '28000' });
  const calls = [];
  const context = {
    window: {},
    document: { baseURI: 'http://localhost:5500/' },
    location: { protocol: 'http:', hostname: 'localhost' },
    URL,
    AbortSignal,
    fetch: async (url) => {
      calls.push(url);
      return url.includes(':5500/')
        ? new Response('<html></html>', { headers: { 'Content-Type': 'text/html' } })
        : new Response(JSON.stringify(diagnostic), {
            status: diagnostic.status,
            headers: { 'Content-Type': 'application/json' }
          });
    }
  };
  vm.runInNewContext(
    fs.readFileSync(path.join(__dirname, '../assets/api.js'), 'utf8'),
    context
  );
  await assert.rejects(context.window.InventicApi.request('session'), {
    message: diagnostic.error
  });
  assert.deepEqual(calls, ['http://localhost:5500/api/session', 'http://localhost:3000/api/session']);
});
