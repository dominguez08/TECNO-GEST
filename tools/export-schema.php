<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../config/database.php';
// Export structure only. No application records or local settings enter the installer.
$tables=['sedes','roles','usuarios','ubicaciones','tipos_equipo','equipos','estados_reporte','reportes','mantenimientos','prestamos','configuracion','actividad'];
$sql="-- New installation only. For existing databases use tools/migrate-interface.php.\nCREATE DATABASE IF NOT EXISTS tecnogest CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;\nUSE tecnogest;\n\n";
foreach($tables as $table){$definition=$pdo->query("SHOW CREATE TABLE `$table`")->fetch(PDO::FETCH_NUM)[1];$definition=preg_replace('/ AUTO_INCREMENT=\d+/','',$definition);$sql.=$definition.";\n\n";}
$sql.="INSERT INTO roles(nombre) VALUES ('Administrador'),('Técnico'),('Docente');\n";
$sql.="INSERT INTO estados_reporte(nombre) VALUES ('Pendiente'),('En revisión'),('En reparación'),('Reparado'),('Cerrado');\n";
$sql.="INSERT INTO tipos_equipo(nombre) VALUES ('Computadora de Escritorio'),('Laptop'),('Impresora'),('Proyector'),('Router'),('Switch');\n";
$sql.="INSERT INTO sedes(nombre) VALUES ('Sede San Rafael');\nINSERT INTO ubicaciones(nombre,descripcion,sede_id,tipo) VALUES ('Laboratorio 1','Laboratorio principal de informática',1,'Laboratorio');\n";
$sql.="INSERT INTO configuracion(clave,valor) VALUES ('nombre','InventIC'),('institucion','IEP San Rafael'),('moneda','USD');\n-- Create an administrator with tools/create-admin.php. No default password is distributed.\n";
file_put_contents(__DIR__.'/../database.sql',$sql);
echo "Public installer regenerated from structure and fixed seed catalogs only.\n";
