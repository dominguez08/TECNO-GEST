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

test('renamed deployment works when Railway still configures the previous domain', () => {
  for (const env of [
    { RAILWAY_PUBLIC_DOMAIN: 'inventic-production.up.railway.app' },
    { APP_ORIGIN: 'https://inventic-production.up.railway.app' }
  ]) {
    const origins = allowedOrigins(env);
    assert.ok(origins.has('https://tecno-gest-production.up.railway.app'));
    for (const origin of [
      'https://untrusted.example',
      'https://other.up.railway.app',
      'https://tecno-gest-production.up.railway.app.attacker.test',
      'http://tecno-gest-production.up.railway.app',
      'null'
    ]) assert.equal(origins.has(origin), false);
  }
  assert.equal(allowedOrigins({}).has('https://tecno-gest-production.up.railway.app'), false);
  assert.equal(allowedOrigins({ RAILWAY_PUBLIC_DOMAIN: 'other.up.railway.app' })
    .has('https://tecno-gest-production.up.railway.app'), false);
});
