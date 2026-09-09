<?php
function backup_database(PDO $pdo): string {
    $sql = "SET FOREIGN_KEY_CHECKS=0;\n";
    foreach ($pdo->query('SHOW TABLES')->fetchAll(PDO::FETCH_COLUMN) as $table) {
        $safe = '`' . str_replace('`', '``', $table) . '`';
        $sql .= $pdo->query("SHOW CREATE TABLE $safe")->fetch(PDO::FETCH_NUM)[1] . ";\n";
        $columns=[];
        foreach($pdo->query("SHOW COLUMNS FROM $safe") as $column) if(!preg_match('/(?:VIRTUAL|STORED) GENERATED/',$column['Extra'])) $columns[]='`'.str_replace('`','``',$column['Field']).'`';
        $columnList=implode(',',$columns);
        foreach ($pdo->query("SELECT $columnList FROM $safe") as $row) {
            $sql .= "INSERT INTO $safe ($columnList) VALUES (" . implode(',', array_map(fn($v) => $v === null ? 'NULL' : $pdo->quote($v), $row)) . ");\n";
        }
    }
    return $sql . "SET FOREIGN_KEY_CHECKS=1;\n";
}
function migrate_interface(PDO $pdo): void {
    $pdo->exec("CREATE TABLE IF NOT EXISTS sedes (id INT AUTO_INCREMENT PRIMARY KEY, nombre VARCHAR(100) NOT NULL UNIQUE, direccion VARCHAR(255) NOT NULL DEFAULT '') ENGINE=InnoDB");
    $pdo->exec("INSERT INTO sedes(nombre) SELECT 'Sede San Rafael' WHERE NOT EXISTS (SELECT 1 FROM sedes)");
    $columns = [
        'ubicaciones' => ['sede_id'=>'INT NULL', 'tipo'=>"VARCHAR(50) NOT NULL DEFAULT 'Aula'"],
        'usuarios' => ['telefono'=>"VARCHAR(30) NOT NULL DEFAULT ''",'cargo'=>"VARCHAR(100) NOT NULL DEFAULT ''",'sede_id'=>'INT NULL','ultimo_acceso'=>'DATETIME NULL','notificaciones'=>'TINYINT NOT NULL DEFAULT 1','apariencia'=>"VARCHAR(20) NOT NULL DEFAULT 'claro'"],
        'equipos' => ['nombre'=>"VARCHAR(100) NOT NULL DEFAULT ''",'responsable_id'=>'INT NULL','fecha_adquisicion'=>'DATE NULL','precio'=>'DECIMAL(12,2) NULL','proveedor'=>"VARCHAR(100) NOT NULL DEFAULT ''",'observaciones'=>'TEXT NULL','fotografia'=>'VARCHAR(80) NULL']
    ];
    foreach ($columns as $table=>$fields) foreach ($fields as $column=>$type) {
        $q=$pdo->prepare('SELECT COUNT(*) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=?');
        $q->execute([$table,$column]);
        if (!$q->fetchColumn()) $pdo->exec("ALTER TABLE $table ADD COLUMN $column $type");
    }
    $pdo->exec('UPDATE ubicaciones SET sede_id=(SELECT MIN(id) FROM sedes) WHERE sede_id IS NULL');
    foreach ([['ubicaciones','sede_id','sedes'],['usuarios','sede_id','sedes'],['equipos','responsable_id','usuarios']] as [$table,$column,$parent]) {
        $q=$pdo->prepare('SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? AND REFERENCED_TABLE_NAME=?');
        $q->execute([$table,$column,$parent]);
        if (!$q->fetchColumn()) $pdo->exec("ALTER TABLE $table ADD CONSTRAINT fk_{$table}_{$column} FOREIGN KEY ($column) REFERENCES $parent(id)");
    }
    $pdo->exec("CREATE TABLE IF NOT EXISTS prestamos (
        id INT AUTO_INCREMENT PRIMARY KEY, equipo_id INT NOT NULL, usuario_id INT NOT NULL, registrado_por INT NOT NULL,
        fecha_prestamo DATE NOT NULL, fecha_devolucion DATE NOT NULL, devuelto_en DATETIME NULL, observaciones TEXT,
        activo_equipo INT GENERATED ALWAYS AS (IF(devuelto_en IS NULL,equipo_id,NULL)) STORED,
        UNIQUE KEY uq_prestamo_activo(activo_equipo), INDEX idx_prestamos_fecha(fecha_devolucion,devuelto_en),
        FOREIGN KEY(equipo_id) REFERENCES equipos(id), FOREIGN KEY(usuario_id) REFERENCES usuarios(id), FOREIGN KEY(registrado_por) REFERENCES usuarios(id),
        CHECK(fecha_devolucion >= fecha_prestamo)
    ) ENGINE=InnoDB");
    $pdo->exec("CREATE TABLE IF NOT EXISTS configuracion (clave VARCHAR(50) PRIMARY KEY, valor VARCHAR(255) NOT NULL) ENGINE=InnoDB");
    $q=$pdo->prepare('INSERT IGNORE INTO configuracion(clave,valor) VALUES (?,?)');
    foreach (['nombre'=>'InventIC','institucion'=>'IEP San Rafael','moneda'=>'USD'] as $key=>$value) $q->execute([$key,$value]);
    $pdo->exec("CREATE TABLE IF NOT EXISTS actividad (id INT AUTO_INCREMENT PRIMARY KEY, usuario_id INT NULL, equipo_id INT NULL, descripcion VARCHAR(255) NOT NULL, fecha DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP, INDEX idx_actividad_fecha(fecha), FOREIGN KEY(usuario_id) REFERENCES usuarios(id) ON DELETE SET NULL, FOREIGN KEY(equipo_id) REFERENCES equipos(id) ON DELETE SET NULL) ENGINE=InnoDB");
}
