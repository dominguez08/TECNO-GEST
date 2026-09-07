# TECNO-GEST

Inventario institucional de equipos, ubicaciones, usuarios, reportes de fallas y mantenimiento. PHP con PDO/MySQL, Bootstrap 5.3.2, Bootstrap Icons 1.11.1 y JavaScript sin framework. No requiere Composer ni Node para ejecutarse.

## Requisitos

PHP 8.2 o superior con `pdo_mysql`, `mbstring` y sesiones; MySQL 8 con InnoDB; Apache 2.4 con AllowOverride habilitado. Las pruebas requieren además `curl` y permisos para crear una base temporal. Bootstrap, iconos e Inter se cargan desde CDN; necesitan conexión a Internet.

## Instalación nueva

1. Importe `database.sql` únicamente en una base nueva. No reimporte sobre una base existente.
2. Configure `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER` y `DB_PASS` mediante variables de entorno del servidor. Alternativamente, cree `config/local.php`, que devuelve un array con estas claves y está excluido de Git. Use un usuario de aplicación con permisos mínimos; reserve ALTER/CREATE para la migración.
3. Configure `ADMIN_EMAIL` y `ADMIN_PASSWORD` en su entorno de consola y ejecute `php tools/create-admin.php`. La contraseña debe tener entre 12 y 72 bytes. El instalador no incluye cuentas ni contraseñas de demostración. Retire esas variables al terminar.
4. Abra `auth/login.php` desde Apache. La ruta base se detecta automáticamente; `APP_BASE_URL` permite especificarla.
5. El servidor debe poder escribir en `storage/` y en el directorio de sesiones PHP. Use HTTPS en producción para activar cookies Secure.

Para desarrollo local puede usar `php -S 127.0.0.1:8000 tools/router.php`. El router bloquea directorios internos; el servidor integrado de PHP no es para producción. En Apache, mantenga todos los archivos `.htaccess`. En otro servidor, reproduzca expresamente sus restricciones.

## Actualizar una base existente

Ejecute `php tools/migrate.php` durante una ventana sin escrituras. Comprueba huérfanos y duplicados antes de hacer cambios, escribe un respaldo en `storage/`, convierte las ocho tablas a InnoDB y agrega relaciones e índices faltantes. No elimina ni combina datos. Se detiene si detecta datos incompatibles. El DDL de MySQL no es reversible mediante rollback: conserve el respaldo fuera del servidor web antes de intervenir una instalación de producción. Para restaurar, importe el respaldo en una base vacía y verifique sus datos antes de cambiar la conexión.

## Funcionalidades y reglas

- Administradores: inventario, ubicaciones, usuarios, reportes e informes; eliminación mediante POST y CSRF, bloqueada por referencias existentes. No pueden eliminar su propia cuenta ni quitarse el rol.
- Técnicos: equipos, ubicaciones, reportes y mantenimiento; no administran usuarios ni eliminan registros.
- Docentes: crean reportes y solo pueden leer los suyos.
- Un reporte nuevo pone el equipo en mantenimiento. No se permiten reportes abiertos duplicados por equipo. La finalización exige solución; el equipo queda activo solo cuando no quedan reportes abiertos. Reabrir un reporte reparado limpia la fecha final; un reporte cerrado es inmutable.
- El inventario ofrece búsqueda en servidor, categorías, ubicaciones, estados y paginación de 20 registros. En teléfonos, las tablas se presentan como tarjetas.
- No existe un módulo de préstamos: `Inactivo` conserva su significado original y no se presenta como préstamo.

## Verificación

Ejecute `php tests/integration.php`. Crea una base con nombre aleatorio, inicia un servidor temporal en `127.0.0.1:8097`, usa datos sintéticos, verifica los flujos y elimina solo su base temporal al finalizar. No modifica los registros de la base de aplicación. El puerto debe estar libre. La suite verifica 61 condiciones, incluyendo los tres roles, CRUD, CSRF, XSS, búsqueda con entrada SQL, cierre de sesión, limitación de acceso e integridad referencial.

## Seguridad y operación

No publique `config/local.php`, `.env`, `storage/`, respaldos ni datos personales. `.gitignore` los excluye. Las contraseñas usan `password_hash`/`password_verify`; las sesiones se regeneran al autenticar, caducan por inactividad y revalidan el rol en cada petición. Los cambios de contraseña invalidan las sesiones que se autenticaron con el hash anterior. Hay un límite local de diez intentos de acceso por IP en quince minutos; se comparte entre sesiones y puede afectar a usuarios detrás de la misma red. En despliegues con varios servidores, sustituya el almacén de archivos por uno compartido.

Consulte `AUDIT.md` para resultados y límites de la revisión.
