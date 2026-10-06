const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const { chromium } = require('playwright');
const { install } = require('../tools/install-database.cjs');
const validate = require('../assets/validation.js');
const root = path.resolve(__dirname, '..');

(async () => {
  const password = JSON.parse(
    fs.readFileSync(
      process.env.TEST_MYSQL_ADMIN_FILE || path.join(root, '.runtime/mysql-admin.json'),
      'utf8'
    )
  ).password;
  const sql = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password
  });
  const name = 'inventic_test_student_' + Date.now();
  let server, browser, mailPool;
  try {
    await install(sql, name);
    const socket = require('node:net').createServer();
    await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['server/index.cjs'], {
      cwd: root,
      windowsHide: true,
      env: {
        ...process.env,
        DB_HOST: '127.0.0.1',
        DB_PORT: '3307',
        DB_NAME: name,
        DB_USER: 'root',
        DB_PASS: password,
        PORT: String(port),
        HOST: '127.0.0.1',
        MAIL_FROM: '',
        GMAIL_CLIENT_ID: '',
        GMAIL_CLIENT_SECRET: '',
        GMAIL_REFRESH_TOKEN: ''
      }
    });
    for (let i = 0; i < 80; i++) {
      try {
        if ((await fetch(base + '/api/session')).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    async function api(route, method = 'GET', body, cookie, status = 200) {
      const response = await fetch(base + '/api/' + route, {
        method,
        headers: {
          Origin: base,
          'Content-Type': 'application/json',
          ...(cookie ? { Cookie: cookie } : {})
        },
        body: body ? JSON.stringify(body) : undefined
      });
      const data = await response.json();
      assert.equal(response.status, status, JSON.stringify(data));
      return { data, cookie: response.headers.get('set-cookie')?.split(';')[0] };
    }
    const account = (nombre, email) => ({
      nombre,
      email,
      password: 'Prueba123!',
      confirmation: 'Prueba123!',
      rol_id: 1
    });
    const admin = await api(
      'register',
      'POST',
      { ...account('Admin', 'admin@example.test'), institucion: 'Instituto A' },
      null,
      201
    );
    const instituteId = admin.data.user.instituto_id;
    const initial = (await api('data', 'GET', null, admin.cookie)).data;
    const code = initial.instituto.codigo;
    assert.deepEqual(initial.sedes, []);
    assert.deepEqual(initial.equipos, []);
    const member = (nombre, email, role = 3) => ({
      ...account(nombre, email),
      rol_id: role,
      codigo: code
    });
    const alice = await api('register', 'POST', member('Alice', 'alice@example.test'), null, 201);
    const bob = await api('register', 'POST', member('Bob', 'bob@example.test'), null, 201);
    const tech = await api(
      'register',
      'POST',
      member('Técnico', 'tech@example.test', 2),
      null,
      201
    );
    assert.equal((await api('data', 'GET', null, alice.cookie)).data.scope, 'pending');
    await api(
      'student/reports',
      'POST',
      { prestamo_id: 1, descripcion: 'No autorizado' },
      alice.cookie,
      403
    );
    await api(
      'institute/approval',
      'POST',
      { usuario_id: alice.data.user.id, aprobado: 1 },
      tech.cookie,
      403
    );
    for (const user of [alice, bob, tech])
      await api(
        'institute/approval',
        'POST',
        { usuario_id: user.data.user.id, aprobado: 1 },
        admin.cookie
      );
    assert.equal(alice.data.user.rol_id, 3);
    await api('register', 'POST', member('Alice', 'alice@example.test'), null, 409);
    await api(
      'register',
      'POST',
      { ...member('Invalid', 'invalid@example.test'), codigo: 'INVALID' },
      null,
      400
    );
    await api('data', 'GET', null, null, 401);
    await api('data', 'PUT', { data: {} }, alice.cookie, 403);
    assert.deepEqual((await api('data', 'GET', null, alice.cookie)).data.prestamos, []);
    await sql.execute("INSERT INTO tipos_equipo (nombre,instituto_id) VALUES ('Laptop',?)", [
      instituteId
    ]);
    await sql.execute("INSERT INTO sedes (nombre,instituto_id) VALUES ('Sede de prueba',?)", [
      instituteId
    ]);
    await sql.execute("INSERT INTO ubicaciones (nombre,sede_id,instituto_id) VALUES ('Aula',1,?)", [
      instituteId
    ]);
    for (let id = 1; id <= 4; id++)
      await sql.execute(
        'INSERT INTO equipos (id,codigo,nombre,tipo_id,ubicacion_id,instituto_id) VALUES (?,?,?,1,1,?)',
        [id, 'LAP-' + id, 'Laptop ' + id, instituteId]
      );
    await sql.execute(
      "INSERT INTO prestamos (id,equipo_id,usuario_id,registrado_por,fecha_prestamo,fecha_devolucion,devuelto_en) VALUES (1,1,?,?,'2020-01-01','2099-01-01',NULL),(2,2,?,?,'2020-01-01','2099-01-01',NULL),(3,3,?,?,'2020-01-01','2020-02-01',NULL),(4,4,?,?,'2020-01-01','2020-02-01','2020-02-01 12:00:00')",
      [
        alice.data.user.id,
        admin.data.user.id,
        bob.data.user.id,
        admin.data.user.id,
        alice.data.user.id,
        admin.data.user.id,
        alice.data.user.id,
        admin.data.user.id
      ]
    );
    await sql.execute('UPDATE prestamos SET instituto_id=?', [instituteId]);
    const stale = (await api('data', 'GET', null, admin.cookie)).data;
    const own = (await api('data', 'GET', null, alice.cookie)).data;
    assert.deepEqual(own.prestamos.map((p) => p.id).sort(), [1, 3, 4]);
    assert.equal(own.equipos, undefined);
    assert.equal(own.usuarios.length, 1);
    await api(
      'student/reports',
      'POST',
      { prestamo_id: 2, descripcion: 'Falla ajena' },
      alice.cookie,
      403
    );
    await api(
      'student/reports',
      'POST',
      { prestamo_id: 4, descripcion: 'Ya devuelto' },
      alice.cookie,
      403
    );
    browser = await chromium.launch({
      headless: true,
      channel: process.env.TEST_BROWSER || 'msedge'
    });
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    await page.goto(base + '/#/login/signin');
    await page.getByRole('link', { name: 'Crear cuenta', exact: true }).click();
    await page.locator('[name=nombre]').fill('Carla');
    await page.locator('[name=rol_id]').selectOption('3');
    await page.locator('[name=codigo]').fill(code);
    await page.locator('[name=email]').fill('carla@example.test');
    await page.locator('[name=password]').fill('Prueba123!');
    await page.locator('[name=confirmation]').fill('Prueba123!');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await page.getByRole('heading', { name: 'Acceso pendiente', exact: true }).waitFor();
    const carla = (await api('data', 'GET', null, admin.cookie)).data.usuarios.find(
      (u) => u.email === 'carla@example.test'
    );
    await api('institute/approval', 'POST', { usuario_id: carla.id, aprobado: 1 }, admin.cookie);
    await page.getByRole('button', { name: 'Actualizar', exact: true }).click();
    await page.getByRole('heading', { name: 'Mis préstamos', exact: true }).waitFor();
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.getByRole('link', { name: 'Iniciar sesión', exact: true }).click();
    await page.locator('[name=email]').fill('alice@example.test');
    await page.locator('[name=password]').fill('Prueba123!');
    await page.locator('button[type=submit]').click();
    await page.getByRole('heading', { name: 'Mis préstamos', exact: true }).waitFor();
    assert.match(await page.locator('[data-loan-deadline]').first().textContent(), /vencido|días/);
    assert.match(await page.locator('body').textContent(), /vencido/);
    assert.equal(await page.locator('.sidebar').count(), 0);
    await page.locator('[name=prestamo_id]').selectOption('1');
    await page.locator('[name=descripcion]').fill('La pantalla parpadea durante el uso');
    await page.getByRole('button', { name: 'Enviar falla' }).click();
    await page.getByText('La pantalla parpadea durante el uso', { exact: true }).waitFor();
    await page.reload();
    await page.getByText('La pantalla parpadea durante el uso', { exact: true }).waitFor();
    await page.setViewportSize({ width: 390, height: 844 });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Mobile overflow'
    );
    assert.deepEqual(errors, []);
    await api(
      'student/reports',
      'POST',
      { prestamo_id: 1, descripcion: 'Duplicada' },
      alice.cookie,
      409
    );
    assert.equal((await api('data', 'GET', null, bob.cookie)).data.reportes.length, 0);
    await api('data', 'PUT', { data: stale }, admin.cookie, 409);
    const fresh = (await api('data', 'GET', null, admin.cookie)).data;
    validate(fresh);
    assert.equal(fresh.reportes[0].usuario_id, alice.data.user.id);
    await api('data', 'PUT', { data: fresh }, admin.cookie);
    const reportId = fresh.reportes[0].id;
    const repair = {
      reporte_id: reportId,
      estado_id: 3,
      diagnostico: 'Cable de pantalla flojo',
      solucion: ''
    };
    await api('technician/repairs', 'POST', repair, tech.cookie, 409);
    const techData = (await api('data', 'GET', null, tech.cookie)).data;
    assert.equal(techData.scope, 'technician');
    assert.equal(techData.usuarios.length, 1);
    assert.equal(techData.prestamos, undefined);
    assert.equal(techData.equipos, undefined);
    await api('data', 'PUT', { data: fresh }, tech.cookie, 403);
    const returned = (await api('data', 'GET', null, admin.cookie)).data;
    returned.prestamos.find((p) => p.id === 1).devuelto_en = '2026-10-06 12:00:00';
    returned.equipos.find((e) => e.id === 1).estado = 'En Mantenimiento';
    await api('data', 'PUT', { data: returned }, admin.cookie);
    await api(
      'student/reports',
      'POST',
      { prestamo_id: 1, descripcion: 'Devuelta' },
      alice.cookie,
      403
    );
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.locator('[name=email]').fill('tech@example.test');
    await page.locator('[name=password]').fill('Prueba123!');
    await page.locator('button[type=submit]').click();
    await page.getByRole('heading', { name: 'Fallas y reparaciones', exact: true }).waitFor();
    assert.equal(await page.getByRole('link', { name: 'Inventario', exact: true }).count(), 0);
    await page.locator('[name=estado_id]').selectOption('3');
    await page.locator('[name=diagnostico]').fill(repair.diagnostico);
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('Reparación actualizada correctamente.').waitFor();
    const alternate = await api(
      'register',
      'POST',
      member('Técnico alterno', 'alternate@example.test', 2),
      null,
      201
    );
    await api(
      'institute/approval',
      'POST',
      { usuario_id: alternate.data.user.id, aprobado: 1 },
      admin.cookie
    );
    await api('technician/repairs', 'POST', repair, alternate.cookie, 403);
    await api('technician/repairs', 'POST', { ...repair, estado_id: 4 }, tech.cookie, 400);
    await page.locator('[name=estado_id]').selectOption('4');
    await page.locator('[name=solucion]').fill('Se ajustó el cable de la pantalla');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('Se ajustó el cable de la pantalla', { exact: true }).waitFor();
    fs.mkdirSync(path.join(root, 'test-results'), { recursive: true });
    await page.screenshot({
      path: path.join(root, 'test-results/technician-mobile.png'),
      fullPage: true
    });
    assert.ok(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      'Technician mobile overflow'
    );
    assert.equal((await api('data', 'GET', null, alice.cookie)).data.reportes[0].estado_id, 4);
    assert.equal(
      (await api('data', 'GET', null, admin.cookie)).data.equipos.find((e) => e.id === 1).estado,
      'Activo'
    );
    // A second director creates a separate, empty institute through the UI.
    await page.getByRole('button', { name: 'Cerrar sesión' }).click();
    await page.getByRole('link', { name: 'Crear cuenta', exact: true }).click();
    await page.locator('[name=nombre]').fill('Director B');
    await page.locator('[name=rol_id]').selectOption('1');
    await page.locator('[name=institucion]').fill('Instituto B');
    await page.locator('[name=email]').fill('director-b@example.test');
    await page.locator('[name=password]').fill('Prueba123!');
    await page.locator('[name=confirmation]').fill('Prueba123!');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await page.getByRole('heading', { name: 'Panel', exact: true }).waitFor();
    assert.doesNotMatch(await page.locator('body').textContent(), /San Rafael/);
    const second = await api('login', 'POST', {
      email: 'director-b@example.test',
      password: 'Prueba123!'
    });
    const secondInitial = (await api('data', 'GET', null, second.cookie)).data;
    assert.deepEqual(secondInitial.equipos, []);
    assert.deepEqual(secondInitial.sedes, []);
    assert.equal(secondInitial.usuarios.length, 1);
    assert.notEqual(secondInitial.instituto.codigo, code);
    await api(
      'institute/approval',
      'POST',
      { usuario_id: alice.data.user.id, aprobado: 0 },
      second.cookie,
      404
    );
    const secondTech = await api(
      'register',
      'POST',
      {
        ...member('Otro técnico', 'othertech@example.test', 2),
        codigo: secondInitial.instituto.codigo
      },
      null,
      201
    );
    await api(
      'institute/approval',
      'POST',
      { usuario_id: secondTech.data.user.id, aprobado: 1 },
      second.cookie
    );
    assert.deepEqual((await api('data', 'GET', null, secondTech.cookie)).data.reportes, []);
    await api('technician/repairs', 'POST', repair, secondTech.cookie, 404);
    // Provisional IDs and repeated equipment codes cannot overwrite another institute.
    const secondData = (await api('data', 'GET', null, second.cookie)).data;
    secondData.sedes.push({ id: 1, nombre: 'Sede de prueba', direccion: '' });
    secondData.tipos_equipo.push({ id: 1, nombre: 'Laptop' });
    secondData.ubicaciones.push({ id: 1, nombre: 'Aula', sede_id: 1 });
    secondData.equipos.push({
      id: 1,
      codigo: 'LAP-1',
      nombre: 'Laptop de B',
      tipo_id: 1,
      ubicacion_id: 1,
      estado: 'Activo'
    });
    const savedSecond = (await api('data', 'PUT', { data: secondData }, second.cookie)).data;
    assert.notEqual(savedSecond.equipos[0].id, 1);
    assert.equal(savedSecond.equipos[0].ubicacion_id, savedSecond.ubicaciones[0].id);
    const firstAfter = (await api('data', 'GET', null, admin.cookie)).data;
    assert.equal(firstAfter.equipos.length, 4);
    assert.equal(firstAfter.equipos[0].nombre, 'Laptop 1');
    const foreignReference = structuredClone(savedSecond);
    foreignReference.equipos[0].ubicacion_id = firstAfter.ubicaciones[0].id;
    await api('data', 'PUT', { data: foreignReference }, second.cookie, 400);
    await api(
      'data',
      'PUT',
      { data: { ...firstAfter, revision: savedSecond.revision }, restoring: true },
      second.cookie,
      403
    );
    await api('data', 'PUT', { data: savedSecond, restoring: true }, second.cookie);
    // The director approves and edits their students through the interface.
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.locator('[data-action=logout]').click();
    await page.locator('[name=email]').fill('admin@example.test');
    await page.locator('[name=password]').fill('Prueba123!');
    await page.locator('button[type=submit]').click();
    await page.getByRole('heading', { name: 'Panel', exact: true }).waitFor();
    await page.goto(base + '/#/usuarios/index');
    await page.getByRole('heading', { name: 'Usuarios', exact: true }).waitFor();
    assert.doesNotMatch(await page.locator('main').innerText(), /director-b@example.test/);
    await page.locator(`a[href="#/usuarios/edit?id=${alice.data.user.id}"]`).click();
    await page.locator('[name=nombre]').fill('Alicia estudiante');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByText('Alicia estudiante', { exact: true }).waitFor();
    await page.goto(base + '/#/configuracion/index');
    await page.locator('#institute-code').waitFor();
    assert.equal(await page.locator('#institute-code').textContent(), code);
    await page.screenshot({
      path: path.join(root, 'test-results/director-institute.png'),
      fullPage: true
    });
    await api(
      'institute/approval',
      'POST',
      { usuario_id: alice.data.user.id, aprobado: 0 },
      admin.cookie
    );
    assert.equal((await api('data', 'GET', null, alice.cookie)).data.scope, 'pending');
    await api(
      'student/reports',
      'POST',
      { prestamo_id: 3, descripcion: 'Suspendida' },
      alice.cookie,
      403
    );
    assert.deepEqual(errors, []);
    // Successful authentication queues mail; failed credentials never do.
    const [beforeFailure] = await sql.query('SELECT COUNT(*) AS total FROM avisos_correo');
    await api(
      'login',
      'POST',
      { email: 'alice@example.test', password: 'Incorrecta123!' },
      null,
      401
    );
    const [afterFailure] = await sql.query('SELECT COUNT(*) AS total FROM avisos_correo');
    assert.equal(afterFailure[0].total, beforeFailure[0].total);
    const [registered] = await sql.execute(
      "SELECT destinatario,tipo,contenido FROM avisos_correo WHERE usuario_id=? AND tipo='registro'",
      [alice.data.user.id]
    );
    assert.equal(registered.length, 1);
    assert.equal(registered[0].destinatario, 'alice@example.test');
    assert.doesNotMatch(registered[0].contenido, /Prueba123!/);
    mailPool = mysql.createPool({
      host: '127.0.0.1',
      port: 3307,
      user: 'root',
      password,
      database: name,
      connectionLimit: 3
    });
    const sent = [];
    const transport = {
      configured: true,
      send: async (job) => {
        sent.push(job.id);
        return 'test-' + job.id;
      }
    };
    const options = { transport, logger: { warn() {}, error() {} } };
    const worker = require('../server/mail.cjs').service(mailPool, options);
    const secondWorker = require('../server/mail.cjs').service(mailPool, options);
    await Promise.all([worker.processOne(), secondWorker.processOne()]);
    while (await worker.processOne()) {}
    assert.equal(sent.length, beforeFailure[0].total);
    assert.equal(new Set(sent).size, sent.length);
    const [remaining] = await sql.query(
      "SELECT COUNT(*) AS total FROM avisos_correo WHERE estado<>'enviado'"
    );
    assert.equal(remaining[0].total, 0);
    const pendingId = await worker.enqueue(alice.data.user, 'login');
    const failedWorker = require('../server/mail.cjs').service(mailPool, {
      transport: {
        configured: true,
        send: async () => {
          throw Error('GMAIL_SEND_429');
        }
      },
      logger: { warn() {}, error() {} }
    });
    await failedWorker.processOne();
    const [retry] = await sql.execute(
      'SELECT estado,intentos,ultimo_error FROM avisos_correo WHERE id=?',
      [pendingId]
    );
    assert.deepEqual(retry[0], {
      estado: 'pendiente',
      intentos: 1,
      ultimo_error: 'GMAIL_SEND_429'
    });
    await sql.execute('UPDATE avisos_correo SET disponible_en=NOW() WHERE id=?', [pendingId]);
    await secondWorker.processOne();
    const [retried] = await sql.execute('SELECT estado,intentos FROM avisos_correo WHERE id=?', [
      pendingId
    ]);
    assert.deepEqual(retried[0], { estado: 'enviado', intentos: 2 });
    console.log(
      'Email queue: successful auth only, isolated recipient, durable jobs, concurrent workers and retries passed.'
    );
    console.log(
      'Institutes: registration by role, approval, isolation, provisional IDs, student countdown/reports and technician repair workflow passed.'
    );
  } finally {
    await browser?.close();
    await mailPool?.end();
    if (server) {
      const exited = new Promise((resolve) => server.once('exit', resolve));
      server.kill();
      await exited;
    }
    if (/^inventic_test_student_\d+$/.test(name))
      await sql.query(`DROP DATABASE IF EXISTS \`${name}\``);
    await sql.end();
  }
})().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
