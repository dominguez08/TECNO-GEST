-- New installation only. For existing databases use tools/migrate-interface.php.
CREATE DATABASE IF NOT EXISTS tecnogest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tecnogest;

CREATE TABLE `sedes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `direccion` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  PRIMARY KEY (`id`),
  UNIQUE KEY `nombre` (`nombre`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `roles` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `usuarios` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `email` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `rol_id` int NOT NULL,
  `telefono` varchar(30) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `cargo` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `sede_id` int DEFAULT NULL,
  `ultimo_acceso` datetime DEFAULT NULL,
  `notificaciones` tinyint NOT NULL DEFAULT '1',
  `apariencia` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'claro',
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `fk_usuarios_rol_id` (`rol_id`),
  KEY `fk_usuarios_sede_id` (`sede_id`),
  CONSTRAINT `fk_usuarios_rol_id` FOREIGN KEY (`rol_id`) REFERENCES `roles` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_usuarios_sede_id` FOREIGN KEY (`sede_id`) REFERENCES `sedes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `ubicaciones` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci,
  `sede_id` int DEFAULT NULL,
  `tipo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT 'Aula',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_ubicacion_nombre` (`nombre`),
  KEY `fk_ubicaciones_sede_id` (`sede_id`),
  CONSTRAINT `fk_ubicaciones_sede_id` FOREIGN KEY (`sede_id`) REFERENCES `sedes` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `tipos_equipo` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `equipos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `codigo` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `tipo_id` int NOT NULL,
  `marca` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `modelo` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `numero_serie` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `ubicacion_id` int NOT NULL,
  `estado` enum('Activo','Inactivo','En Mantenimiento') COLLATE utf8mb4_unicode_ci DEFAULT 'Activo',
  `nombre` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `responsable_id` int DEFAULT NULL,
  `fecha_adquisicion` date DEFAULT NULL,
  `precio` decimal(12,2) DEFAULT NULL,
  `proveedor` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `fotografia` varchar(80) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `codigo` (`codigo`),
  KEY `fk_equipos_tipo_id` (`tipo_id`),
  KEY `fk_equipos_ubicacion_id` (`ubicacion_id`),
  KEY `idx_equipos_estado_codigo` (`estado`,`codigo`),
  KEY `fk_equipos_responsable_id` (`responsable_id`),
  CONSTRAINT `fk_equipos_responsable_id` FOREIGN KEY (`responsable_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `fk_equipos_tipo_id` FOREIGN KEY (`tipo_id`) REFERENCES `tipos_equipo` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_equipos_ubicacion_id` FOREIGN KEY (`ubicacion_id`) REFERENCES `ubicaciones` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `estados_reporte` (
  `id` int NOT NULL AUTO_INCREMENT,
  `nombre` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `reportes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `equipo_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `descripcion` text COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha_reporte` datetime DEFAULT CURRENT_TIMESTAMP,
  `estado_id` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `fk_reportes_usuario_id` (`usuario_id`),
  KEY `fk_reportes_estado_id` (`estado_id`),
  KEY `idx_reportes_fecha` (`fecha_reporte`),
  KEY `idx_reportes_equipo_estado` (`equipo_id`,`estado_id`),
  CONSTRAINT `fk_reportes_equipo_id` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_reportes_estado_id` FOREIGN KEY (`estado_id`) REFERENCES `estados_reporte` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_reportes_usuario_id` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `mantenimientos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `reporte_id` int NOT NULL,
  `tecnico_id` int NOT NULL,
  `diagnostico` text COLLATE utf8mb4_unicode_ci,
  `solucion` text COLLATE utf8mb4_unicode_ci,
  `fecha_inicio` datetime DEFAULT CURRENT_TIMESTAMP,
  `fecha_fin` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_mantenimiento_reporte` (`reporte_id`),
  KEY `fk_mantenimientos_tecnico_id` (`tecnico_id`),
  CONSTRAINT `fk_mantenimientos_reporte_id` FOREIGN KEY (`reporte_id`) REFERENCES `reportes` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT,
  CONSTRAINT `fk_mantenimientos_tecnico_id` FOREIGN KEY (`tecnico_id`) REFERENCES `usuarios` (`id`) ON DELETE RESTRICT ON UPDATE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `prestamos` (
  `id` int NOT NULL AUTO_INCREMENT,
  `equipo_id` int NOT NULL,
  `usuario_id` int NOT NULL,
  `registrado_por` int NOT NULL,
  `fecha_prestamo` date NOT NULL,
  `fecha_devolucion` date NOT NULL,
  `devuelto_en` datetime DEFAULT NULL,
  `observaciones` text COLLATE utf8mb4_unicode_ci,
  `activo_equipo` int GENERATED ALWAYS AS (if((`devuelto_en` is null),`equipo_id`,NULL)) STORED,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_prestamo_activo` (`activo_equipo`),
  KEY `idx_prestamos_fecha` (`fecha_devolucion`,`devuelto_en`),
  KEY `equipo_id` (`equipo_id`),
  KEY `usuario_id` (`usuario_id`),
  KEY `registrado_por` (`registrado_por`),
  CONSTRAINT `prestamos_ibfk_1` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`),
  CONSTRAINT `prestamos_ibfk_2` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `prestamos_ibfk_3` FOREIGN KEY (`registrado_por`) REFERENCES `usuarios` (`id`),
  CONSTRAINT `prestamos_chk_1` CHECK ((`fecha_devolucion` >= `fecha_prestamo`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `configuracion` (
  `clave` varchar(50) COLLATE utf8mb4_unicode_ci NOT NULL,
  `valor` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`clave`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `actividad` (
  `id` int NOT NULL AUTO_INCREMENT,
  `usuario_id` int DEFAULT NULL,
  `equipo_id` int DEFAULT NULL,
  `descripcion` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `fecha` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_actividad_fecha` (`fecha`),
  KEY `usuario_id` (`usuario_id`),
  KEY `equipo_id` (`equipo_id`),
  CONSTRAINT `actividad_ibfk_1` FOREIGN KEY (`usuario_id`) REFERENCES `usuarios` (`id`) ON DELETE SET NULL,
  CONSTRAINT `actividad_ibfk_2` FOREIGN KEY (`equipo_id`) REFERENCES `equipos` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO roles(nombre) VALUES ('Administrador'),('Técnico'),('Docente');
INSERT INTO estados_reporte(nombre) VALUES ('Pendiente'),('En revisión'),('En reparación'),('Reparado'),('Cerrado');
INSERT INTO tipos_equipo(nombre) VALUES ('Computadora de Escritorio'),('Laptop'),('Impresora'),('Proyector'),('Router'),('Switch');
INSERT INTO sedes(nombre) VALUES ('Sede San Rafael');
INSERT INTO ubicaciones(nombre,descripcion,sede_id,tipo) VALUES ('Laboratorio 1','Laboratorio principal de informática',1,'Laboratorio');
INSERT INTO configuracion(clave,valor) VALUES ('nombre','InventIC'),('institucion','IEP San Rafael'),('moneda','USD');
-- Create an administrator with tools/create-admin.php. No default password is distributed.
