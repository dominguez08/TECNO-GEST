# InventIC

InventIC administra inventarios, préstamos, fallas y reparaciones de varios institutos. Cada instituto tiene sus propios usuarios y datos. La aplicación usa Node.js y MySQL.

## Uso local en Windows

Requisitos: Node.js 22 o superior y MySQL 8. También puedes usar MySQL incluido en WAMP.

1. Descarga el proyecto y extrae la carpeta completa.
2. Ejecuta `Iniciar InventIC.cmd` o abre una terminal en la carpeta y ejecuta `npm start`.
3. Abre la dirección indicada, normalmente `http://localhost:3000`.
4. Pulsa **Crear cuenta**, elige **Administrador / director** y escribe el nombre de tu instituto.
5. Configura tus sedes, categorías de equipo y usuarios desde el panel.

La primera instalación crea una base MySQL y genera las credenciales en `.env`. Las siguientes ejecuciones conservan los datos. No borres `.env`, `.runtime/` ni `mysql-data/` si necesitas conservar la información.

No abras `index.html` directamente: la aplicación necesita el servidor Node.js y MySQL.

## Uso con Docker

1. Instala y abre Docker Desktop con contenedores Linux.
2. Ejecuta `Iniciar con Docker.cmd`.
3. Abre `http://localhost:3000` y registra la cuenta del director y su instituto.

Para detenerlo, ejecuta `docker compose --env-file .docker.env down`. El volumen de MySQL conserva los datos.

## Despliegue en Railway

1. Crea un servicio MySQL en el mismo proyecto.
2. En el servicio de la aplicación configura:

```dotenv
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASS=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
HOST=0.0.0.0
```

3. En Networking genera un dominio público para el puerto indicado por Railway.
4. Abre el dominio y registra tu instituto desde **Crear cuenta**.

`RAILWAY_PUBLIC_DOMAIN` se acepta automáticamente como origen de los formularios. Para un dominio propio, añade `APP_ORIGIN=https://tu-dominio.com`.

## Registrar un instituto y sus integrantes

La pantalla de acceso contiene **Iniciar sesión** y **Crear cuenta**. Cada correo corresponde a una cuenta y un instituto.

1. El director elige **Administrador / director**, completa sus datos y el nombre del instituto. Se crea un espacio vacío, sin sedes ni equipos de ejemplo.
2. En **Configuración → Mi instituto**, consulta el código del instituto y lo comparte con sus estudiantes y técnicos. También puede editar el nombre del instituto.
3. Cada integrante elige **Estudiante** o **Técnico**, introduce el código y crea su cuenta. Queda pendiente de aprobación.
4. El director entra en **Usuarios** para aprobar el acceso, editar los datos y roles, crear cuentas o suspenderlas. Solo ve a los integrantes de su instituto.
5. Una vez aprobado, el integrante pulsa **Actualizar** o vuelve a iniciar sesión.

Registrarse como director crea un instituto nuevo; no concede acceso a otro existente. Para incorporar otro administrador al mismo instituto, su director debe crear o cambiar el rol de esa cuenta desde **Usuarios**. Si el director ya creó tu cuenta, utiliza las credenciales que te haya asignado en **Iniciar sesión**.

## Préstamos, fallas y reparaciones

| Rol                      | Funciones                                                                                                                                                        |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Administrador / director | Gestiona usuarios, sedes, equipos, préstamos, devoluciones, fallas y configuración de su instituto.                                                              |
| Técnico                  | Consulta las fallas de su instituto y registra diagnósticos y reparaciones. No accede al inventario general, a los préstamos ni a la administración de usuarios. |
| Estudiante               | Consulta únicamente sus préstamos, el tiempo restante y sus reportes de fallas.                                                                                  |

1. El director registra las sedes, ubicaciones y equipos, y asigna el préstamo a un estudiante aprobado.
2. El estudiante abre **Mis préstamos** para consultar sus equipos y el tiempo restante. El plazo termina a las 23:59 de la fecha de devolución, hora de El Salvador; el contador se actualiza automáticamente.
3. Para reportar una falla, selecciona su equipo, describe el problema y pulsa **Enviar falla**. Solo puede existir una falla abierta por equipo.
4. El director consulta la falla y registra la devolución. El equipo con una falla abierta pasa a mantenimiento.
5. El técnico abre **Fallas y reparaciones**. Puede atender una falla sin asignar o una que el director le haya asignado. Al guardar una falla sin asignar, queda a su cargo.
6. El técnico registra el diagnóstico y cambia el estado a **En revisión**, **En reparación** o **Reparado**. Para finalizar debe indicar una solución; el equipo vuelve a estar disponible.

El botón **Actualizar** consulta los cambios recientes. Los reportes finalizados y las reparaciones asignadas a otros técnicos se muestran como consulta.

## Avisos de registro e inicio de sesión

