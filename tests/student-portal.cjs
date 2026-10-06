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
  let server, browser;
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
        HOST: '127.0.0.1'
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
    const admin = await api('setup', 'POST', account('Admin', 'admin@example.test'), null, 201);
    const alice = await api('register', 'POST', account('Alice', 'alice@example.test'), null, 201);
    const bob = await api('register', 'POST', account('Bob', 'bob@example.test'), null, 201);
    assert.equal(alice.data.user.rol_id, 3);
    await api('register', 'POST', account('Alice', 'alice@example.test'), null, 409);
    await api('data', 'GET', null, null, 401);
    await api('data', 'PUT', { data: {} }, alice.cookie, 403);
    assert.deepEqual((await api('data', 'GET', null, alice.cookie)).data.prestamos, []);
    await sql.query("INSERT INTO tipos_equipo (nombre) VALUES ('Laptop')");
    await sql.query("INSERT INTO sedes (nombre) VALUES ('Sede de prueba')");
    await sql.query("INSERT INTO ubicaciones (nombre,sede_id) VALUES ('Aula',1)");
    for (let id = 1; id <= 4; id++)
      await sql.execute(
        'INSERT INTO equipos (id,codigo,nombre,tipo_id,ubicacion_id) VALUES (?,?,?,1,1)',
        [id, 'LAP-' + id, 'Laptop ' + id]
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
    await page.locator('[name=email]').fill('carla@example.test');
    await page.locator('[name=password]').fill('Prueba123!');
    await page.locator('[name=confirmation]').fill('Prueba123!');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
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
    console.log(
      'Student portal: registration, login, countdown, reporting, isolation, permissions, persistence and admin return passed.'
    );
  } finally {
    await browser?.close();
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
