# Auditoría y modernización — 7 de septiembre de 2026

## Estado inicial

24 archivos PHP y un esquema SQL, sin repositorio Git local, sin gestor de dependencias, sin pruebas automatizadas. El repositorio remoto indicado estaba vacío. La aplicación usa páginas PHP renderizadas en servidor, PDO y consultas mayormente preparadas, con roles Administrador, Técnico y Docente. La conexión local funcionaba. Las ocho tablas existían, pero usaban MyISAM: las claves foráneas declaradas no estaban activas y los bloques de transacción no protegían las escrituras.

## Correcciones

- Migración local de las ocho tablas a InnoDB, ocho claves foráneas verificadas y respaldo SQL privado previo. Mismos conteos antes y después: un usuario, un equipo, una ubicación, cero reportes y cero mantenimientos; catálogos preservados.
- Índices para estado/código, fecha de reportes y equipo/estado; unicidad de mantenimiento por reporte y de nombres de ubicaciones. No se eliminaron tablas, columnas ni registros existentes.
- Servicio compartido de reportes/mantenimiento con bloqueo de equipo, transacciones, rechazo de duplicados, fechas coherentes y comprobación de otros reportes abiertos antes de activar equipos.
- Eliminación de equipos, ubicaciones y usuarios protegida por rol, método POST, CSRF y claves foráneas; se preservan referencias e historial. Bloqueo de autoeliminación y de cambio del propio rol administrativo.
- Validación de identificadores, catálogos, tamaños, estados, correos y contraseñas en servidor. Escape centralizado de HTML, incluidos campos nulos y etiquetas de catálogo.
- Sesiones con regeneración, HttpOnly, SameSite, Secure bajo HTTPS, caducidad por inactividad y revalidación de roles. Cierre de sesión por POST. Invalidación tras cambiar contraseña para nuevas autenticaciones.
- Protección CSRF en todos los formularios POST, límite de intentos de autenticación por IP y respuestas que no exponen excepciones SQL.
- Configuración privada separada del código, exclusiones Git y bloqueos web para archivos internos. Semilla de administrador con contraseña conocida retirada del instalador.
- Indicadores de inventario reducidos de cuatro consultas a una. Búsqueda y filtros en servidor con consultas preparadas y paginación; corrección de estadísticas que agrupaban personas distintas con el mismo nombre.
- CSS extraído a un recurso compartido, sidebar azul, tarjetas pastel, filtros, actividad real reciente, formularios y botones consistentes. Adaptación a escritorio, tablet y teléfono con tablas en formato tarjeta. Menú móvil accesible y enlace para saltar al contenido.

## Archivos

Se revisaron y modificaron los módulos de dashboard, equipos, ubicaciones, usuarios, reportes, mantenimiento e informes; auth/login.php y logout.php; config/config.php y database.php; includes/header.php, navbar.php y footer.php; database.sql. Se agregaron assets/app.css y app.js, helpers compartidos en includes/, endpoints delete.php, herramientas de migración/administrador/router, pruebas de integración, documentación, .gitignore y restricciones .htaccess. config/local.php y el respaldo permanecen exclusivamente locales.

## Verificación realizada

- Todos los PHP pasan validación sintáctica con PHP 8.2.
- 61 comprobaciones automatizadas en una base MySQL temporal: creación del esquema, transacciones reales, integridad referencial, mantenimiento, rutas, los tres roles, formularios de equipos/usuarios/ubicaciones/reportes, CSRF, XSS, entrada SQL en búsqueda, logout, borrado protegido y limitación de intentos.
- Revisión visual en navegador a tamaño de escritorio, 820 px y 390 px. Menú móvil comprobado; tarjetas sin desbordamiento horizontal de la página. Consola sin errores observados durante esta revisión.
- Apache devuelve 403/404 al solicitar .git/config, config/local.php, database.sql, storage/, tools/migrate.php y tests/integration.php.
- Conteos de datos locales y ocho relaciones verificados después de las pruebas. Las pruebas usan datos sintéticos y limpian su propia base.

## Límites y pendientes operativos

La cuenta administradora local conserva la contraseña de demostración previa: debe reemplazarse desde Usuarios antes de producción. No se modificó la credencial del usuario sin proporcionar una nueva. La conexión local mantiene la configuración de desarrollo fuera de Git; producción necesita usuario MySQL limitado, HTTPS y configuración propia.

No se implementó un módulo de préstamos porque no existía: las etiquetas erróneas que equiparaban Inactivo con préstamo se corrigieron. No se inventaron movimientos ni actividad.

La carga de CDN sigue siendo externa. No se actualizó el stack WAMP del equipo ni se hizo una prueba de carga a gran escala; los listados administrativos y de reportes todavía no tienen paginación. No se realizó una auditoría de infraestructura ni una prueba de penetración externa. Las verificaciones descritas no garantizan ausencia absoluta de fallos.

El repositorio se inicializa con una base documental mínima en main para permitir revisar toda la aplicación mediante un Pull Request desde improvement/security-ui. Los hashes y enlace del PR se entregan con el resumen final.
