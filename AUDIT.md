# Revisión de InventIC — 8 de septiembre de 2026

## Resultado

Se adaptó la aplicación PHP/PDO a las diez interfaces de la nueva referencia, manteniendo la navegación y las funciones previas. La base local se amplió de ocho a doce tablas sin borrar sus registros: sedes, préstamos, configuración y actividad. Se realizó respaldo privado antes de la migración. Los números y gráficos usan información real; no se agregaron equipos ni usuarios ficticios a la instalación local.

## Correcciones relevantes

La revisión anterior corrigió MyISAM sin transacciones/relaciones efectivas, falta de CSRF, validaciones insuficientes y errores de mantenimiento. Esta revisión incorpora reglas para préstamos activos, evita reabrir mantenimiento de un equipo prestado y permite registrar la falla de un equipo marcado manualmente en mantenimiento.

Se detectó y corrigió la restauración de respaldos con columnas generadas: el INSERT excluye únicamente las columnas STORED/VIRTUAL GENERATED, conservando las fechas con DEFAULT_GENERATED. Los respaldos se probaron restaurándolos en otra base temporal.

Los formularios ampliados validan precio, fechas, referencias, tamaño de textos y contenido de fotografías. Los archivos se almacenan con nombres aleatorios en almacenamiento privado. La exportación CSV escapa fórmulas para evitar su ejecución al abrirla en Excel. Se unificaron el huso horario de PHP y de la conexión MySQL para calcular los vencimientos.

Se corrigió el acceso a perfil/cierre de sesión desde el menú móvil, la visualización de valores cero en gráficos y el renderizado de la navegación compartida dentro de las nuevas plantillas.

## Interfaz

Sidebar azul con identidad InventIC, usuario y cierre de sesión en el pie. Tarjetas pastel, tablas con filas redondeadas, formularios agrupados, iconografía y espaciados consistentes. Panel con gráficos y actividad; inventario con responsable; préstamos con vencimientos y devoluciones; mantenimiento con indicadores; sedes con tarjetas; reportes con gráficos y exportaciones; configuración con ocho accesos; registro ampliado; ficha con cuatro pestañas; perfil editable.

En teléfonos, navegación desplegable, formularios en una columna y filas de tabla convertidas en tarjetas. La apariencia compacta se guarda por usuario. Las tarjetas de configuración mantienen la distribución de la referencia en escritorio.

## Archivos principales

- assets/app.css; includes/header.php, navbar.php y app.php: componentes visuales y navegación.
- includes/schema.php y tools/migrate-interface.php: migración y respaldo. database.sql: instalación nueva sin datos privados.
- includes/loans.php y modules/prestamos/: préstamos y devoluciones.
- includes/equipment-form.php y modules/equipos/: formulario reutilizable, ficha y fotografía protegida.
- includes/location-form.php y modules/ubicaciones/: sedes y espacios.
- includes/maintenance.php y modules/mantenimiento/: consistencia de mantenimiento.
- modules/dashboard/, estadisticas/, configuracion/, perfil/ y reportes/create.php: vistas y flujos ampliados.
- auth/login.php, config/config.php y database.php: último acceso, preferencias y zona horaria.
- tests/integration.php: regresión y pruebas nuevas; README.md: instalación y operación.

## Validación

109 comprobaciones de integración en datos temporales: esquema e idempotencia, transacciones, referencias, los tres roles, formularios, duplicados, préstamos/devoluciones, mantenimiento, permisos, perfil, contraseñas, configuración, fotografía, CSV, restauración, CSRF, XSS y SQL Injection. Sintaxis PHP revisada. Se verificaron visualmente panel, registro, configuración, reportes y perfil en escritorio; las diez vistas se recorrieron a 390 px sin desbordamiento horizontal. No se observaron errores de consola en ese recorrido.

## Límites operativos

La contraseña original de demostración de la cuenta local se conserva; puede cambiarse desde Mi perfil. El instalador público no crea esa cuenta ni distribuye su contraseña. La conexión privada local sigue siendo de desarrollo: producción necesita HTTPS y permisos mínimos de base de datos.

PDF usa la impresión del navegador para guardar como PDF. Excel se entrega como CSV, no como XLSX. Los gráficos de inventario son actuales; el filtro temporal aplica al historial de fallas. Roles/permisos son de consulta y se asignan por usuario; no hay editor de políticas arbitrarias. Las alertas son internas al iniciar sesión, no correos electrónicos.

Las librerías visuales siguen en CDN. No se actualizó WAMP ni se realizó una auditoría externa de infraestructura o una prueba de carga masiva. Los respaldos SQL no contienen los archivos binarios de las fotografías: copie storage por separado para recuperación completa.
