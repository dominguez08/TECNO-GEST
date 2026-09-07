<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$filtro_estado = $_GET['estado'] ?? 'Todos';

require_once __DIR__ . '/../../includes/queries.php';
$stats = equipment_stats($pdo);
[$totales,$activos,$inactivos,$mantenimiento] = [$stats['total'],$stats['active'],$stats['inactive'],$stats['maintenance']];
$sedes = $pdo->query('SELECT COUNT(*) FROM ubicaciones')->fetchColumn();
$search = trim($_GET['q'] ?? '');
$category = (int)($_GET['tipo'] ?? 0);
$location = (int)($_GET['ubicacion'] ?? 0);
$page = max(1, (int)($_GET['page'] ?? 1));
$types = $pdo->query('SELECT id,nombre FROM tipos_equipo ORDER BY nombre')->fetchAll();
$locations = $pdo->query('SELECT id,nombre FROM ubicaciones ORDER BY nombre')->fetchAll();
$from = ' FROM equipos e JOIN tipos_equipo t ON t.id=e.tipo_id JOIN ubicaciones u ON u.id=e.ubicacion_id';
$where = []; $params = [];
$states = ['Disponibles'=>'Activo','Inactivos'=>'Inactivo','Mantenimiento'=>'En Mantenimiento'];
if (isset($states[$filtro_estado])) { $where[]='e.estado=?'; $params[]=$states[$filtro_estado]; }
if ($search !== '') { $where[]='(e.codigo LIKE ? OR e.modelo LIKE ? OR e.marca LIKE ? OR u.nombre LIKE ?)'; for($i=0;$i<4;$i++) $params[]='%'.$search.'%'; }
if ($category) { $where[]='e.tipo_id=?'; $params[]=$category; }
if ($location) { $where[]='e.ubicacion_id=?'; $params[]=$location; }
$from .= $where ? ' WHERE '.implode(' AND ',$where) : '';
$stmt=$pdo->prepare('SELECT COUNT(*)'.$from); $stmt->execute($params); $matches=(int)$stmt->fetchColumn();
$pages=max(1,(int)ceil($matches/20)); $page=min($page,$pages); $offset=($page-1)*20;
$stmt=$pdo->prepare('SELECT e.*,t.nombre AS tipo_nombre,u.nombre AS ubicacion_nombre'.$from.' ORDER BY e.codigo LIMIT 20 OFFSET '.$offset);
$stmt->execute($params); $equipos=$stmt->fetchAll();
$activity=$pdo->query('SELECT r.id,r.fecha_reporte,e.codigo,s.nombre FROM reportes r JOIN equipos e ON e.id=r.equipo_id JOIN estados_reporte s ON s.id=r.estado_id ORDER BY r.fecha_reporte DESC,r.id DESC LIMIT 4')->fetchAll();
function inventory_url(array $changes): string { return '?'.h(http_build_query(array_merge($_GET,['page'=>1],$changes))); }
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="page-title-box mb-4">
    <div>
        <h1 class="page-title">Inventario de equipos</h1>
        <p class="text-muted mb-0"><?php echo $totales; ?> equipos registrados en <?php echo $sedes; ?> ubicaciones</p>
    </div>



    <a href="create.php" class="btn btn-dark-blue">
        <i class="bi bi-plus-lg"></i> Registrar equipo
    </a>
</div>

<div class="row mb-4">
    <div class="col-md-3">
        <div class="stats-card card-total">
            <p>Equipos totales</p>
            <h3><?php echo $totales; ?></h3>
            <div class="icon-box"><i class="bi bi-people"></i></div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="stats-card card-disponible">
            <p>Disponibles</p>
            <h3><?php echo $activos; ?></h3>
            <div class="icon-box"><i class="bi bi-check-circle"></i></div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="stats-card card-inactivo">
            <p>Inactivos</p>
            <h3><?php echo $inactivos; ?></h3>
            <div class="icon-box"><i class="bi bi-hand-thumbs-down"></i></div>
        </div>
    </div>
    <div class="col-md-3">
        <div class="stats-card card-mantenimiento">
            <p>En mantenimiento</p>
            <h3><?php echo $mantenimiento; ?></h3>
            <div class="icon-box"><i class="bi bi-tools"></i></div>
        </div>
    </div>
</div>

<form method="GET" class="d-flex flex-wrap gap-2 mb-3" role="search">
    <input type="hidden" name="estado" value="<?php echo h($filtro_estado); ?>">
    <div class="search-box"><i class="bi bi-search" aria-hidden="true"></i><input aria-label="Buscar equipos" name="q" value="<?php echo h($search); ?>" placeholder="Buscar por código, modelo o aula…" maxlength="100"></div>
    <select class="form-select w-auto" name="tipo" aria-label="Categoría"><option value="0">Todas las categorías</option><?php foreach($types as $type): ?><option value="<?php echo $type['id']; ?>" <?php echo $category==$type['id']?'selected':''; ?>><?php echo h($type['nombre']); ?></option><?php endforeach; ?></select>
    <select class="form-select w-auto" name="ubicacion" aria-label="Ubicación"><option value="0">Todas las ubicaciones</option><?php foreach($locations as $loc): ?><option value="<?php echo $loc['id']; ?>" <?php echo $location==$loc['id']?'selected':''; ?>><?php echo h($loc['nombre']); ?></option><?php endforeach; ?></select>
    <button class="btn btn-dark-blue">Buscar</button><a class="btn btn-light" href="index.php">Limpiar</a>
