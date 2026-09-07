CREATE DATABASE IF NOT EXISTS tecnogest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE tecnogest;

CREATE TABLE roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE usuarios (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    rol_id INT NOT NULL,
    FOREIGN KEY (rol_id) REFERENCES roles(id)
) ENGINE=InnoDB;

CREATE TABLE ubicaciones (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    descripcion TEXT
) ENGINE=InnoDB;

CREATE TABLE tipos_equipo (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE equipos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    codigo VARCHAR(50) NOT NULL UNIQUE,
    tipo_id INT NOT NULL,
    marca VARCHAR(50),
    modelo VARCHAR(50),
    numero_serie VARCHAR(100),
    ubicacion_id INT NOT NULL,
    estado ENUM('Activo', 'Inactivo', 'En Mantenimiento') DEFAULT 'Activo',
    FOREIGN KEY (tipo_id) REFERENCES tipos_equipo(id),
    FOREIGN KEY (ubicacion_id) REFERENCES ubicaciones(id)
) ENGINE=InnoDB;

CREATE TABLE estados_reporte (
    id INT AUTO_INCREMENT PRIMARY KEY,
    nombre VARCHAR(50) NOT NULL
) ENGINE=InnoDB;

CREATE TABLE reportes (
    id INT AUTO_INCREMENT PRIMARY KEY,
    equipo_id INT NOT NULL,
    usuario_id INT NOT NULL,
    descripcion TEXT NOT NULL,
    fecha_reporte DATETIME DEFAULT CURRENT_TIMESTAMP,
    estado_id INT NOT NULL,
    FOREIGN KEY (equipo_id) REFERENCES equipos(id),
    FOREIGN KEY (usuario_id) REFERENCES usuarios(id),
    FOREIGN KEY (estado_id) REFERENCES estados_reporte(id)
) ENGINE=InnoDB;

CREATE TABLE mantenimientos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    reporte_id INT NOT NULL UNIQUE,
    tecnico_id INT NOT NULL,
    diagnostico TEXT,
    solucion TEXT,
    fecha_inicio DATETIME DEFAULT CURRENT_TIMESTAMP,
    fecha_fin DATETIME,
    FOREIGN KEY (reporte_id) REFERENCES reportes(id),
    FOREIGN KEY (tecnico_id) REFERENCES usuarios(id)
) ENGINE=InnoDB;

-- Datos Iniciales (Semillas)
INSERT INTO roles (nombre) VALUES ('Administrador'), ('Técnico'), ('Docente');

INSERT INTO estados_reporte (nombre) VALUES
('Pendiente'),
('En revisión'),
('En reparación'),
('Reparado'),
('Cerrado');

INSERT INTO tipos_equipo (nombre) VALUES
('Computadora de Escritorio'),
('Laptop'),
('Impresora'),
('Proyector'),
('Router'),
('Switch');

-- Cree el administrador con tools/create-admin.php desde la consola.

-- Ubicación de prueba
INSERT INTO ubicaciones (nombre, descripcion) VALUES ('Laboratorio 1', 'Laboratorio principal de informática');

CREATE UNIQUE INDEX uq_ubicacion_nombre ON ubicaciones(nombre);
CREATE INDEX idx_reportes_fecha ON reportes(fecha_reporte);
CREATE INDEX idx_reportes_equipo_estado ON reportes(equipo_id,estado_id);
CREATE INDEX idx_equipos_estado_codigo ON equipos(estado,codigo);
