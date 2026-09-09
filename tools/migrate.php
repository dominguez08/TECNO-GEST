<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/database.php';
$tables = ['roles','usuarios','ubicaciones','tipos_equipo','equipos','estados_reporte','reportes','mantenimientos'];
$relations = [
 ['usuarios','rol_id','roles'], ['equipos','tipo_id','tipos_equipo'], ['equipos','ubicacion_id','ubicaciones'],
 ['reportes','equipo_id','equipos'], ['reportes','usuario_id','usuarios'], ['reportes','estado_id','estados_reporte'],
 ['mantenimientos','reporte_id','reportes'], ['mantenimientos','tecnico_id','usuarios']
];
foreach ($relations as [$table,$column,$parent]) {
 if ($pdo->query("SELECT COUNT(*) FROM $table c LEFT JOIN $parent p ON p.id=c.$column WHERE p.id IS NULL")->fetchColumn()) throw new RuntimeException("Orphan records in $table.$column; migration stopped.");
}
foreach (['mantenimientos'=>'reporte_id','ubicaciones'=>'nombre'] as $table=>$column) {
 if ($pdo->query("SELECT $column FROM $table GROUP BY $column HAVING COUNT(*)>1 LIMIT 1")->fetch()) throw new RuntimeException("Duplicates in $table; migration stopped.");
}
$backup = "SET FOREIGN_KEY_CHECKS=0;\n";
foreach ($tables as $table) {
 $backup .= $pdo->query("SHOW CREATE TABLE $table")->fetch(PDO::FETCH_NUM)[1] . ";\n";
 foreach ($pdo->query("SELECT * FROM $table") as $row) $backup .= "INSERT INTO $table VALUES (" . implode(',', array_map(fn($v)=>$v===null?'NULL':$pdo->quote($v), $row)) . ");\n";
}
$backup .= "SET FOREIGN_KEY_CHECKS=1;\n";
$path = __DIR__ . '/../storage/backup-' . date('Ymd-His') . '.sql';
if (file_put_contents($path, $backup) === false) throw new RuntimeException('Backup failed.');
foreach ($tables as $table) $pdo->exec("ALTER TABLE $table ENGINE=InnoDB");
foreach ($relations as [$table,$column,$parent]) {
 $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.KEY_COLUMN_USAGE WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND COLUMN_NAME=? AND REFERENCED_TABLE_NAME=?');
 $q->execute([$table,$column,$parent]);
 if (!$q->fetchColumn()) $pdo->exec("ALTER TABLE $table ADD CONSTRAINT fk_{$table}_{$column} FOREIGN KEY ($column) REFERENCES $parent(id) ON DELETE RESTRICT ON UPDATE RESTRICT");
}
foreach ([['mantenimientos','uq_mantenimiento_reporte','reporte_id',true],['ubicaciones','uq_ubicacion_nombre','nombre',true],['reportes','idx_reportes_fecha','fecha_reporte',false],['reportes','idx_reportes_equipo_estado','equipo_id,estado_id',false],['equipos','idx_equipos_estado_codigo','estado,codigo',false]] as [$table,$name,$columns,$unique]) {
 $q = $pdo->prepare('SELECT COUNT(*) FROM information_schema.STATISTICS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME=? AND INDEX_NAME=?');
 $q->execute([$table,$name]);
 if (!$q->fetchColumn()) $pdo->exec("CREATE " . ($unique?'UNIQUE ':'') . "INDEX $name ON $table ($columns)");
}
echo "Migration complete; backup stored locally.\n";
