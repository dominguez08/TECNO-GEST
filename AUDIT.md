# Comprobación de la aplicación

Se reemplazó la selección libre de perfiles por acceso con correo y contraseña verificado por el servidor. Las contraseñas usan scrypt; las sesiones se guardan en el servidor y se identifican con una cookie HttpOnly.

La base MySQL `inventic_html` utiliza tablas relacionadas, claves foráneas y transacciones. Se conserva la base anterior. Los cambios ya no dependen del almacenamiento del navegador.

Se corrigieron identificadores HTML repetidos en formularios, se separaron las secciones de configuración y se mejoraron tamaños de controles, espaciados, estados y presentación móvil. Se formatearon JavaScript, HTML y CSS para permitir su lectura y mantenimiento.

La suite `tests/mysql-smoke.cjs` utiliza una base temporal, un servidor separado y un navegador aislado. Comprueba inicio de sesión correcto e incorrecto, restricciones de acceso, persistencia real en MySQL, edición de configuración, operaciones de inventario, préstamos, devolución, mantenimiento, usuarios, respaldos y ausencia de desbordamiento horizontal en móvil.

El servicio se limita a localhost. La instalación no constituye un despliegue público configurado para producción. Los respaldos JSON excluyen contraseñas y dependen de `assets/images/` para las fotografías originales del catálogo.
