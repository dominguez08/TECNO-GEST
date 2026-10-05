const { test } = require('node:test');
const assert = require('node:assert/strict');
const { allowedOrigins } = require('../server/origins.cjs');

test('Railway HTTPS origin is allowed without admitting other sites', () => {
  const origins = allowedOrigins({
    PORT: '8080',
    RAILWAY_PUBLIC_DOMAIN: 'tecno-gest-production.up.railway.app'
  });
  assert.ok(origins.has('https://tecno-gest-production.up.railway.app'));
  for (const origin of [undefined, 'null', 'https://other.up.railway.app',
    'https://tecno-gest-production.up.railway.app.attacker.test',
    'http://tecno-gest-production.up.railway.app']) {
    assert.equal(origins.has(origin), false);
  }
});

test('local development and explicit custom domains remain supported', () => {
  const origins = allowedOrigins({ PORT: '3001', LIVE_SERVER_PORT: '5502',
    APP_ORIGIN: 'https://inventory.example.com/' });
  assert.ok(origins.has('http://localhost:3001'));
  assert.ok(origins.has('http://127.0.0.1:5502'));
  assert.ok(origins.has('https://inventory.example.com'));
  assert.equal(origins.has('https://other.example.com'), false);
  assert.throws(() => allowedOrigins({ APP_ORIGIN: 'file:///tmp/app' }));
});
