<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$sql = "SELECT m.*, r.fecha_reporte, e.codigo, er.nombre as estado_nombre, u.nombre as tecnico_nombre
        FROM mantenimientos m
        JOIN reportes r ON m.reporte_id = r.id
        JOIN equipos e ON r.equipo_id = e.id
        JOIN estados_reporte er ON r.estado_id = er.id
        JOIN usuarios u ON m.tecnico_id = u.id
        ORDER BY m.fecha_inicio DESC";
$stmt = $pdo->query($sql);
$mantenimientos = $stmt->fetchAll();
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Historial de Mantenimientos</h1>
</div>

<div class="table-responsive">
    <table class="table table-striped table-hover align-middle">
        <thead class="table-dark">
            <tr>
                <th>ID Reporte</th>
                <th>Equipo</th>
                <th>Técnico</th>
                <th>Fecha Inicio</th>
                <th>Fecha Fin</th>
                <th>Estado Reporte</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($mantenimientos as $m): ?>
            <tr>
                <td>#<?php echo $m['reporte_id']; ?></td>
                <td><?php echo h($m['codigo']); ?></td>
                <td><?php echo h($m['tecnico_nombre']); ?></td>
                <td><?php echo date('d/m/Y', strtotime($m['fecha_inicio'])); ?></td>
                <td><?php echo $m['fecha_fin'] ? date('d/m/Y', strtotime($m['fecha_fin'])) : '-'; ?></td>
                <td><span class="badge bg-secondary"><?php echo h($m['estado_nombre']); ?></span></td>
                <td>
                    <a href="../reportes/view.php?id=<?php echo $m['reporte_id']; ?>" class="btn btn-sm btn-info text-white"><i class="bi bi-eye"></i></a>
                    <?php if($m['estado_nombre'] != 'Cerrado'): ?>
                        <a href="assign.php?reporte_id=<?php echo $m['reporte_id']; ?>" class="btn btn-sm btn-primary"><i class="bi bi-pencil"></i></a>
                    <?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            <?php if (count($mantenimientos) == 0): ?>
            <tr><td colspan="7" class="text-center">No hay registros de mantenimiento</td></tr>
            <?php endif; ?>
        </tbody>
    </table>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
