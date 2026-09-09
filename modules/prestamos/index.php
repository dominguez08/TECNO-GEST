<?php
require __DIR__.'/../../includes/app.php';require __DIR__.'/../../includes/loans.php';access();
$error='';
if($_SERVER['REQUEST_METHOD']==='POST') {
    try{return_loan($pdo,(int)($_POST['id']??0),(int)$_SESSION['usuario_id']);redirect_to('index.php','Devolución registrada.');}
    catch(DomainException $e){$error=$e->getMessage();}
}
$state=$_GET['estado']??'Todos';$search=trim($_GET['q']??'');
$counts=record('SELECT COALESCE(SUM(devuelto_en IS NULL),0) active,COALESCE(SUM(devuelto_en IS NULL AND fecha_devolucion=CURRENT_DATE),0) today,COALESCE(SUM(devuelto_en IS NULL AND fecha_devolucion<CURRENT_DATE),0) late,COALESCE(SUM(devuelto_en IS NOT NULL),0) completed FROM prestamos');
page_start('Préstamos de equipos',$counts['active'].' equipos actualmente prestados',button_link('create.php','Nuevo préstamo'));
stats_cards([[$counts['active'],'Préstamos activos','blue','calendar2-check'],[$counts['today'],'Vencen hoy','amber','calendar-date'],[$counts['late'],'Atrasados','red','gear-fill'],[$counts['completed'],'Completados','green','check-square-fill']]);
if($error)echo '<div class="alert alert-danger">'.h($error).'</div>';
?>
<form class="search-form" method="GET"><input type="hidden" name="estado" value="<?php echo h($state); ?>"><div class="search-box"><i class="bi bi-search"></i><input name="q" aria-label="Buscar préstamo" placeholder="Buscar préstamo…" value="<?php echo h($search); ?>"></div><button class="btn btn-light">Buscar</button></form>
<?php
filter_tabs(['Todos','Activos','Atrasados','Devueltos'],$state);
$filter=['Activos'=>'p.devuelto_en IS NULL','Atrasados'=>'p.devuelto_en IS NULL AND p.fecha_devolucion<CURRENT_DATE','Devueltos'=>'p.devuelto_en IS NOT NULL'][$state]??'1=1';
$params=[];if($search!==''){$filter.=' AND (e.codigo LIKE ? OR e.nombre LIKE ? OR u.nombre LIKE ?)';$params=array_fill(0,3,'%'.$search.'%');}
$from=' FROM prestamos p JOIN equipos e ON e.id=p.equipo_id JOIN usuarios u ON u.id=p.usuario_id WHERE '.$filter;
$total=(int)record('SELECT COUNT(*) total'.$from,$params)['total'];$page=min(max(1,(int)($_GET['page']??1)),max(1,(int)ceil($total/20)));
$list=rows('SELECT p.*,e.codigo,e.nombre,e.marca,e.modelo,u.nombre prestatario'.$from.' ORDER BY p.id DESC LIMIT 20 OFFSET '.(($page-1)*20),$params);
?>
<div class="table-responsive"><table class="table-custom"><thead><tr><th>Equipo</th><th>Prestado a</th><th>Fecha préstamo</th><th>Devolución</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>
<?php foreach($list as $p): ?><tr><td><a href="../equipos/view.php?id=<?php echo $p['equipo_id']; ?>"><?php echo h($p['codigo']); ?></a><small><?php echo h($p['nombre']?:$p['marca'].' '.$p['modelo']); ?></small></td><td><?php echo h($p['prestatario']); ?></td><td><?php echo date('d/m/Y',strtotime($p['fecha_prestamo'])); ?></td><td><?php echo date('d/m/Y',strtotime($p['fecha_devolucion'])); ?></td><td><?php echo badge($p['devuelto_en']?'Devuelto':($p['fecha_devolucion']<date('Y-m-d')?'Atrasado':'Prestado')); ?></td><td><?php if(!$p['devuelto_en']): ?><form method="POST" data-confirm="¿Confirmar la devolución de este equipo?"><?php echo csrf_field(); ?><input name="id" type="hidden" value="<?php echo $p['id']; ?>"><button class="btn btn-light btn-sm" title="Registrar devolución"><i class="bi bi-arrow-return-left"></i> Devolver</button></form><?php else: echo '<small>'.h($p['devuelto_en']).'</small>';endif; ?></td></tr><?php endforeach;if(!$list)empty_row(6,'No hay préstamos en esta vista.'); ?>
</tbody></table></div><?php pagination($total,$page);page_end(); ?>
