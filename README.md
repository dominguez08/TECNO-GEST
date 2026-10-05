# InventIC

InventIC es una aplicación web para administrar inventarios, préstamos, reportes de fallas y mantenimientos. Usa Node.js para el servidor y MySQL para almacenar la información.

## Uso local en Windows

Requisitos: Node.js 22 o superior y MySQL 8. También puedes usar el MySQL incluido en WAMP.

1. Descarga el proyecto y extrae la carpeta completa.
2. Ejecuta `Iniciar InventIC.cmd` o abre una terminal en la carpeta y ejecuta `npm start`.
3. Abre la dirección que muestre la terminal, normalmente `http://localhost:3000`.
4. En una instalación nueva, crea la primera cuenta administradora.
5. Entra a Configuración para definir el nombre de la institución, moneda, sedes, tipos de equipo y usuarios.

La primera instalación crea una base MySQL vacía y genera las credenciales en `.env`. Las siguientes ejecuciones conservan los datos existentes. No borres `.env`, `.runtime/` ni `mysql-data/` si necesitas conservar la información.

No abras `index.html` directamente. La aplicación necesita el servidor Node.js y la conexión MySQL.

## Uso con Docker

1. Instala y abre Docker Desktop con contenedores Linux.
2. Ejecuta `Iniciar con Docker.cmd`.
3. Abre `http://localhost:3000` y crea la primera cuenta.

Para detenerlo, ejecuta `docker compose --env-file .docker.env down`. El volumen de MySQL conserva los datos.

## Despliegue en Railway

1. Crea un servicio MySQL en el mismo proyecto de Railway.
2. En el servicio de la aplicación configura estas variables:

```dotenv
DB_HOST=${{MySQL.MYSQLHOST}}
DB_PORT=${{MySQL.MYSQLPORT}}
DB_USER=${{MySQL.MYSQLUSER}}
DB_PASS=${{MySQL.MYSQLPASSWORD}}
DB_NAME=${{MySQL.MYSQLDATABASE}}
HOST=0.0.0.0
```

3. En Networking genera un dominio público para el puerto que Railway indique a la aplicación.
4. Abre el dominio y crea la primera cuenta.

`RAILWAY_PUBLIC_DOMAIN` se acepta automáticamente como origen de los formularios. Para un dominio propio, añade también `APP_ORIGIN=https://tu-dominio.com`.

## Funciones

- Inicio de sesión y creación de la primera cuenta administradora.
- Roles Administrador, Técnico y Docente.
- Inventario de equipos, ubicaciones y sedes.
- Préstamos y devoluciones.
- Reportes de fallas y mantenimientos.
- Configuración de la institución, usuarios y apariencia.
- Exportación y restauración de respaldos JSON sin contraseñas.

## Almacenamiento

Los datos de inventario, usuarios, configuración, préstamos, reportes y mantenimientos se guardan mediante la API en MySQL. El navegador no usa `localStorage` para guardar datos de trabajo. Las contraseñas se almacenan con scrypt y las sesiones usan una cookie HttpOnly.

Cada instalación nueva comienza con una base vacía y su propia cuenta administradora. No se cargan equipos, sedes ni registros de otra instalación.

## Estructura principal

| Ruta | Función |
| --- | --- |
| `assets/app.js` | Navegación, pantallas y formularios |
| `assets/api.js` | Comunicación con el servidor |
| `assets/store.js` | Lectura y escritura mediante la API |
| `assets/validation.js` | Validaciones del cliente y del servidor |
| `server/index.cjs` | Servidor HTTP y rutas de la API |
| `server/database.cjs` | Consultas y transacciones MySQL |
| `server/permissions.cjs` | Permisos por rol |
| `database.sql` | Esquema de la base de datos |
| `tools/start.cjs` | Inicio local |
| `compose.yaml` | Servicios Docker |

## Pruebas y formato

```bash
npm test
npm run format
```

No publiques `.env`, `.runtime/`, `mysql-data/` ni respaldos privados.