Cada registro exitoso genera un aviso de creación de cuenta y acceso. Cada inicio de sesión correcto genera un aviso independiente, dirigido exclusivamente al correo de esa cuenta. Los intentos fallidos no envían avisos. Los mensajes incluyen la fecha y hora de El Salvador, sin contraseñas ni datos de otros usuarios.

El envío utiliza la [API de Gmail](https://developers.google.com/workspace/gmail/api/guides/sending) por HTTPS. Para activarlo:

1. Habilita Gmail API en un proyecto de Google Cloud y configura un cliente OAuth para la cuenta remitente.
2. Autoriza únicamente el permiso `https://www.googleapis.com/auth/gmail.send` con acceso sin conexión para obtener un refresh token. Sigue el [flujo OAuth de Google](https://developers.google.com/identity/protocols/oauth2/web-server). No uses la contraseña normal de Gmail.
3. Guarda estas variables privadas en Railway (o en `.env` para uso local):

```dotenv
MAIL_FROM=tu-cuenta@gmail.com
GMAIL_CLIENT_ID=identificador_del_cliente_oauth
GMAIL_CLIENT_SECRET=secreto_del_cliente_oauth
GMAIL_REFRESH_TOKEN=token_de_actualizacion_autorizado
```

4. Vuelve a desplegar. Prueba un registro y un inicio de sesión con un correo que controles y comprueba la bandeja de entrada y spam. `MAIL_FROM` debe coincidir con la cuenta autorizada o un alias de envío configurado en Gmail.

Sin estas credenciales, los avisos quedan pendientes y el registro e inicio de sesión continúan funcionando. La cola `avisos_correo` se guarda en MySQL y sobrevive a reinicios. El servidor reintenta hasta cinco veces; descarta como fallidos los avisos pendientes de más de 24 horas. `enviado` significa que Gmail aceptó el mensaje, no que el destinatario lo haya leído o que haya llegado a su bandeja de entrada. Un fallo de conexión después de la aceptación puede provocar un duplicado al reintentar.

Si Google revoca la autorización o expira el refresh token, autoriza de nuevo la cuenta y actualiza la variable privada. Las aplicaciones OAuth en modo de pruebas pueden tener autorizaciones de duración limitada. No publiques estas credenciales ni las incluyas en respaldos.

## Almacenamiento y respaldos

Los avisos de registro e inicio de sesión incluyen el logo de InventIC como imagen PNG integrada en el correo, junto con una versión HTML y otra de texto. El recurso utilizado es `assets/logo-mail.png`.

Los usuarios, inventarios, préstamos, fallas, reparaciones y configuraciones se guardan en MySQL. El navegador no usa `localStorage` para guardar datos de trabajo. Las contraseñas se almacenan con scrypt y las sesiones usan una cookie HttpOnly.

Cada instituto nuevo comienza vacío. Las consultas y modificaciones se limitan al instituto de la cuenta autenticada. Desde **Configuración → Respaldos**, el director puede exportar sus datos a JSON, sin contraseñas, y restaurar un respaldo del mismo instituto. Las cuentas recuperadas sin contraseña necesitan que el director les asigne una.

Al iniciar una base de una versión anterior, la migración conserva sus cuentas y registros en el instituto existente. Su director puede cambiar el nombre y consultar el código desde Configuración. Las etiquetas antiguas de la sede de ejemplo se sustituyen por una etiqueta neutra sin eliminar los equipos asociados. El usuario MySQL que ejecute la migración necesita permisos para crear y alterar tablas; el iniciador local usa las credenciales privadas de instalación cuando están disponibles.

## Estructura principal

| Ruta                      | Función                                           |
| ------------------------- | ------------------------------------------------- |
| `assets/app.js`           | Navegación, pantallas y formularios               |
| `assets/api.js`           | Comunicación con el servidor                      |
| `assets/store.js`         | Lectura y escritura mediante la API               |
| `assets/validation.js`    | Validaciones del cliente y del servidor           |
| `server/index.cjs`        | Servidor HTTP y rutas de la API                   |
| `server/database.cjs`     | Consultas y transacciones del administrador       |
| `server/institutions.cjs` | Registro, aprobación y migración de institutos    |
| `server/student.cjs`      | Préstamos y reportes propios del estudiante       |
| `server/technician.cjs`   | Consulta de fallas y reparaciones del técnico     |
| `server/permissions.cjs`  | Permisos de modificaciones administrativas        |
| `database.sql`            | Esquema base; el iniciador aplica las migraciones |
| `tools/start.cjs`         | Inicio local                                      |
| `compose.yaml`            | Servicios Docker                                  |

## Pruebas y formato

```bash
npm test
npm run format
```

Las pruebas necesitan MySQL local en el puerto 3307, las credenciales de `.runtime/mysql-admin.json` (o la ruta indicada en `TEST_MYSQL_ADMIN_FILE`) y Microsoft Edge. Crean y eliminan bases de prueba independientes. Comprueban la migración, el aislamiento entre institutos, los permisos de cada rol y los flujos de registro, préstamos y reparación en el navegador.

No publiques `.env`, `.runtime/`, `mysql-data/` ni respaldos privados.
