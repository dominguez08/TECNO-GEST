<?php
require_once __DIR__.'/app.php';access();
$id=$editing?(int)($_GET['id']??0):0;
$equipment=$editing?record('SELECT * FROM equipos WHERE id=?',[$id]):[];
if($editing&&!$equipment)redirect_to('index.php');
$error='';$newPhoto=null;
if($_SERVER['REQUEST_METHOD']==='POST') {
    $error=validate_form($pdo,'equipos');
    if(!$error)try {
        $responsible=($_POST['responsable_id']??'')!==''?(int)$_POST['responsable_id']:null;
        if($responsible&&!record('SELECT id FROM usuarios WHERE id=?',[$responsible]))throw new DomainException('Responsable inválido.');
        foreach(['nombre'=>100,'proveedor'=>100,'observaciones'=>16000] as $key=>$max)if(mb_strlen($_POST[$key]??'')>$max)throw new DomainException('El campo '.$key.' es demasiado largo.');
        $date=($_POST['fecha_adquisicion']??'')?:null;
        if($date){$d=DateTimeImmutable::createFromFormat('!Y-m-d',$date);if(!$d||$d->format('Y-m-d')!==$date)throw new DomainException('Fecha de adquisición inválida.');}
        $price=($_POST['precio']??'')!==''?$_POST['precio']:null;
        if($price!==null&&(!preg_match('/^\d{1,10}(\.\d{1,2})?$/',$price)))throw new DomainException('Precio inválido: use hasta dos decimales y un valor positivo.');
        if(isset($_FILES['fotografia'])&&$_FILES['fotografia']['error']!==UPLOAD_ERR_NO_FILE) {
            $upload=$_FILES['fotografia'];
            if($upload['error']!==UPLOAD_ERR_OK||$upload['size']>3*1024*1024)throw new DomainException('La fotografía debe pesar como máximo 3 MB.');
            $mime=(new finfo(FILEINFO_MIME_TYPE))->file($upload['tmp_name']);$ext=['image/jpeg'=>'jpg','image/png'=>'png','image/webp'=>'webp'][$mime]??null;
            if(!$ext||!getimagesize($upload['tmp_name']))throw new DomainException('Use una imagen JPG, PNG o WebP válida.');
            $newPhoto=bin2hex(random_bytes(20)).'.'.$ext;
            if(!move_uploaded_file($upload['tmp_name'],__DIR__.'/../storage/'.$newPhoto))throw new RuntimeException('No se pudo guardar la fotografía.');
        }
        $pdo->beginTransaction();
        if($editing) {
            $q=$pdo->prepare('SELECT id FROM equipos WHERE id=? FOR UPDATE');$q->execute([$id]);if(!$q->fetchColumn())throw new DomainException('El equipo ya no existe.');
            $open=record("SELECT COUNT(*) total FROM reportes r JOIN estados_reporte s ON s.id=r.estado_id WHERE equipo_id=? AND s.nombre NOT IN ('Reparado','Cerrado')",[$id]);
            if($_POST['estado']!=='En Mantenimiento'&&$open['total'])throw new DomainException('El equipo tiene reportes abiertos; finalice su mantenimiento primero.');
            if($_POST['estado']!==$equipment['estado']&&record('SELECT id FROM prestamos WHERE equipo_id=? AND devuelto_en IS NULL',[$id]))throw new DomainException('Registre la devolución antes de cambiar el estado del equipo.');
        }
        $data=[trim($_POST['codigo']),$_POST['tipo_id'],trim($_POST['marca']),trim($_POST['modelo']),trim($_POST['numero_serie']),$_POST['ubicacion_id'],$_POST['estado'],trim($_POST['nombre']??''),$responsible,$date,$price,trim($_POST['proveedor']??''),trim($_POST['observaciones']??''),$newPhoto??$equipment['fotografia']??null];
        if($editing){execute_sql('UPDATE equipos SET codigo=?,tipo_id=?,marca=?,modelo=?,numero_serie=?,ubicacion_id=?,estado=?,nombre=?,responsable_id=?,fecha_adquisicion=?,precio=?,proveedor=?,observaciones=?,fotografia=? WHERE id=?',array_merge($data,[$id]));}
        else{execute_sql('INSERT INTO equipos(codigo,tipo_id,marca,modelo,numero_serie,ubicacion_id,estado,nombre,responsable_id,fecha_adquisicion,precio,proveedor,observaciones,fotografia) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)',$data);$id=(int)$pdo->lastInsertId();}
        activity($pdo,($editing?'Actualizó':'Registró').' el equipo '.trim($_POST['codigo']),$id);$pdo->commit();redirect_to('index.php',$editing?'Equipo actualizado.':'Equipo registrado.');
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();if($newPhoto)is_file(__DIR__.'/../storage/'.$newPhoto)&&unlink(__DIR__.'/../storage/'.$newPhoto);$error=$e instanceof DomainException?$e->getMessage():($e instanceof PDOException&&$e->getCode()==='23000'?'El código ya existe o hay una referencia inválida.':'No se pudo guardar el equipo.');}
}
$values=array_merge($equipment,$_SERVER['REQUEST_METHOD']==='POST'?$_POST:[]);
page_start($editing?'Editar equipo':'Registrar nuevo equipo','Completa la información del equipo.',button_link('index.php','Inventario','arrow-left','btn-light'));
if($error)echo '<div class="alert alert-danger">'.h($error).'</div>';
?>
<form method="POST" enctype="multipart/form-data"><?php echo csrf_field(); ?><section class="form-section"><h2>Información del equipo</h2><div class="field-grid four"><?php
field('codigo','Código de inventario',$values['codigo']??'','text',true);field('nombre','Nombre del equipo',$values['nombre']??'');select_field('tipo_id','Categoría',rows('SELECT id,nombre FROM tipos_equipo ORDER BY nombre'),$values['tipo_id']??'',true);field('marca','Marca',$values['marca']??'');field('modelo','Modelo',$values['modelo']??'');field('numero_serie','Número de serie',$values['numero_serie']??'');
?></div></section><div class="panel-grid"><section class="form-section"><h2>Ubicación</h2><div class="field-grid"><?php
select_field('ubicacion_id','Sede / ubicación',rows("SELECT u.id,CONCAT(COALESCE(s.nombre,''),' · ',u.nombre) nombre FROM ubicaciones u LEFT JOIN sedes s ON s.id=u.sede_id ORDER BY s.nombre,u.nombre"),$values['ubicacion_id']??'',true);select_field('responsable_id','Responsable',rows('SELECT id,nombre FROM usuarios ORDER BY nombre'),$values['responsable_id']??'');
?></div></section><section class="form-section"><h2>Estado</h2><?php select_field('estado','Estado del equipo',[['id'=>'Activo','nombre'=>'Disponible'],['id'=>'Inactivo','nombre'=>'Inactivo'],['id'=>'En Mantenimiento','nombre'=>'Mantenimiento']],$values['estado']??'Activo',true); ?><p class="form-text">Los préstamos se registran desde el apartado Préstamos.</p></section></div>
<div class="panel-grid"><section class="form-section"><h2>Información adicional</h2><div class="field-grid"><?php field('fecha_adquisicion','Fecha de adquisición',$values['fecha_adquisicion']??'','date');field('precio','Precio',$values['precio']??'','number');field('proveedor','Proveedor',$values['proveedor']??''); ?></div><label class="form-label mt-3" for="observaciones">Observaciones</label><textarea class="form-control" name="observaciones" id="observaciones" rows="3"><?php echo h($values['observaciones']??''); ?></textarea></section><section class="form-section"><h2>Fotografía del equipo</h2><label class="photo-upload" for="fotografia"><i class="bi bi-cloud-arrow-up"></i><strong>Subir fotografía</strong><span>JPG, PNG o WebP · máximo 3 MB</span><input id="fotografia" type="file" name="fotografia" accept="image/jpeg,image/png,image/webp"></label><?php if(!empty($equipment['fotografia'])): ?><p class="form-text">El equipo ya tiene una fotografía. Se conserva si no seleccionas otra.</p><?php endif; ?></section></div><div class="form-footer"><?php echo button_link('index.php','Cancelar','x','btn-light'); ?><button class="btn btn-dark-blue"><i class="bi bi-check2"></i> <?php echo $editing?'Guardar cambios':'Registrar equipo'; ?></button></div></form><?php page_end(); ?>
