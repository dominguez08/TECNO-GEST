const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const mailLogo = fs.readFileSync(path.join(__dirname, '../assets/logo-mail.png'));

async function migrate(connection) {
  await connection.query(`CREATE TABLE IF NOT EXISTS avisos_correo (
    id CHAR(36) PRIMARY KEY,
    instituto_id INT NOT NULL,
    usuario_id INT NOT NULL,
    destinatario VARCHAR(100) NOT NULL,
    tipo ENUM('login','registro') NOT NULL,
    asunto VARCHAR(150) NOT NULL,
    contenido TEXT NOT NULL,
    estado ENUM('pendiente','enviado','fallido') NOT NULL DEFAULT 'pendiente',
    intentos INT NOT NULL DEFAULT 0,
    disponible_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    creado_en DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    enviado_en DATETIME NULL,
    proveedor_id VARCHAR(200) NULL,
    ultimo_error VARCHAR(100) NULL,
    INDEX idx_envio (estado,disponible_en)
  ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  await connection.query('UPDATE app_metadata SET schema_version=2 WHERE id=1');
}

const address = (value) =>
  typeof value === 'string' && /^[^\s<>@,;:"\\]+@[^\s<>@,;:"\\]+\.[^\s<>@,;:"\\]+$/.test(value);
function message(type, date = new Date()) {
  if (!['login', 'registro'].includes(type)) throw new Error('Tipo de aviso inválido.');
  const fecha = new Intl.DateTimeFormat('es-SV', {
    timeZone: 'America/El_Salvador',
    dateStyle: 'full',
    timeStyle: 'long'
  }).format(date);
  const asunto =
    type === 'registro' ? 'Tu cuenta de InventIC fue creada' : 'Nuevo inicio de sesión en InventIC';
  const contenido = [
    'Hola,',
    '',
    type === 'registro'
      ? 'Tu cuenta se registró correctamente y se inició sesión en InventIC.'
      : 'Se inició sesión correctamente en tu cuenta de InventIC.',
    '',
    `Fecha y hora de El Salvador: ${fecha}`,
    '',
    'Si fuiste tú, no necesitas hacer nada.',
    type === 'registro'
      ? 'Si no creaste esta cuenta, contacta con el administrador del instituto.'
      : 'Si no reconoces este acceso, contacta cuanto antes con el administrador de tu instituto para cambiar tu contraseña.',
    '',
    'Este es un aviso automático de seguridad de InventIC. Nunca te pediremos tu contraseña por correo.'
  ].join('\n');
  return { asunto, contenido };
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function htmlContent(job, logoUrl) {
  const paragraphs = escapeHtml(job.contenido)
    .split('\n')
    .map((line) => (line ? `<p style="margin:0 0 12px">${line}</p>` : '<div style="height:4px"></div>'))
    .join('');
  return `<!doctype html><html><body style="margin:0;background:#f1f5f9;font-family:Arial,sans-serif;color:#182b45">
    <div style="max-width:600px;margin:24px auto;background:#fff;border:1px solid #d9e2ec;border-radius:12px;overflow:hidden">
      <div style="padding:20px 24px;background:#052851;text-align:center"><img src="${escapeHtml(logoUrl)}" alt="InventIC" width="120" style="display:inline-block;max-width:120px;height:auto"></div>
      <div style="padding:28px 24px"><h1 style="font-size:20px;margin:0 0 20px;color:#165da7">${escapeHtml(job.asunto)}</h1>${paragraphs}</div>
      <div style="padding:16px 24px;background:#f8fafc;color:#52647b;font-size:12px">Aviso automático de seguridad de InventIC.</div>
    </div></body></html>`;
}

function gmailTransport(env = process.env, fetcher = fetch) {
  const configured = Boolean(
    address(env.MAIL_FROM) &&
    env.GMAIL_CLIENT_ID &&
    env.GMAIL_CLIENT_SECRET &&
    env.GMAIL_REFRESH_TOKEN
  );
  let token,
    expires = 0;
  const logoUrl = 'cid:inventic-logo';
  async function send(job) {
    if (!configured) throw new Error('GMAIL_NOT_CONFIGURED');
    if (!address(job.destinatario)) throw new Error('INVALID_RECIPIENT');
    if (!token || Date.now() >= expires) {
      const response = await fetcher('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        signal: AbortSignal.timeout(10000),
        body: new URLSearchParams({
          client_id: env.GMAIL_CLIENT_ID,
          client_secret: env.GMAIL_CLIENT_SECRET,
          refresh_token: env.GMAIL_REFRESH_TOKEN,
          grant_type: 'refresh_token'
        })
      });
      if (!response.ok) throw new Error('GMAIL_AUTH_' + response.status);
      const data = await response.json();
      if (!data.access_token) throw new Error('GMAIL_AUTH_INVALID');
      token = data.access_token;
      expires = Date.now() + Math.max(0, (Number(data.expires_in) || 3600) - 60) * 1000;
    }
    const boundary = `inventic_${job.id.replaceAll('-', '')}`;
    const related = `${boundary}_related`;
    const mime = [
      `From: InventIC <${env.MAIL_FROM}>`,
      `To: ${job.destinatario}`,
      `Subject: =?UTF-8?B?${Buffer.from(job.asunto).toString('base64')}?=`,
      `Message-ID: <${job.id}@inventic.invalid>`,
      'MIME-Version: 1.0',
      `Content-Type: multipart/related; boundary="${related}"`,
      '',
      `--${related}`,
      `Content-Type: multipart/alternative; boundary="${boundary}"`,
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(job.contenido).toString('base64').match(/.{1,76}/g).join('\r\n'),
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: base64',
      '',
      Buffer.from(htmlContent(job, logoUrl)).toString('base64').match(/.{1,76}/g).join('\r\n'),
      `--${boundary}--`,
      `--${related}`,
      'Content-Type: image/png; name="inventic.png"',
      'Content-Transfer-Encoding: base64',
      'Content-ID: <inventic-logo>',
      'Content-Disposition: inline; filename="inventic.png"',
      '',
      mailLogo.toString('base64').match(/.{1,76}/g).join('\r\n'),
      `--${related}--`,
      ''
    ].join('\r\n');
    const response = await fetcher('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(10000),
      body: JSON.stringify({ raw: Buffer.from(mime).toString('base64url') })
    });
    if (!response.ok) {
      if (response.status === 401) {
        token = null;
        expires = 0;
      }
      throw new Error('GMAIL_SEND_' + response.status);
    }
    const result = await response.json();
    if (!result.id) throw new Error('GMAIL_RESPONSE_INVALID');
    return String(result.id).slice(0, 200);
  }
  return { configured, send };
}

function service(pool, { transport = gmailTransport(), logger = console } = {}) {
  let busy = false;
  async function enqueue(account, type) {
    const id = crypto.randomUUID();
    const body = message(type);
    try {
      await pool.execute(
        'INSERT INTO avisos_correo (id,instituto_id,usuario_id,destinatario,tipo,asunto,contenido) VALUES (?,?,?,?,?,?,?)',
        [id, account.instituto_id, account.id, account.email, type, body.asunto, body.contenido]
      );
      return id;
    } catch {
      logger.error('No se pudo guardar el aviso de correo. El acceso del usuario continúa.');
      return null;
    }
  }
  async function processOne() {
    if (busy || !transport.configured) return false;
    busy = true;
    let connection, job;
    try {
      connection = await pool.getConnection();
      await connection.beginTransaction();
      const [jobs] = await connection.query(
        "SELECT * FROM avisos_correo WHERE estado='pendiente' AND disponible_en<=NOW() ORDER BY creado_en,id LIMIT 1 FOR UPDATE SKIP LOCKED"
      );
      job = jobs[0];
      if (!job) {
        await connection.commit();
        return false;
      }
      const [expired] = await connection.execute(
        'SELECT creado_en < DATE_SUB(NOW(), INTERVAL 24 HOUR) AS vencido FROM avisos_correo WHERE id=?',
        [job.id]
      );
      if (Number(expired[0].vencido) || job.intentos >= 5) {
        await connection.execute(
          "UPDATE avisos_correo SET estado='fallido',ultimo_error='EXPIRED_OR_MAX_ATTEMPTS' WHERE id=?",
          [job.id]
        );
        await connection.commit();
        return true;
      }
      await connection.execute(
        'UPDATE avisos_correo SET intentos=intentos+1,disponible_en=DATE_ADD(NOW(), INTERVAL 2 MINUTE) WHERE id=?',
        [job.id]
      );
      await connection.commit();
      connection.release();
      connection = null;
      try {
        const providerId = await transport.send(job);
        await pool.execute(
          "UPDATE avisos_correo SET estado='enviado',enviado_en=NOW(),proveedor_id=?,ultimo_error=NULL WHERE id=?",
          [providerId, job.id]
        );
      } catch (error) {
        // Never store credentials, provider response bodies or recipient addresses in logs.
        const code =
          /^GMAIL_(AUTH|SEND)_\d+$|^GMAIL_(AUTH_INVALID|RESPONSE_INVALID)$|^INVALID_RECIPIENT$/.test(
            error.message
          )
            ? error.message
            : 'DELIVERY_UNAVAILABLE';
        const delay = [60, 300, 900, 3600, 7200][job.intentos] || 7200;
        await pool.execute(
          'UPDATE avisos_correo SET estado=?,ultimo_error=?,disponible_en=DATE_ADD(NOW(), INTERVAL ? SECOND) WHERE id=?',
          [job.intentos + 1 >= 5 ? 'fallido' : 'pendiente', code, delay, job.id]
        );
        logger.warn('Aviso de correo pendiente o fallido: ' + code);
      }
      return true;
    } catch {
      if (connection) await connection.rollback();
      logger.error('No se pudo procesar la cola de avisos de correo.');
      return false;
    } finally {
      connection?.release();
      busy = false;
    }
  }
  function start() {
    if (!transport.configured) {
      logger.warn(
        'Avisos de correo pendientes de configuración: MAIL_FROM, GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET y GMAIL_REFRESH_TOKEN.'
      );
      return;
    }
    const timer = setInterval(() => void processOne(), 2000);
    timer.unref();
    void processOne();
    return timer;
  }
  return { enqueue, processOne, start };
}
module.exports = { migrate, message, gmailTransport, service };
