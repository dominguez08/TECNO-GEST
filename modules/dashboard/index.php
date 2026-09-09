<?php
require __DIR__.'/../../includes/app.php';access(false);
if(($_SESSION['usuario_rol']??'')==='Docente') {page_start('Panel','Resumen de tus reportes');$n=record('SELECT COUNT(*) total FROM reportes WHERE usuario_id=?',[$_SESSION['usuario_id']]);stats_cards([[$n['total'],'Mis reportes','blue','file-earmark-text']]);echo button_link('../reportes/create.php','Reportar una falla');page_end();exit;}
$site=(int)($_GET['sede']??0);$c=inventory_counts($site);
$sites=rows('SELECT id,nombre FROM sedes ORDER BY nombre');
$actions='<form method="GET" class="search-form"><select class="form-select" name="sede" aria-label="Sede"><option value="0">Sede: Todas</option>';
foreach($sites as $s)$actions.='<option value="'.$s['id'].'" '.($site==$s['id']?'selected':'').'>'.h($s['nombre']).'</option>';
$actions.='</select><button class="btn btn-light">Aplicar</button></form><span class="text-muted"><i class="bi bi-calendar3"></i> '.date('d/m/Y').'</span>';
page_start('Panel','Resumen general del inventario',$actions);inventory_cards($c);
$categories=rows('SELECT t.nombre,COUNT(e.id) total FROM tipos_equipo t LEFT JOIN equipos e ON e.tipo_id=t.id '.($site?'AND e.ubicacion_id IN (SELECT id FROM ubicaciones WHERE sede_id=?)':'').' GROUP BY t.id,t.nombre ORDER BY total DESC',$site?[$site]:[]);
?>
<div class="panel-grid"><section class="surface"><h2>Equipos por estado</h2><?php donut($c); ?></section><section class="surface"><h2>Equipos por categoría</h2><?php bar_chart($categories); ?></section>
<section class="surface"><h2>Actividad reciente</h2><div class="timeline"><?php
$events=rows('SELECT a.*,u.nombre FROM actividad a LEFT JOIN usuarios u ON u.id=a.usuario_id LEFT JOIN equipos e ON e.id=a.equipo_id LEFT JOIN ubicaciones l ON l.id=e.ubicacion_id '.($site?'WHERE l.sede_id=? ':'').'ORDER BY a.fecha DESC,a.id DESC LIMIT 5',$site?[$site]:[]);
foreach($events as $event)echo '<div class="timeline-item"><i class="bi bi-person"></i><span>'.h($event['descripcion']).'</span><small>'.date('d/m H:i',strtotime($event['fecha'])).'</small></div>';
if(!$events)echo '<p class="text-muted">Los nuevos movimientos aparecerán aquí.</p>';
?></div></section><section class="surface"><h2>Próximos vencimientos</h2><div class="timeline"><?php
$due=rows('SELECT p.id,p.fecha_devolucion,e.codigo,e.nombre FROM prestamos p JOIN equipos e ON e.id=p.equipo_id JOIN ubicaciones l ON l.id=e.ubicacion_id WHERE p.devuelto_en IS NULL '.($site?'AND l.sede_id=? ':'').'ORDER BY p.fecha_devolucion LIMIT 5',$site?[$site]:[]);
foreach($due as $p)echo '<a class="timeline-item" href="../prestamos/index.php"><i class="bi bi-calendar-event"></i><span>'.h($p['codigo'].' · '.$p['nombre']).'</span><small class="text-danger">'.h($p['fecha_devolucion']).'</small></a>';
if(!$due)echo '<p class="text-muted">No hay préstamos pendientes de devolución.</p>';
?></div></section></div><?php page_end(); ?>
