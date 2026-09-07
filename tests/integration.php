<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/database.php';
require __DIR__ . '/../includes/maintenance.php';
$admin = $pdo;
$name = 'tecnogest_test_' . bin2hex(random_bytes(5));
$admin->exec("CREATE DATABASE `$name` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci");
$server = null;
$checks = 0;
function check($condition, $message) { global $checks; if (!$condition) throw new RuntimeException($message); $checks++; echo "PASS $message\n"; }
function request($path, $data=null, $cookie='admin') {
    global $root;
    $ch=curl_init('http://127.0.0.1:8097'.$path);
    $jar=$root.'/storage/test-'.$cookie.'.cookies';
    curl_setopt_array($ch,[CURLOPT_RETURNTRANSFER=>true,CURLOPT_COOKIEJAR=>$jar,CURLOPT_COOKIEFILE=>$jar,CURLOPT_TIMEOUT=>10]);
    if($data!==null) curl_setopt_array($ch,[CURLOPT_POST=>true,CURLOPT_POSTFIELDS=>http_build_query($data)]);
    $body=curl_exec($ch); $code=curl_getinfo($ch,CURLINFO_HTTP_CODE); curl_close($ch);
    return [$code,$body];
}
function token($body) { preg_match('/name="csrf_token" value="([a-f0-9]+)"/', $body, $m); return $m[1]??''; }
try {
    $admin->exec("USE `$name`");
    $sql=file_get_contents(__DIR__.'/../database.sql');
    $sql=preg_replace('/CREATE DATABASE.*?;\s*USE tecnogest;/s','',$sql);
    $admin->exec($sql);
    check((int)$admin->query("SELECT COUNT(*) FROM information_schema.TABLES WHERE TABLE_SCHEMA='$name' AND ENGINE='InnoDB'")->fetchColumn()===8,'fresh schema has eight InnoDB tables');
    $secret=bin2hex(random_bytes(16));
    $q=$admin->prepare('INSERT INTO usuarios(nombre,email,password,rol_id) VALUES (?,?,?,?)');
    foreach(['Administrador','Técnico','Docente'] as $i=>$role) $q->execute([$role, 'test'.$i.'@example.invalid',password_hash($secret,PASSWORD_DEFAULT),$i+1]);
    $admin->exec("INSERT INTO equipos(codigo,tipo_id,ubicacion_id,estado) VALUES ('TEST-1',1,1,'Activo'),('TEST-2',1,1,'Activo')");
    $report=create_report($admin,1,3,'<script>alert(1)</script>');
    check($admin->query('SELECT estado FROM equipos WHERE id=1')->fetchColumn()==='En Mantenimiento','report changes equipment state');
    try {create_report($admin,1,3,'duplicate'); check(false,'duplicate rejected');} catch(DomainException $e){check(true,'duplicate report rejected');}
    save_maintenance($admin,$report,2,3,'diagnosis','');
    save_maintenance($admin,$report,2,4,'diagnosis','fixed');
    check($admin->query('SELECT estado FROM equipos WHERE id=1')->fetchColumn()==='Activo','repair restores availability');
    save_maintenance($admin,$report,2,2,'reopened','');
    check($admin->query('SELECT fecha_fin FROM mantenimientos WHERE reporte_id='.$report)->fetchColumn()===null,'reopening clears end date');
    save_maintenance($admin,$report,2,5,'diagnosis','fixed');
    try {save_maintenance($admin,$report,2,2,'','');check(false,'closed report immutable');} catch(DomainException $e){check(true,'closed report immutable');}
    check((int)$admin->query('SELECT COUNT(*) FROM mantenimientos')->fetchColumn()===1,'maintenance updates do not duplicate records');
    try {$admin->exec('DELETE FROM equipos WHERE id=1');check(false,'foreign key protection');} catch(PDOException $e){check(true,'foreign keys preserve report history');}
    $admin->beginTransaction(); $admin->exec("UPDATE equipos SET marca='rollback' WHERE id=2"); $admin->rollBack();
    check($admin->query('SELECT marca FROM equipos WHERE id=2')->fetchColumn()===null,'transaction rollback is effective');
    $root=realpath(__DIR__.'/..');
    mkdir($root.'/storage/'.$name);
    putenv('APP_STORAGE_DIR='.$root.'/storage/'.$name);
    putenv('DB_NAME='.$name);
    $server=proc_open([PHP_BINARY,'-d','session.save_path='.$root.'/storage','-d','display_errors=0','-d','xdebug.mode=off','-S','127.0.0.1:8097','-t',$root],[0=>['pipe','r'],1=>['file',$root.'/storage/test-server.log','a'],2=>['file',$root.'/storage/test-server.log','a']],$pipes,$root);
    for($i=0;$i<20;$i++){usleep(100000);$socket=@fsockopen('127.0.0.1',8097);if($socket){fclose($socket);break;}}
    [$code,$body]=request('/auth/login.php'); check($code===200,'login renders'); $csrf=token($body);
    [$code]=request('/auth/login.php',['email'=>'test0@example.invalid','password'=>$secret]); check($code===403,'login rejects missing CSRF');
    [$code]=request('/auth/login.php',['email'=>'test0@example.invalid','password'=>$secret,'csrf_token'=>$csrf]);check($code===302,'admin login succeeds');
    foreach(['/modules/dashboard/index.php','/modules/equipos/index.php','/modules/equipos/create.php','/modules/equipos/edit.php?id=1','/modules/usuarios/index.php','/modules/usuarios/create.php','/modules/usuarios/edit.php?id=1','/modules/ubicaciones/index.php','/modules/ubicaciones/create.php','/modules/ubicaciones/edit.php?id=1','/modules/reportes/index.php','/modules/reportes/create.php','/modules/reportes/view.php?id='.$report,'/modules/mantenimiento/index.php','/modules/mantenimiento/assign.php?reporte_id='.$report,'/modules/estadisticas/index.php'] as $route) {
        [$code,$body]=request($route);check($code===200 && !str_contains($body,'Fatal error') && !str_contains($body,'Warning:'),'route '.$route);
    }
    [$code,$body]=request('/modules/reportes/view.php?id='.$report);check(str_contains($body,'&lt;script&gt;')&&!str_contains($body,'<script>alert'),'stored XSS is escaped');
    [$code,$body]=request('/modules/equipos/index.php?q=%27%20OR%201%3D1--');check($code===200 && str_contains($body,'0 resultados'),'SQL injection remains search text');
    [$code,$body]=request('/modules/equipos/create.php');$csrf=token($body);
    $fields=['csrf_token'=>$csrf,'codigo'=>'HTTP-1','tipo_id'=>'1','ubicacion_id'=>'1','estado'=>'Activo'];
    [$code]=request('/modules/equipos/create.php',$fields);check($code===302,'equipment INSERT via form');
    $id=$admin->query("SELECT id FROM equipos WHERE codigo='HTTP-1'")->fetchColumn();
    [$code,$body]=request('/modules/equipos/create.php',$fields);check($code===200 && str_contains($body,'ya existe'),'duplicate equipment rejected');
    $fields['codigo']='HTTP-UPDATED';
    [$code]=request('/modules/equipos/edit.php?id='.$id,$fields);check($code===302 && $admin->query('SELECT codigo FROM equipos WHERE id='.$id)->fetchColumn()==='HTTP-UPDATED','equipment UPDATE via form');
    [$code]=request('/modules/equipos/delete.php',['csrf_token'=>$csrf,'id'=>$id]);check($code===302 && !$admin->query('SELECT id FROM equipos WHERE id='.$id)->fetchColumn(),'equipment DELETE via form');
    [$code]=request('/modules/equipos/delete.php');check($code===405,'GET cannot delete');
    [$code]=request('/modules/equipos/edit.php?id[]=1');check($code===400,'array input rejected');
    [$code,$body]=request('/auth/login.php',null,'docente'); $docCsrf=token($body);
    [$code]=request('/auth/login.php',['csrf_token'=>$docCsrf,'email'=>'test2@example.invalid','password'=>$secret],'docente');check($code===302,'teacher login succeeds');
    [$code]=request('/modules/usuarios/index.php',null,'docente');check($code===302,'teacher cannot access users');
    [$code,$body]=request('/modules/reportes/create.php',null,'docente');$docCsrf=token($body);
    [$code]=request('/modules/equipos/delete.php',['csrf_token'=>$docCsrf,'id'=>2],'docente');check($code===403,'teacher cannot delete by direct URL');
    [$code]=request('/auth/logout.php',['csrf_token'=>$docCsrf],'docente');check($code===302,'POST logout succeeds');
    [$code]=request('/modules/reportes/index.php',null,'docente');check($code===302,'logout revokes access');
    [$code,$body]=request('/modules/ubicaciones/create.php');$csrf=token($body);
    [$code]=request('/modules/ubicaciones/create.php',['csrf_token'=>$csrf,'nombre'=>'Test lab','descripcion'=>'Test']);check($code===302,'location INSERT');
    $loc=$admin->query("SELECT id FROM ubicaciones WHERE nombre='Test lab'")->fetchColumn();
    [$code]=request('/modules/ubicaciones/edit.php?id='.$loc,['csrf_token'=>$csrf,'nombre'=>'Updated lab','descripcion'=>'Updated']);check($code===302,'location UPDATE');
    [$code,$body]=request('/modules/ubicaciones/create.php',['csrf_token'=>$csrf,'nombre'=>'Updated lab']);check($code===200&&str_contains($body,'Ya existe'),'duplicate location rejected');
    [$code,$body]=request('/modules/usuarios/create.php',['csrf_token'=>$csrf,'nombre'=>'Test','email'=>'bad','password'=>$secret,'rol_id'=>3]);check($code===200&&str_contains($body,'no es válido'),'email validation');
    [$code]=request('/modules/usuarios/create.php',['csrf_token'=>$csrf,'nombre'=>'New','email'=>'new@example.invalid','password'=>$secret,'rol_id'=>3]);check($code===302,'user INSERT');
    $user=$admin->query("SELECT id FROM usuarios WHERE email='new@example.invalid'")->fetchColumn();
    [$code]=request('/modules/usuarios/edit.php?id='.$user,['csrf_token'=>$csrf,'nombre'=>'Updated','email'=>'new@example.invalid','password'=>'','rol_id'=>3]);check($code===302,'user UPDATE without password change');
    [$code,$body]=request('/modules/usuarios/edit.php?id=1',['csrf_token'=>$csrf,'nombre'=>'Admin','email'=>'test0@example.invalid','rol_id'=>3]);check($code===200&&str_contains($body,'propio rol'),'self-demotion prevented');
    [$code]=request('/modules/reportes/create.php',['csrf_token'=>$csrf,'equipo_id'=>2,'descripcion'=>'HTTP report']);check($code===302,'report INSERT via form');
    $httpReport=$admin->query('SELECT id FROM reportes WHERE equipo_id=2')->fetchColumn();
    [$code,$body]=request('/modules/equipos/edit.php?id=2',['csrf_token'=>$csrf,'codigo'=>'TEST-2','tipo_id'=>1,'ubicacion_id'=>1,'estado'=>'Activo']);check($code===200&&str_contains($body,'reportes abiertos'),'equipment edit cannot override open reports');
    [$code]=request('/modules/mantenimiento/assign.php?reporte_id='.$httpReport,['csrf_token'=>$csrf,'estado_id'=>4,'diagnostico'=>'tested','solucion'=>'fixed']);check($code===302,'maintenance UPDATE via form');
    [$code,$body]=request('/auth/login.php',null,'technical');$techCsrf=token($body);
    [$code]=request('/auth/login.php',['csrf_token'=>$techCsrf,'email'=>'test1@example.invalid','password'=>$secret],'technical');check($code===302,'technician login');
    [$code]=request('/modules/equipos/index.php',null,'technical');check($code===200,'technician inventory access');
    [$code]=request('/modules/usuarios/index.php',null,'technical');check($code===302,'technician cannot manage users');
    [$code,$body]=request('/auth/login.php',null,'other');$otherCsrf=token($body);
    [$code]=request('/auth/login.php',['csrf_token'=>$otherCsrf,'email'=>'new@example.invalid','password'=>$secret],'other');check($code===302,'second teacher login');
    [$code]=request('/modules/reportes/view.php?id='.$report,null,'other');check($code===302,'teacher cannot read another user report');
    for($i=0;$i<10;$i++) [$code]=request('/auth/login.php',['csrf_token'=>$otherCsrf,'email'=>'none@example.invalid','password'=>'invalid'],'throttle');
    // Missing token/session is rejected before authentication and cannot alter the database.
    check($code===403,'unbound CSRF rejected repeatedly');
    [$code,$body]=request('/modules/usuarios/delete.php',['csrf_token'=>$csrf,'id'=>1]);check($code===302 && (int)$admin->query('SELECT COUNT(*) FROM usuarios WHERE id=1')->fetchColumn()===1,'self-deletion blocked');
    [$code]=request('/modules/ubicaciones/delete.php',['csrf_token'=>$csrf,'id'=>1]);check($code===302 && (int)$admin->query('SELECT COUNT(*) FROM ubicaciones WHERE id=1')->fetchColumn()===1,'associated location preserved');
    [$code]=request('/modules/ubicaciones/delete.php',['csrf_token'=>$csrf,'id'=>$loc]);check($code===302 && !(bool)$admin->query('SELECT id FROM ubicaciones WHERE id='.$loc)->fetchColumn(),'unused location DELETE');
    [$code,$body]=request('/auth/login.php',null,'rate'); $rateCsrf=token($body);
    for($i=0;$i<11;$i++) [$code]=request('/auth/login.php',['csrf_token'=>$rateCsrf,'email'=>'none@example.invalid','password'=>'invalid'],'rate');
    check($code===429,'cross-session login rate limit');
    echo "SUCCESS: $checks checks\n";
} finally {
    if(is_resource($server)) {proc_terminate($server);proc_close($server);}
    $admin->exec("DROP DATABASE `$name`");
    $testStorage=__DIR__.'/../storage/'.$name;
    if(is_dir($testStorage)) {foreach(glob($testStorage.'/*') as $file) unlink($file); rmdir($testStorage);}
    foreach(glob(__DIR__.'/../storage/test-*.cookies') as $file) unlink($file);
}
