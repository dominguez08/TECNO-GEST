# InventIC · TECNO-GEST

Sistema institucional de inventario, préstamos, reportes de fallas y mantenimiento. Interfaz basada en las diez vistas de la referencia suministrada: panel, inventario, préstamos, mantenimiento, ubicaciones, reportes, configuración, registro de equipo, detalle y perfil.

## Requisitos

PHP 8.2+ con PDO MySQL, mbstring, fileinfo y sesiones; MySQL 8 con InnoDB; Apache 2.4 con AllowOverride habilitado. Las pruebas necesitan curl, GD y permisos para crear/eliminar bases temporales. No necesita Node ni Composer. Bootstrap 5.3.2, Bootstrap Icons 1.11.1 e Inter se cargan por CDN.

## Instalar desde cero

1. Importe `database.sql` en una base nueva. Contiene doce tablas, catálogos iniciales y configuración; no incluye cuentas, contraseñas ni equipos de demostración.
2. Configure DB_HOST, DB_PORT, DB_NAME, DB_USER y DB_PASS mediante variables del servidor o un array en `config/local.php` (excluido de Git). No coloque credenciales en archivos versionados. El usuario de producción debe tener permisos mínimos; las migraciones requieren privilegios adicionales.
3. Configure ADMIN_EMAIL y ADMIN_PASSWORD en el entorno de consola y ejecute `php tools/create-admin.php`. La contraseña debe tener entre 12 y 72 bytes. Retire estas variables al terminar.
4. Abra `auth/login.php` desde Apache. La ruta base se detecta automáticamente; APP_BASE_URL permite especificarla.
5. Permita escritura del servidor en `storage/` y en el directorio de sesiones PHP. Mantenga las restricciones `.htaccess`. Use HTTPS en producción.

El huso horario predeterminado es America/El_Salvador y la sesión MySQL usa -06:00. APP_TIMEZONE y DB_TIMEZONE permiten ajustar ambos si la instalación está en otro país.

Para desarrollo: `php -S 127.0.0.1:8000 tools/router.php`. No use el servidor integrado en producción. El router impide servir directorios privados. En Apache se usan `.htaccess`; en otro servidor reproduzca explícitamente sus restricciones.

## Actualizar una instalación existente

No reimporte `database.sql` sobre datos existentes.

- Desde la versión original con MyISAM: ejecute primero `php tools/migrate.php` para convertir a InnoDB y activar las relaciones.
- Ejecute `php tools/migrate-interface.php` para incorporar sedes, préstamos, configuración, actividad y campos ampliados. Crea un respaldo SQL privado antes de modificar el esquema. La migración es idempotente y no borra información existente.
- Realice migraciones durante una ventana sin escrituras. MySQL no revierte DDL mediante rollback. Conserve el respaldo fuera del servidor web y verifique cualquier restauración en una base nueva antes de cambiar la conexión.

La configuración permite descargar un respaldo SQL solamente a administradores autenticados mediante POST y CSRF. Los respaldos incluyen datos privados; nunca deben publicarse. Para una recuperación completa, copie también los archivos de fotografías de `storage/`: el SQL almacena las referencias, no las imágenes.

## Funcionalidades

- **Panel:** indicadores actuales, gráfico de estado, categorías, actividad reciente y próximos vencimientos. Filtro de sede con datos reales.
- **Inventario:** búsqueda en servidor por código/nombre/modelo/marca/ubicación, filtros de categoría/sede/estado, responsable y paginación de veinte registros.
- **Equipos:** registro y edición con responsable, ubicación, adquisición, precio, proveedor y observaciones. Fotografías JPG/PNG/WebP hasta 3 MB, almacenadas privadamente y servidas solo a roles autorizados. Detalle con información, préstamos, mantenimientos e historial.
- **Préstamos:** registro, fechas, prestatario, vencimientos, devoluciones y filtros. Una restricción de base de datos impide dos préstamos activos sobre el mismo equipo.
- **Mantenimiento:** fallas pendientes, en reparación y completadas; diagnóstico y solución. El cierre exige solución y es inmutable. Los equipos marcados manualmente en mantenimiento también pueden recibir su reporte.
- **Ubicaciones:** sedes y espacios con conteos de equipos, disponibles y en mantenimiento. Edición y borrado protegidos por referencias.
- **Reportes:** gráficos e indicadores actuales; historial de fallas filtrado por periodo. Exportación CSV compatible con Excel y vista de impresión para guardar como PDF. No se genera un archivo XLSX: la descarga se identifica como CSV.
- **Configuración:** nombre e institución, usuarios, consulta de permisos, categorías, sedes, alertas de préstamos atrasados al iniciar sesión, respaldo SQL y densidad visual.
- **Perfil:** nombre, correo, teléfono, cargo, sede, último acceso y cambio de contraseña con comprobación de la contraseña actual.

Los préstamos no modifican el estado físico del equipo: su disponibilidad se calcula a partir del préstamo activo. No se puede prestar un equipo con fallas pendientes ni abrir/reabrir mantenimiento mientras siga prestado. La devolución conserva el historial. Las operaciones concurrentes usan bloqueo del equipo y transacciones.

## Permisos y seguridad

Administrador: todas las áreas y eliminaciones protegidas. Técnico: inventario, préstamos, ubicaciones, reportes y mantenimiento; sin usuarios, configuración ni eliminaciones. Docente: sus reportes de fallas y su perfil. No se pueden modificar los permisos desde el cliente; la pantalla de roles documenta las reglas aplicadas en servidor.

Sesiones regeneradas al autenticar, HttpOnly, SameSite y Secure bajo HTTPS; caducidad por inactividad, revalidación de roles y de contraseña. CSRF en todas las escrituras. Contraseñas con password_hash/password_verify; consultas preparadas y escape de HTML. Los CSV neutralizan fórmulas. Los nombres de archivos de fotografías son aleatorios y se verifica su contenido.

El acceso se limita por IP a diez intentos en quince minutos. En despliegues con varios servidores, use almacenamiento compartido para el limitador. `.gitignore` excluye configuración privada, respaldos, fotografías, sesiones y registros.

## Pruebas

Ejecute `php tests/integration.php`. La suite utiliza una base con nombre aleatorio, datos sintéticos y un servidor temporal en 127.0.0.1:8097. Rechaza el puerto si ya está ocupado. Comprueba 109 condiciones y elimina su base y sus archivos temporales al terminar.

Verifica migraciones, integridad, roles, CRUD, préstamos, mantenimiento, carga y acceso a fotografías, perfil, configuración, CSV, restauración de respaldos, SQL Injection, XSS, CSRF y límites de autenticación. No modifica registros de la base de aplicación. La comprobación visual cubre las diez vistas en escritorio y teléfono.

Consulte `AUDIT.md` para el alcance y las limitaciones de esta revisión.
