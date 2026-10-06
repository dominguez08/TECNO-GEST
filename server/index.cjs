const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const crypto = require('node:crypto');

const root = path.resolve(__dirname, '..');
if (fs.existsSync(path.join(root, '.env'))) process.loadEnvFile(path.join(root, '.env'));

const database = require('./database.cjs');
const students = require('./student.cjs')(database.pool);
const { verifyPassword } = require('./security.cjs');
const checkPermissions = require('./permissions.cjs');
const validate = require('../assets/validation.js');
const publicError = require('./errors.cjs');
const sessions = new Map();
const attempts = new Map();
const port = Number(process.env.PORT || 3000);
const allowedOrigins = require('./origins.cjs').allowedOrigins();

function send(response, status, data) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  response.end(JSON.stringify(data));
}

function safeUser(user) {
  if (!user) return null;
  const { password, ...publicUser } = user;
  return publicUser;
}

function sessionId(request) {
  return request.headers.cookie
    ?.split(';')
    .map((value) => value.trim())
    .find((value) => value.startsWith('inventic_session='))
    ?.split('=')[1];
}

function startSession(request, response, user) {
  sessions.delete(sessionId(request));
  const id = crypto.randomBytes(32).toString('hex');
  sessions.set(id, {
    userId: user.id,
    expires: Date.now() + 8 * 60 * 60 * 1000,
    signature: user.password
  });
  response.setHeader(
    'Set-Cookie',
    `inventic_session=${id}; HttpOnly; SameSite=Strict; Path=/; Max-Age=28800`
  );
}

async function authenticatedUser(request) {
  const id = sessionId(request);
  const session = sessions.get(id);
  if (!session || session.expires < Date.now()) {
    sessions.delete(id);
    return null;
  }
  const user = await database.getUser(session.userId);
  if (!user || user.password !== session.signature) {
    sessions.delete(id);
    return null;
  }
  return user;
}

async function readBody(request) {
  let size = 0;
  const chunks = [];
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 20 * 1024 * 1024) throw new Error('El archivo supera los 20 MB permitidos.');
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

