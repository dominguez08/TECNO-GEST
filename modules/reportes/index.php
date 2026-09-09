<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id'])) {
    header("Location: " . BASE_URL . "/auth/login.php");
    exit();
}

$rol = $_SESSION['usuario_rol'];
$usuario_id = $_SESSION['usuario_id'];

// Construir consulta según el rol
if ($rol == 'Docente') {
    $sql = "SELECT r.*, e.codigo, e.marca, e.modelo, er.nombre as estado_nombre, u.nombre as ubicacion_nombre
            FROM reportes r
            JOIN equipos e ON r.equipo_id = e.id
            JOIN estados_reporte er ON r.estado_id = er.id
            JOIN ubicaciones u ON e.ubicacion_id = u.id
            WHERE r.usuario_id = ?
            ORDER BY r.fecha_reporte DESC";
    $stmt = $pdo->prepare($sql);
    $stmt->execute([$usuario_id]);
} else {
    // Administrador o Técnico ven todos los reportes
    $sql = "SELECT r.*, e.codigo, e.marca, e.modelo, er.nombre as estado_nombre, us.nombre as reportador, u.nombre as ubicacion_nombre
            FROM reportes r
            JOIN equipos e ON r.equipo_id = e.id
            JOIN estados_reporte er ON r.estado_id = er.id
            JOIN usuarios us ON r.usuario_id = us.id
            JOIN ubicaciones u ON e.ubicacion_id = u.id
            ORDER BY r.fecha_reporte DESC";
    $stmt = $pdo->query($sql);
}

$reportes = $stmt->fetchAll();
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Reportes de Fallas</h1>
    <div class="btn-toolbar mb-2 mb-md-0">
        <a href="create.php" class="btn btn-sm btn-primary">
            <i class="bi bi-plus-circle"></i> Nuevo Reporte
        </a>
    </div>
</div>

<div class="table-responsive">
    <table class="table table-striped table-hover align-middle">
        <thead class="table-dark">
            <tr>
                <th>ID</th>
                <th>Fecha</th>
                <th>Equipo</th>
                <th>Ubicación</th>
                <?php if($rol != 'Docente'): ?><th>Reportado por</th><?php endif; ?>
                <th>Problema (Resumen)</th>
                <th>Estado</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($reportes as $rep): ?>
            <tr>
                <td>#<?php echo $rep['id']; ?></td>
                <td><?php echo date('d/m/Y H:i', strtotime($rep['fecha_reporte'])); ?></td>
                <td><?php echo h($rep['codigo'] . ' - ' . $rep['marca'] . ' ' . $rep['modelo']); ?></td>
                <td><?php echo h($rep['ubicacion_nombre']); ?></td>
                <?php if($rol != 'Docente'): ?><td><?php echo h($rep['reportador']); ?></td><?php endif; ?>
                <td>
                    <span class="d-inline-block text-truncate" style="max-width: 150px;">
                        <?php echo h($rep['descripcion']); ?>
                    </span>
                </td>
                <td>
                    <?php
                    $badgeClass = 'bg-secondary';
                    if ($rep['estado_nombre'] == 'Pendiente') $badgeClass = 'bg-danger';
                    if ($rep['estado_nombre'] == 'En revisión') $badgeClass = 'bg-warning text-dark';
                    if ($rep['estado_nombre'] == 'En reparación') $badgeClass = 'bg-info text-dark';
                    if ($rep['estado_nombre'] == 'Reparado') $badgeClass = 'bg-success';
                    ?>
                    <span class="badge <?php echo $badgeClass; ?>"><?php echo h($rep['estado_nombre']); ?></span>
                </td>
                <td>
                    <a href="view.php?id=<?php echo $rep['id']; ?>" class="btn btn-sm btn-info text-white" title="Ver Detalles"><i class="bi bi-eye"></i></a>
                    <?php if(($rol == 'Administrador' || $rol == 'Técnico') && $rep['estado_nombre'] == 'Pendiente'): ?>
                    <a href="../mantenimiento/assign.php?reporte_id=<?php echo $rep['id']; ?>" class="btn btn-sm btn-success" title="Atender/Asignar"><i class="bi bi-wrench"></i></a>
                    <?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            <?php if (count($reportes) == 0): ?>
            <tr><td colspan="<?php echo ($rol == 'Docente') ? 7 : 8; ?>" class="text-center">No hay reportes de fallas</td></tr>
            <?php endif; ?>
        </tbody>
    </table>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
