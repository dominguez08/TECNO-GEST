# InventIC

Sistema de inventario institucional con interfaz HTML, CSS y JavaScript, servidor Node.js y base de datos MySQL. No utiliza PHP.

## Cómo iniciar

1. En VS Code, abre `InventIC.code-workspace` y pulsa **F5**. Inicia el servidor y abre el navegador. También puedes ejecutar `Iniciar InventIC.cmd` o `npm start` desde esta carpeta.
2. Abre **http://localhost:3000**.
3. En el primer acceso, crea tu cuenta administradora con nombre, correo y contraseña. No hay credenciales predeterminadas.
4. En los siguientes accesos, inicia sesión con esa cuenta.

El iniciador usa MySQL 8 de WAMP y una instancia independiente en el puerto 3307. La base nueva se llama `inventic_html`; sus archivos están en `mysql-data/`. No modifica la base anterior de WAMP. La conexión del servidor se configura en `.env`. `MYSQL_BIN` permite indicar otra ubicación de `mysqld.exe`.

Mantén el servidor en ejecución mientras uses la aplicación. Live Server (puerto 5500 o 5501) puede mostrar la interfaz y conectarse al servidor en el puerto 3000, pero no inicia Node ni MySQL. Si ves un error de localhost, pulsa F5 o ejecuta `npm start`; abrir un HTML con doble clic no inicia el servidor.

## Funciones

- Acceso con correo y contraseña, creación de la primera cuenta y cierre de sesión.
- Usuarios con roles Administrador, Técnico y Docente. Los permisos de escritura se revisan también en el servidor.
- Panel, inventario, fotografías, registro y edición de equipos.
- Préstamos, devoluciones, fallas y mantenimiento.
- Configuración separada en Apariencia, Usuarios y roles, Categorías, Sedes y Respaldos.
- Edición de perfil, apariencia y cambio de contraseña con comprobación de la contraseña actual.
- Búsqueda, filtros, exportación CSV e impresión de reportes.
- Respaldos JSON de registros y configuración. No contienen contraseñas. Las fotografías iniciales utilizan `assets/images/`; las imágenes subidas se incluyen en los datos. Conserva también esa carpeta al trasladar el proyecto.

Al restaurar, las contraseñas de las cuentas existentes se conservan por identificador. Para cuentas restauradas que no existían, el administrador debe asignar nuevas contraseñas desde Usuarios. El respaldo debe conservar la cuenta administradora que realiza la operación.

## Organización del código

| Archivo o carpeta | Función |
| --- | --- |
| `index.html` | Página principal y carga de archivos |
| `modules/**/*.html` | Estructura propia de cada pantalla: encabezados, formularios y campos |
| `auth/login.html` | Estructura de la pantalla de acceso |
| `assets/app.js` | Datos de las pantallas, navegación y eventos de formularios |
| `assets/views.js` | Carga las plantillas HTML y completa sus valores dinámicos |
| `assets/api.js` | Detecta el servidor y gestiona errores de conexión |
| `assets/auth.js` | Solicitudes de inicio y cierre de sesión |
| `assets/store.js` | Lectura y guardado mediante la API |
| `assets/validation.js` | Validaciones compartidas por cliente y servidor |
| `assets/*.css` | Estilos, componentes y diseño adaptable |
| `assets/images/` | Fotografías del catálogo inicial |
| `server/index.cjs` | Servidor HTTP, sesiones y rutas de la API |
| `server/database.cjs` | Consultas y transacciones MySQL |
| `server/permissions.cjs` | Reglas de acceso por rol |
| `server/security.cjs` | Cálculo y comprobación de contraseñas |
| `database.sql` | Tablas, claves y relaciones de la base nueva |
| `tools/start.cjs` | Inicio de MySQL y del servidor |
| `tests/mysql-smoke.cjs` | Pruebas en una base temporal independiente |

Los archivos están indentados y organizados en varias líneas. `npm run format` aplica el formato definido en `.prettierrc.json`.

Cada HTML contiene su estructura dentro de un elemento `template`. Las marcas como `{{nombre}}` se completan con los datos de MySQL; las listas y tablas las prepara JavaScript. Para cambiar un formulario, edita el HTML de su módulo. El CSS de `assets/theme.css` define una paleta para claro y otra para oscuro.

## Datos y seguridad

El catálogo inicial contiene los 23 equipos recuperados del proyecto y sus fotografías. No se importaron automáticamente las cuentas o el historial de la base anterior. Los respaldos SQL y archivos antiguos permanecen en `storage/`.

Los datos de trabajo se guardan en MySQL, no en `localStorage`. Las contraseñas se almacenan con scrypt y una sal individual. La sesión usa una cookie HttpOnly y caduca a las ocho horas. Reiniciar el servidor requiere iniciar sesión nuevamente. Las transacciones revierten los cambios si una operación falla; una revisión de datos impide sobrescribir silenciosamente cambios de otra sesión.

Esta instalación escucha únicamente en la computadora local. No publiques `.env`, `.runtime/`, `mysql-data/` ni `storage/`. Para un despliegue remoto hacen falta configuración del servidor y HTTPS; no basta con copiar los HTML a un alojamiento estático.

## Pruebas

Requisitos de desarrollo: Node.js, MySQL activo, Playwright disponible y Edge instalado (o `TEST_BROWSER=chrome`). El entorno actual dispone de Playwright en el runtime de Codex. En otro entorno se puede instalar como dependencia de desarrollo.

Ejecuta `npm test`. La prueba crea una base `inventic_test_<fecha>`, arranca otro servidor y comprueba acceso, sesión, permisos, configuración, inventario, préstamos, mantenimiento, usuarios, respaldo y diseño móvil. Elimina solo esa base temporal al terminar; no modifica `inventic_html`.

Los documentos históricos restantes pueden describir versiones anteriores del proyecto. Este README corresponde a la versión actual.
