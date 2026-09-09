<?php
global $pdo;
$settings=$pdo->query('SELECT clave,valor FROM configuracion')->fetchAll(PDO::FETCH_KEY_PAIR);
$current_dir=basename(dirname($_SERVER['SCRIPT_NAME']));
$isStaff=in_array($_SESSION['usuario_rol']??'',['Administrador','Técnico'],true);
$links=[['dashboard','Panel','grid-1x2'],['equipos','Inventario','pc-display'],['prestamos','Préstamos','file-earmark'],['mantenimiento','Mantenimiento','tools'],['ubicaciones','Ubicaciones','geo-alt']];
?>
<div id="wrapper">
<aside id="sidebar-wrapper">
<a class="sidebar-brand" href="<?php echo BASE_URL; ?>/modules/dashboard/index.php"><i class="bi bi-display"></i><div><?php echo h($settings['nombre']??'InventIC'); ?><span><?php echo h($settings['institucion']??'IEP San Rafael'); ?></span></div></a>
<?php if(isset($_SESSION['usuario_id'])): ?>
<nav class="sidebar-nav" aria-label="Navegación principal">
<?php foreach($links as [$dir,$label,$icon]): if(!$isStaff&&$dir!=='dashboard')continue; ?>
<a class="list-group-item-sidebar <?php echo $current_dir===$dir?'active':''; ?>" href="<?php echo BASE_URL.'/modules/'.$dir.'/index.php'; ?>"><i class="bi bi-<?php echo $icon; ?>"></i><?php echo $label; ?></a>
<?php endforeach; ?>
<div class="sidebar-heading">GESTIÓN</div>
<?php if($isStaff): ?><a class="list-group-item-sidebar <?php echo $current_dir==='estadisticas'?'active':''; ?>" href="<?php echo BASE_URL; ?>/modules/estadisticas/index.php"><i class="bi bi-graph-up-arrow"></i>Reportes</a><?php endif; ?>
<a class="list-group-item-sidebar <?php echo $current_dir==='reportes'?'active':''; ?>" href="<?php echo BASE_URL; ?>/modules/reportes/index.php"><i class="bi bi-exclamation-circle"></i>Reportes de fallas</a>
<?php if(($_SESSION['usuario_rol']??'')==='Administrador'): ?><a class="list-group-item-sidebar <?php echo in_array($current_dir,['configuracion','usuarios'])?'active':''; ?>" href="<?php echo BASE_URL; ?>/modules/configuracion/index.php"><i class="bi bi-gear"></i>Configuración</a><?php endif; ?>
</nav>
<div class="sidebar-account"><a href="<?php echo BASE_URL; ?>/modules/perfil/index.php"><span class="avatar avatar-small"><?php echo h(mb_strtoupper(mb_substr($_SESSION['usuario_nombre'],0,1))); ?></span><span><strong><?php echo h($_SESSION['usuario_nombre']); ?></strong><small><?php echo h($_SESSION['usuario_rol']); ?></small></span></a><form method="POST" action="<?php echo BASE_URL; ?>/auth/logout.php"><?php echo csrf_field(); ?><button><i class="bi bi-box-arrow-right"></i> Cerrar sesión</button></form></div>
<?php endif; ?>
</aside>
<div id="page-content-wrapper"><div class="mobile-topbar"><button class="btn btn-light" id="menu-toggle" aria-expanded="false" aria-controls="sidebar-wrapper"><i class="bi bi-list"></i> Menú</button><strong><?php echo h($settings['nombre']??'InventIC'); ?></strong></div>
<main class="p-content" id="main-content"><?php if(isset($_SESSION['flash'])): ?><div class="alert alert-info" role="status"><?php echo h($_SESSION['flash']);unset($_SESSION['flash']); ?></div><?php endif; ?>
