const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn } = require('node:child_process');
const mysql = require('mysql2/promise');
const { install } = require('../tools/install-database.cjs');

const root = path.resolve(__dirname, '..');
const databaseName = 'inventic_test_' + Date.now();
const adminPassword = JSON.parse(
  fs.readFileSync(path.join(root, '.runtime/mysql-admin.json'), 'utf8')
).password;

(async () => {
  const sql = await mysql.createConnection({
    host: '127.0.0.1',
    port: 3307,
    user: 'root',
    password: adminPassword
  });
  let browser;
  let server;
  let liveServer;
  let serverOutput = '';
  try {
    await install(sql, databaseName);
    liveServer = require('node:http').createServer((request, response) => {
      response.writeHead(200, { 'Content-Type': 'text/html' });
      response.end('<!doctype html><title>Live Server</title>');
    });
    await new Promise((resolve, reject) => {
      liveServer.once('error', reject);
      liveServer.listen(0, '127.0.0.1', resolve);
    });
    const livePort = liveServer.address().port;
    const socket = net.createServer();
    await new Promise((resolve) => socket.listen(0, '127.0.0.1', resolve));
    const port = socket.address().port;
    await new Promise((resolve) => socket.close(resolve));
    const base = `http://127.0.0.1:${port}`;
    server = spawn(process.execPath, ['server/index.cjs'], {
      cwd: root,
      env: {
        ...process.env,
        DB_NAME: databaseName,
        DB_USER: 'root',
        DB_PASS: adminPassword,
        PORT: String(port),
        LIVE_SERVER_PORT: String(livePort)
      },
      windowsHide: true
    });
    server.stderr.on('data', (chunk) => {
      serverOutput += chunk;
    });
    for (let i = 0; i < 50; i++) {
      try {
        if ((await fetch(base + '/api/session')).ok) break;
      } catch {}
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
    assert.equal((await fetch(base + '/api/data')).status, 401);
    for (const file of [
      '/.env',
      '/mysql-data/auto.cnf',
      '/storage/legacy-database-config.txt',
      '/server/index.cjs'
    ]) {
      assert.equal((await fetch(base + file)).status, 404);
    }
    browser = await chromium.launch({
      headless: true,
      channel: process.env.TEST_BROWSER || 'msedge'
    });
    const context = await browser.newContext({
      viewport: { width: 1440, height: 960 },
      acceptDownloads: true
    });
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('dialog', (dialog) => dialog.accept());
    const read = () => page.evaluate(() => fetch('/api/data').then((response) => response.json()));
    const visit = async (route, heading) => {
      await page.goto(base + '/#/' + route);
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
    };
    const save = async (status = 200) => {
      const response = page.waitForResponse(
        (response) => response.url().endsWith('/api/data') && response.request().method() === 'PUT'
      );
      await page.getByRole('button', { name: 'Guardar', exact: true }).click();
      const result = await response;
      assert.equal(result.status(), status, JSON.stringify(await result.json()));
    };
    const login = async (email = 'admin@example.test', password = 'Prueba123!') => {
      await page.getByLabel('Correo electrónico *').fill(email);
      await page.getByLabel('Contraseña *', { exact: true }).fill(password);
      await page.getByRole('button', { name: 'Entrar', exact: true }).click();
      await page.getByRole('heading', { name: 'Panel', exact: true }).waitFor();
    };
    const logout = async () => {
      await page.getByRole('button', { name: 'Cerrar sesión', exact: true }).click();
      await page.getByRole('heading', { name: 'Iniciar sesión', exact: true }).waitFor();
    };
    const shot = async (name) => {
      if (!process.env.QA_SCREEN_DIR) return;
      fs.mkdirSync(process.env.QA_SCREEN_DIR, { recursive: true });
      await page.evaluate(
        () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)))
      );
      await page.screenshot({
        path: path.join(process.env.QA_SCREEN_DIR, name + '.png'),
        fullPage: false
      });
    };

    await page.goto(base);
    await page.getByRole('heading', { name: 'Crea tu cuenta' }).waitFor();
    await page.getByLabel('Nombre completo *').fill('Administrador');
    await page.getByLabel('Correo electrónico *').fill('admin@example.test');
    await page.getByLabel('Contraseña *', { exact: true }).fill('Prueba123!');
    await page.getByLabel('Confirmar contraseña *').fill('Prueba123!');
    await page.getByRole('button', { name: 'Crear cuenta', exact: true }).click();
    await page.getByRole('heading', { name: 'Panel', exact: true }).waitFor();
    assert.equal((await read()).equipos.length, 23);
    assert.ok((await read()).usuarios.every((user) => !('password' in user)));
    await shot('panel');
    await page.getByRole('button', { name: '☾ Modo oscuro', exact: true }).click();
    await shot('panel-dark');
    const darkCard = await page
      .locator('.metric-card strong')
      .first()
      .evaluate((element) => getComputedStyle(element).color);
    assert.equal(darkCard, 'rgb(232, 238, 247)');
    await page.getByRole('button', { name: '☀ Modo claro', exact: true }).click();
    const lightCard = await page
      .locator('.metric-card strong')
      .first()
      .evaluate((element) => getComputedStyle(element).color);
    assert.equal(lightCard, 'rgb(24, 43, 69)');
    await logout();
    await shot('login');
    await page.getByRole('button', { name: '☾ Modo oscuro', exact: true }).click();
    await shot('login-dark');
    await page.getByRole('button', { name: '☀ Modo claro', exact: true }).click();
    await page.getByLabel('Correo electrónico *').fill('admin@example.test');
    await page.getByLabel('Contraseña *', { exact: true }).fill('Incorrecta123');
    await page.getByRole('button', { name: 'Entrar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'incorrectos' }).waitFor();
    await login();
    assert.equal(await page.evaluate(() => document.cookie.includes('inventic_session')), false);

    for (const [route, heading] of [
      ['equipos', 'Inventario'],
      ['prestamos', 'Préstamos'],
      ['mantenimiento', 'Mantenimiento'],
      ['ubicaciones', 'Ubicaciones'],
      ['reportes', 'Reportes de fallas'],
      ['estadisticas', 'Reportes'],
      ['configuracion', 'Configuración'],
      ['usuarios', 'Usuarios'],
      ['perfil', 'Mi perfil']
    ]) {
      await visit(route + '/index', heading);
      const duplicates = await page.evaluate(() => {
        const ids = [...document.querySelectorAll('[id]')].map((element) => element.id);
        return ids.length - new Set(ids).size;
      });
      assert.equal(duplicates, 0, route + ' tiene identificadores repetidos');
    }
    await visit('configuracion/index', 'Configuración');
    assert.equal(await page.getByLabel('Nombre del sistema *').count(), 0);
    await page.getByRole('button', { name: 'Oscuro', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.reload();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'dark');
    await page.getByRole('button', { name: 'Claro', exact: true }).click();
    assert.equal(await page.locator('html').getAttribute('data-theme'), 'light');
    await shot('configuracion');
    await visit('configuracion/index?tab=categorias', 'Configuración');
    await page.getByLabel('Nombre *', { exact: true }).fill('Categoría nueva');
    await save();
    await page.getByRole('status').waitFor();
    assert.ok((await read()).tipos_equipo.some((row) => row.nombre === 'Categoría nueva'));

    await visit('equipos/create', 'Registrar equipo');
    await page.getByLabel('Código *', { exact: true }).fill('TEST-001');
    await page.getByLabel('Nombre *', { exact: true }).fill('Prueba <img src=x onerror=alert(1)>');
    await page.getByLabel('Categoría *').selectOption('1');
    await page.getByLabel('Ubicación *').selectOption('1');
    await save();
    await page.waitForURL('**/#/equipos/index');
    const equipment = (await read()).equipos.find((row) => row.codigo === 'TEST-001');
    assert.ok(equipment);
    await page.reload();
    await page.getByRole('heading', { name: 'Inventario', exact: true }).waitFor();
    await visit('equipos/edit?id=' + equipment.id, 'Editar equipo');
    await page.getByLabel('Marca', { exact: true }).fill('Marca editada');
    await save();
    await page.waitForURL('**/#/equipos/index');
    assert.equal(
      (await read()).equipos.find((row) => row.id === equipment.id).marca,
      'Marca editada'
    );

    await visit('prestamos/create', 'Registrar préstamo');
    await page.getByLabel('Equipo *', { exact: true }).selectOption(String(equipment.id));
    await page.getByLabel('Prestatario *').selectOption('1');
    await page.getByLabel('Fecha de salida *').fill('2026-09-22');
    await page.getByLabel('Devolución prevista *').fill('2026-09-30');
    await save();
    await page.waitForURL('**/#/prestamos/index');
    await visit('prestamos/create', 'Registrar préstamo');
    assert.equal(
      await page.locator(`select[name="equipo_id"] option[value="${equipment.id}"]`).count(),
      0
    );
    await visit('prestamos/index', 'Préstamos');
    await page.getByRole('button', { name: 'Registrar devolución' }).click();
    await page.getByRole('status').waitFor();
    assert.ok((await read()).prestamos[0].devuelto_en);
    await visit('reportes/create', 'Reportar falla');
    await page.getByLabel('Equipo *', { exact: true }).selectOption(String(equipment.id));
    await page.getByLabel('Descripción de la falla').fill('No enciende');
    await save();
    await page.waitForURL('**/#/reportes/index');
    const report = (await read()).reportes.at(-1);
    await visit('mantenimiento/view?id=' + report.id, 'Detalle de falla');
    await page.getByLabel('Estado *', { exact: true }).selectOption('5');
    await page.getByRole('button', { name: 'Guardar', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'solución' }).waitFor();
    await page.getByLabel('Solución (obligatoria al finalizar)').fill('Se cambió el cable');
    await save();
    await page.getByRole('status').waitFor();
    assert.equal((await read()).reportes.at(-1).estado_id, 5);

    await visit('usuarios/create', 'Nuevo usuario');
    await page.getByLabel('Nombre *', { exact: true }).fill('Docente');
    await page.getByLabel('Correo *', { exact: true }).fill('docente@example.test');
    await page.getByLabel('Contraseña *', { exact: true }).fill('Docente123!');
    await page.getByLabel('Confirmar contraseña *', { exact: true }).fill('Docente123!');
    await save();
    await page.waitForURL('**/#/usuarios/index');
    await logout();
    await login('docente@example.test', 'Docente123!');
    assert.equal(
      await page
        .getByRole('navigation')
        .getByRole('link', { name: 'Configuración', exact: true })
        .count(),
      0
    );
    const denied = await page.evaluate(async () => {
      const data = await fetch('/api/data').then((response) => response.json());
      data.configuracion.nombre = 'No permitido';
      const response = await fetch('/api/data', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      return response.status;
    });
    assert.equal(denied, 403);
    await visit('perfil/index', 'Mi perfil');
    await page.getByLabel('Teléfono').fill('5555-1234');
    await save();
    await page.getByRole('status').waitFor();
    await logout();
    await login();

    await visit('configuracion/index?tab=respaldo', 'Configuración');
    const downloadEvent = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Descargar respaldo JSON' }).click();
    const download = await downloadEvent;
    const backup = JSON.parse(fs.readFileSync(await download.path(), 'utf8'));
    assert.equal(backup.equipos.length, 24);
    assert.ok(backup.usuarios.every((user) => !user.password));
    await page.locator('#backup').setInputFiles({
      name: 'backup.json',
      mimeType: 'application/json',
      buffer: Buffer.from(JSON.stringify(backup))
    });
    await page.getByRole('button', { name: 'Importar respaldo' }).click();
    await page.getByRole('heading', { name: 'Iniciar sesión', exact: true }).waitFor();
    await login();
    await page.setViewportSize({ width: 390, height: 844 });
    for (const [route, heading] of [
      ['configuracion/index', 'Configuración'],
      ['equipos/index', 'Inventario']
    ]) {
      await visit(route, heading);
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot('mobile-' + route.split('/')[0]);
      await page.getByRole('button', { name: '☾ Modo oscuro', exact: true }).click();
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await shot('mobile-dark-' + route.split('/')[0]);
      await page.getByRole('button', { name: '☀ Modo claro', exact: true }).click();
    }
    await page.getByRole('button', { name: '☰ Menú' }).click();
    assert.ok(await page.locator('#sidebar-wrapper').isVisible());
    await page.goto(base + '/modules/equipos/view.html?id=' + equipment.id);
    await page
      .getByRole('heading', { name: 'Prueba <img src=x onerror=alert(1)>', exact: true })
      .waitFor();
    assert.equal(await page.locator('img[src=x]').count(), 0);
    for (const [file, heading] of [
      ['equipos/create', 'Registrar equipo'],
      ['equipos/edit?id=' + equipment.id, 'Editar equipo'],
      ['ubicaciones/create', 'Nueva ubicación'],
      ['usuarios/create', 'Nuevo usuario'],
      ['prestamos/create', 'Registrar préstamo']
    ]) {
      const [filePath, query = ''] = file.split('?');
      await page.goto(base + '/modules/' + filePath + '.html' + (query ? '?' + query : ''));
      await page.getByRole('heading', { name: heading, exact: true }).waitFor();
      assert.equal(await page.locator('form[data-form] button[type="submit"]').count(), 1);
    }
    for (const width of [320, 768]) {
      await page.setViewportSize({ width, height: 900 });
      await visit('configuracion/index', 'Configuración');
      assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    }
    await page.setViewportSize({ width: 1440, height: 960 });
    await logout();
    const second = await browser.newContext();
    assert.equal((await second.request.get(base + '/api/data')).status(), 401);
    await second.close();
    // Comprueba cookies y preflight desde Live Server con ambos nombres locales.
    for (const hostname of ['127.0.0.1', 'localhost']) {
      const live = await browser.newContext();
      const livePage = await live.newPage();
      livePage.on('requestfailed', (request) => console.error(request.url(), request.failure()));
      livePage.on('console', (message) => {
        if (message.type() === 'error') console.error(message.text());
      });
      await livePage.goto(`http://${hostname}:${livePort}/index.html`);
      for (const filename of ['api.js', 'validation.js', 'auth.js', 'store.js']) {
        const source = fs.readFileSync(path.join(root, 'assets', filename), 'utf8');
        await livePage.addScriptTag({ content: source.replaceAll(':3000/api', `:${port}/api`) });
      }
      const result = await livePage.evaluate(async () => {
        await InventicAuth.signIn({ email: 'admin@example.test', password: 'Prueba123!' });
        const session = await InventicAuth.load();
        const email = session.user.email;
        const data = await InventicStore.load();
        await InventicStore.write(data);
        await InventicAuth.signOut();
        return { email, loggedOut: !(await InventicAuth.load()).user };
      });
      assert.equal(result.email, 'admin@example.test');
      assert.equal(result.loggedOut, true);
      await live.close();
    }
    const [records] = await sql.query('SELECT COUNT(*) AS total FROM equipos');
    assert.equal(records[0].total, 24);
    const [passwords] = await sql.query('SELECT password FROM usuarios');
    assert.ok(passwords.every((row) => row.password && !row.password.includes('Prueba123')));
    assert.deepEqual(errors, []);
    console.log(
      'PASS: MySQL, login, sesión, permisos, configuración, inventario, préstamos, mantenimiento, usuarios, respaldos y diseño móvil.'
    );
  } catch (error) {
    console.error(error);
    if (serverOutput) console.error(serverOutput);
    process.exitCode = 1;
  } finally {
    if (liveServer) await new Promise((resolve) => liveServer.close(resolve));
    if (browser) await browser.close();
    if (server) {
      server.kill();
      await new Promise((resolve) => server.once('exit', resolve));
    }
    if (!/^inventic_test_\d+$/.test(databaseName)) throw Error('Base de prueba inválida.');
    await sql.query(`DROP DATABASE \`${databaseName}\``);
    await sql.end();
  }
})();