const server = http.createServer(async (request, response) => {
  response.setHeader('X-Content-Type-Options', 'nosniff');
  response.setHeader('X-Frame-Options', 'DENY');
  response.setHeader('Referrer-Policy', 'same-origin');
  response.setHeader('Cache-Control', 'no-store');
  const url = new URL(request.url, 'http://localhost');
  try {
    if (url.pathname.startsWith('/api/')) {
      const origin = request.headers.origin;
      if (allowedOrigins.has(origin)) {
        response.setHeader('Access-Control-Allow-Origin', origin);
        response.setHeader('Access-Control-Allow-Credentials', 'true');
        response.setHeader('Access-Control-Allow-Headers', 'Content-Type');
        response.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, OPTIONS');
        response.setHeader('Vary', 'Origin');
      }
      if (request.method === 'OPTIONS') {
        if (!allowedOrigins.has(origin)) {
          return send(response, 403, { error: 'Origen de la solicitud no permitido.' });
        }
        response.writeHead(204);
        return response.end();
      }
      if (request.method !== 'GET') {
        if (
          !allowedOrigins.has(origin) ||
          !request.headers['content-type']?.startsWith('application/json')
        ) {
          return send(response, 403, { error: 'Origen de la solicitud no permitido.' });
        }
      }
      const user = await authenticatedUser(request);
      if (request.method === 'GET' && url.pathname === '/api/session') {
        return send(response, 200, {
          user: safeUser(user),
          setup: await database.needsSetup(),
          settings: { nombre: 'InventIC', institucion: 'Mi institución', moneda: 'USD' }
        });
      }
      if (request.method === 'POST' && url.pathname === '/api/setup') {
        const admin = await database.setupAdmin(await readBody(request));
        startSession(request, response, admin);
        return send(response, 201, { user: safeUser(admin) });
      }
      if (request.method === 'POST' && url.pathname === '/api/login') {
        const key = request.socket.remoteAddress;
        const limit = attempts.get(key) || { count: 0, until: Date.now() + 15 * 60 * 1000 };
        if (limit.until < Date.now()) {
          limit.count = 0;
          limit.until = Date.now() + 15 * 60 * 1000;
        }
        if (limit.count >= 10)
          return send(response, 429, {
            error: 'Demasiados intentos. Intenta de nuevo en 15 minutos.'
          });
        const body = await readBody(request);
        const account = await database.getUserByEmail(
          String(body.email || '')
            .trim()
            .toLowerCase()
        );
        if (!(await verifyPassword(body.password, account?.password))) {
          limit.count += 1;
          attempts.set(key, limit);
          return send(response, 401, { error: 'Correo o contraseña incorrectos.' });
        }
        attempts.delete(key);
        startSession(request, response, account);
        return send(response, 200, { user: safeUser(account) });
      }
      if (request.method === 'POST' && url.pathname === '/api/register') {
        const id = await students.register(await readBody(request));
        const account = await database.getUser(id);
        startSession(request, response, account);
        return send(response, 201, { user: safeUser(account) });
      }
      if (request.method === 'POST' && url.pathname === '/api/logout') {
        sessions.delete(sessionId(request));
        response.setHeader(
          'Set-Cookie',
          'inventic_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0'
        );
        return send(response, 200, { ok: true });
      }
      if (!user) return send(response, 401, { error: 'Inicia sesión para continuar.' });
      if (Number(user.rol_id) === 3) {
        if (request.method === 'GET' && url.pathname === '/api/data')
          return send(response, 200, await students.data(user));
        if (request.method === 'POST' && url.pathname === '/api/student/reports')
          return send(response, 201, await students.report(user, await readBody(request)));
        return send(response, 403, {
          error: 'Tu cuenta solo puede consultar sus préstamos y reportar fallas.'
        });
      }
      if (request.method === 'GET' && url.pathname === '/api/data')
        return send(response, 200, await database.loadData());
      if (request.method === 'PUT' && url.pathname === '/api/data') {
        const body = await readBody(request);
        const data = await database.saveData(
          body.data,
          validate,
          checkPermissions,
          user,
          body.restoring === true
        );
        const current = await database.getUser(user.id);
        if (current.password !== user.password) startSession(request, response, current);
        return send(response, 200, data);
      }
      return send(response, 404, { error: 'La operación no existe.' });
    }

    if (!['GET', 'HEAD'].includes(request.method))
      return send(response, 405, { error: 'Método no permitido.' });
    const relative = decodeURIComponent(url.pathname).replace(/^\//, '') || 'index.html';
    const file = path.resolve(root, relative);
    const allowed = relative === 'index.html' || /^(assets|modules|auth)\//.test(relative);
    if (
      !allowed ||
      !file.startsWith(root + path.sep) ||
      !fs.existsSync(file) ||
      !fs.statSync(file).isFile()
    ) {
      return send(response, 404, { error: 'Archivo no encontrado.' });
    }
    const mime = {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.css': 'text/css',
      '.svg': 'image/svg+xml',
      '.jpg': 'image/jpeg'
    };
    response.setHeader(
      'Content-Type',
      (mime[path.extname(file)] || 'application/octet-stream') + '; charset=utf-8'
    );
    response.end(request.method === 'HEAD' ? undefined : fs.readFileSync(file));
  } catch (error) {
    const { status, ...body } = publicError(error);
    send(response, status, body);
  }
});

server.listen(port, process.env.HOST || '127.0.0.1', () =>
  console.log(`InventIC disponible en http://localhost:${port}`)
);
setInterval(() => {
  for (const [id, session] of sessions) if (session.expires < Date.now()) sessions.delete(id);
  for (const [id, limit] of attempts) if (limit.until < Date.now()) attempts.delete(id);
}, 60000).unref();
