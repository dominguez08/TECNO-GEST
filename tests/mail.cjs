const test = require('node:test');
const assert = require('node:assert/strict');
const { message, gmailTransport, service } = require('../server/mail.cjs');
const env = {
  MAIL_FROM: 'sender@example.test',
  GMAIL_CLIENT_ID: 'test-client',
  GMAIL_CLIENT_SECRET: 'test-secret',
  GMAIL_REFRESH_TOKEN: 'test-refresh'
};
const job = {
  id: '00000000-0000-4000-8000-000000000001',
  destinatario: 'student@example.test',
  ...message('login', new Date('2026-10-06T15:00:00Z'))
};

test('Gmail uses OAuth, UTF-8 MIME and only the account recipient', async () => {
  const calls = [];
  const transport = gmailTransport(env, async (url, options) => {
    calls.push({ url, options });
    return new Response(
      JSON.stringify(
        url.endsWith('/token')
          ? { access_token: 'test-access', expires_in: 3600 }
          : { id: 'gmail-message' }
      )
    );
  });
  assert.equal(await transport.send(job), 'gmail-message');
  await transport.send(job);
  assert.equal(calls.filter((c) => c.url.endsWith('/token')).length, 1);
  const request = calls[1];
  assert.equal(request.url, 'https://gmail.googleapis.com/gmail/v1/users/me/messages/send');
  assert.equal(request.options.headers.Authorization, 'Bearer test-access');
  const mime = Buffer.from(JSON.parse(request.options.body).raw, 'base64url').toString('utf8');
  assert.match(mime, /To: student@example.test\r\n/);
  assert.doesNotMatch(mime, /Bcc:|test-secret|test-refresh/);
  const body = Buffer.from(mime.split('\r\n\r\n')[1].replaceAll('\r\n', ''), 'base64').toString(
    'utf8'
  );
  assert.match(body, /Se inició sesión correctamente/);
  assert.match(body, /9:00:00/);
  assert.match(message('registro').contenido, /se registró correctamente y se inició sesión/);
  await assert.rejects(
    () => transport.send({ ...job, destinatario: 'victim@example.test\r\nBcc:bad@example.test' }),
    /INVALID_RECIPIENT/
  );
});

test('Provider errors do not expose credentials and 401 renews the access token', async () => {
  let tokens = 0,
    sends = 0;
  const transport = gmailTransport(env, async (url) => {
    if (url.endsWith('/token')) {
      tokens++;
      return new Response(JSON.stringify({ access_token: 'access-' + tokens, expires_in: 3600 }));
    }
    sends++;
    return sends === 1
      ? new Response('sensitive-provider-body', { status: 401 })
      : new Response(JSON.stringify({ id: 'sent' }));
  });
  await assert.rejects(() => transport.send(job), /^Error: GMAIL_SEND_401$/);
  assert.equal(await transport.send(job), 'sent');
  assert.equal(tokens, 2);
});

test('Unconfigured Gmail stays disabled and queue failures do not reject sign-in', async () => {
  let called = false;
  const transport = gmailTransport({}, () => {
    called = true;
    throw Error('Must not connect');
  });
  assert.equal(transport.configured, false);
  const logs = [];
  const mail = service(
    {
      execute: async () => {
        throw Error('private database secret');
      }
    },
    { transport, logger: { error: (m) => logs.push(m), warn: (m) => logs.push(m) } }
  );
  assert.equal(
    await mail.enqueue({ id: 1, instituto_id: 2, email: 'private@example.test' }, 'login'),
    null
  );
  mail.start();
  assert.equal(await mail.processOne(), false);
  assert.equal(called, false);
  assert.doesNotMatch(logs.join(' '), /private@example|private database secret/);
});