</form>
<div class="mb-4 d-flex align-items-center flex-wrap gap-2">
    <span class="text-muted me-2" style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase;">Filtrar</span>
    <a href="<?php echo inventory_url(['estado'=>'Todos']); ?>" class="filter-pill <?php echo $filtro_estado=='Todos'?'active':''; ?>">Todos</a>
    <a href="<?php echo inventory_url(['estado'=>'Disponibles']); ?>" class="filter-pill <?php echo $filtro_estado=='Disponibles'?'active':''; ?>">Disponibles</a>
    <a href="<?php echo inventory_url(['estado'=>'Inactivos']); ?>" class="filter-pill <?php echo $filtro_estado=='Inactivos'?'active':''; ?>">Inactivos</a>
    <a href="<?php echo inventory_url(['estado'=>'Mantenimiento']); ?>" class="filter-pill <?php echo $filtro_estado=='Mantenimiento'?'active':''; ?>">Mantenimiento</a>
</div>

<div class="inventory-layout"><div><div class="table-responsive">
    <table class="table-custom">
        <thead>
            <tr>
                <th>Código</th>
                <th>Equipo</th>
                <th>Ubicación</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody id="equiposTableBody">
            <?php foreach ($equipos as $eq): ?>
            <tr>
                <td><strong><?php echo h($eq['codigo']); ?></strong></td>
                <td>
                    <div class="fw-bold"><?php echo h($eq['tipo_nombre'] . ' ' . $eq['marca']); ?></div>
                    <small class="text-muted"><?php echo h($eq['modelo'] . ' - SN: ' . $eq['numero_serie']); ?></small>
                </td>
                <td><?php echo h($eq['ubicacion_nombre']); ?></td>
                <td>
                    <?php
                        $status_label = $eq['estado'] == 'Activo' ? 'Disponible' : $eq['estado'];
                        $status_class_name = str_replace(' ', '-', $eq['estado']);
                    ?>
                    <span class="status-badge status-<?php echo $status_class_name; ?>"><?php echo $status_label; ?></span>
                </td>
                <td>
                    <a class="btn btn-sm btn-light" aria-label="Editar equipo <?php echo h($eq['codigo']); ?>" href="edit.php?id=<?php echo $eq['id']; ?>"><i class="bi bi-pencil"></i></a>
                    <?php if($eq['estado']==='Activo'): ?><a class="btn btn-sm btn-light" title="Reportar falla" href="../reportes/create.php?equipo_id=<?php echo $eq['id']; ?>"><i class="bi bi-exclamation-triangle"></i></a><?php endif; ?>
                    <?php if($_SESSION['usuario_rol']==='Administrador'): ?><form class="d-inline" method="POST" action="delete.php" data-confirm="¿Eliminar este equipo? Solo se eliminará si no tiene reportes."><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo $eq['id']; ?>"><button class="btn btn-sm btn-light text-danger" aria-label="Eliminar equipo <?php echo h($eq['codigo']); ?>"><i class="bi bi-trash"></i></button></form><?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            <?php if (count($equipos) == 0): ?>
            <tr><td colspan="5" class="text-center py-4 bg-white" style="border-radius: 8px;">No hay equipos encontrados.</td></tr>
            <?php endif; ?>
        </tbody>
    </table>
</div>

<nav class="d-flex flex-wrap align-items-center gap-2 mt-3" aria-label="Paginación">
<span class="text-muted me-auto"><?php echo $matches; ?> resultados · Página <?php echo $page; ?> de <?php echo $pages; ?></span>
<?php if($page>1): ?><a class="btn btn-sm btn-light" href="<?php echo inventory_url(['page'=>$page-1]); ?>">Anterior</a><?php endif; ?>
<?php if($page<$pages): ?><a class="btn btn-sm btn-light" href="<?php echo inventory_url(['page'=>$page+1]); ?>">Siguiente</a><?php endif; ?>
</nav></div>
<aside class="activity-panel"><h2>Actividad reciente</h2><div class="activity-items">
<?php foreach($activity as $item): ?><a class="activity-item" href="../reportes/view.php?id=<?php echo $item['id']; ?>"><strong><?php echo h($item['codigo']); ?></strong><small><?php echo h($item['nombre']); ?></small><small><?php echo date('d/m/Y H:i',strtotime($item['fecha_reporte'])); ?></small></a><?php endforeach; ?>
<?php if(!$activity): ?><p class="text-muted">Aún no hay reportes registrados.</p><?php endif; ?></div>
<hr><h2>Acciones rápidas</h2><a class="btn btn-light w-100 mb-2 text-start" href="create.php">＋ Registrar equipo</a><a class="btn btn-light w-100 text-start" href="../reportes/create.php">Reportar una falla</a></aside></div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
