# InventIC

Sistema de inventario institucional con interfaz HTML, CSS y JavaScript, servidor Node.js y base de datos MySQL. No utiliza PHP.

## Descargar y abrir en otra laptop

Descarga el ZIP de GitHub y **extrae toda la carpeta** antes de iniciar. No ejecutes los archivos dentro del ZIP ni abras `index.html` con doble clic.

### Windows con Node.js y MySQL

1. Instala [Node.js 22 o superior](https://nodejs.org/) y MySQL 8 (también sirve el MySQL incluido en WAMP). Si acabas de instalarlos, vuelve a abrir VS Code.
2. Haz doble clic en **Iniciar InventIC.cmd**. También puedes abrir `InventIC.code-workspace` en VS Code y pulsar **F5**, o ejecutar `npm start`.
3. La primera vez se descargan las dependencias, se crea una instancia MySQL independiente, se carga el catálogo inicial y se genera `.env` con contraseñas aleatorias. Necesitas Internet para descargar las dependencias.
4. Abre la dirección que indica la consola, normalmente **http://localhost:3000**. Si ese puerto estaba ocupado al instalar, se elige otro libre.
5. Crea la cuenta administradora de esa laptop. No hay correo ni contraseña predeterminados.

El iniciador busca MySQL en PATH, en las carpetas habituales de WAMP y en Program Files/MySQL; no depende de una versión concreta de WAMP. Para otra ubicación, define `MYSQL_BIN` con la ruta de `mysqld.exe`. La base nueva se llama `inventic_html`; los archivos se guardan en `mysql-data/` dentro del proyecto. Se utiliza un puerto libre a partir de 3307 y no se alteran las bases de otros programas.

En los siguientes inicios se conservan la cuenta, los datos y la configuración. Si tienes un `.env` propio, se respeta: ese servidor MySQL debe existir y estar disponible. No borres `.env`, `.runtime/` ni `mysql-data/` de una instalación que ya tenga datos.

### Alternativa con Docker Desktop

Esta opción incluye Node y MySQL dentro de los contenedores; no necesitas instalarlos por separado.

1. Instala y abre [Docker Desktop](https://www.docker.com/products/docker-desktop/), con contenedores Linux.
2. Ejecuta **Iniciar con Docker.cmd**. La primera vez descarga las imágenes, genera `.docker.env`, construye la aplicación y crea la base. Necesita Internet y puede tardar varios minutos.
3. Cuando aparezca «InventIC disponible», abre **http://localhost:3000** y crea tu cuenta.

Para detener esta instalación: `docker compose --env-file .docker.env down`. Los datos permanecen en el volumen de Docker. Conserva `.docker.env` para volver a conectar con esa base. Utiliza una sola opción de inicio a la vez: Docker y la instalación local necesitan el puerto 3000.

La preparación de Docker usa la espera de servicios saludables de [Docker Compose](https://docs.docker.com/reference/cli/docker/compose/up/). La instalación local crea su directorio independiente mediante el procedimiento de [inicialización de MySQL](https://dev.mysql.com/doc/refman/8.0/en/data-directory-initialization.html).

Mantén el servidor en ejecución mientras uses la aplicación. Live Server (puerto 5500 o 5501) puede mostrar la interfaz y conectarse al servidor en el puerto 3000, pero no inicia Node ni MySQL. Si ves un error de localhost, pulsa F5 o ejecuta `npm start`; abrir un HTML con doble clic no inicia el servidor.

GitHub contiene el código y el catálogo inicial, no tus contraseñas ni tu base personal. Para trasladar registros de otra laptop, utiliza Configuración → Respaldos. Una instalación nueva empieza con su propia cuenta administradora.

## Si aparece un error de credenciales en otra computadora

- **«MySQL rechazó las credenciales…»** corresponde a la conexión del servidor, no a tu cuenta de InventIC. El archivo `.env` debe coincidir con el MySQL de esa computadora; copiar solamente el `.env` de otra instalación no crea allí el usuario ni la base.
- Para empezar una instalación independiente, extrae el ZIP de GitHub en **una carpeta nueva** y ejecuta `Iniciar InventIC.cmd`. El iniciador genera su propia configuración. Conserva intacta la carpeta anterior si contiene datos; no borres `.env`, `.runtime/` ni `mysql-data/` para intentar reparar el acceso.
- **«Correo o contraseña incorrectos»** corresponde al inicio de sesión de InventIC. Una instalación nueva permite crear su primera cuenta. Si aparece «Iniciar sesión», la base conectada ya tiene una cuenta administradora y debes utilizar una cuenta de esa instalación.
- Abre la dirección que imprime la consola y mantenla abierta. No uses el HTML directamente ni una dirección de otra instalación.

## Funciones

### Dominio público en Railway

El servidor permite el origen HTTPS indicado por `RAILWAY_PUBLIC_DOMAIN`, que Railway
proporciona al generar un dominio. Para un dominio personalizado, configura
`APP_ORIGIN=https://tu-dominio.com` en las variables del servicio y vuelve a desplegar.
Solo configura dominios propios de esta aplicación; las solicitudes de escritura
desde otros sitios siguen bloqueadas. El servidor debe escuchar con `HOST=0.0.0.0`.

Prueba de esta configuración: `node --test tests/origins.cjs`.

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
| `tools/setup.cjs` | Dependencias, detección de MySQL y preparación automática de una copia nueva |
| `compose.yaml` | Instalación alternativa con Node y MySQL en Docker |
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
