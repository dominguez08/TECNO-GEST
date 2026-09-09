<?php
require __DIR__.'/../../includes/app.php';require __DIR__.'/../../includes/loans.php';access();$error='';
if($_SERVER['REQUEST_METHOD']==='POST') {
    try{if(mb_strlen($_POST['observaciones']??'')>16000)throw new DomainException('Las observaciones son demasiado largas.');create_loan($pdo,(int)($_POST['equipo_id']??0),(int)($_POST['usuario_id']??0),(int)$_SESSION['usuario_id'],$_POST['fecha_prestamo']??'',$_POST['fecha_devolucion']??'',trim($_POST['observaciones']??''));redirect_to('index.php','Préstamo registrado.');}
    catch(DomainException $e){$error=$e->getMessage();}catch(PDOException $e){$error='No se pudo registrar el préstamo. Revise los datos e intente nuevamente.';}
}
page_start('Nuevo préstamo','Asigna un equipo disponible y define la fecha de devolución.',button_link('index.php','Volver','arrow-left','btn-light'));
if($error)echo '<div class="alert alert-danger">'.h($error).'</div>';
$equipment=rows("SELECT e.id,CONCAT(e.codigo,' · ',COALESCE(NULLIF(e.nombre,''),CONCAT(e.marca,' ',e.modelo))) nombre FROM equipos e WHERE e.estado='Activo' AND NOT EXISTS (SELECT 1 FROM prestamos p WHERE p.equipo_id=e.id AND p.devuelto_en IS NULL) ORDER BY e.codigo");
?><form method="POST"><?php echo csrf_field(); ?><section class="form-section"><h2>Información del préstamo</h2><div class="field-grid"><?php
select_field('equipo_id','Equipo',$equipment,$_POST['equipo_id']??$_GET['equipo_id']??'',true);select_field('usuario_id','Prestado a',rows('SELECT id,nombre FROM usuarios ORDER BY nombre'),$_POST['usuario_id']??'',true);field('fecha_prestamo','Fecha de préstamo',$_POST['fecha_prestamo']??date('Y-m-d'),'date',true);field('fecha_devolucion','Fecha de devolución',$_POST['fecha_devolucion']??date('Y-m-d',strtotime('+7 days')),'date',true);
?></div></section><section class="form-section"><label class="form-label" for="observaciones">Observaciones</label><textarea class="form-control" id="observaciones" name="observaciones" maxlength="16000" rows="4"><?php echo h($_POST['observaciones']??''); ?></textarea></section><div class="form-footer"><?php echo button_link('index.php','Cancelar','x','btn-light'); ?><button class="btn btn-dark-blue"><i class="bi bi-check2"></i> Registrar préstamo</button></div></form><?php page_end(); ?>
