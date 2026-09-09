<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id'])) {
    header("Location: " . BASE_URL . "/auth/login.php");
    exit();
}

$id = $_GET['id'] ?? null;
if (!$id) {
    header("Location: index.php");
    exit();
}

// Obtener datos del reporte
$sql = "SELECT r.*, e.codigo, e.marca, e.modelo, e.numero_serie, er.nombre as estado_nombre, us.nombre as reportador, u.nombre as ubicacion_nombre, t.nombre as tipo_nombre
        FROM reportes r
        JOIN equipos e ON r.equipo_id = e.id
        JOIN tipos_equipo t ON e.tipo_id = t.id
        JOIN estados_reporte er ON r.estado_id = er.id
        JOIN usuarios us ON r.usuario_id = us.id
        JOIN ubicaciones u ON e.ubicacion_id = u.id
        WHERE r.id = ?";
$stmt = $pdo->prepare($sql);
$stmt->execute([$id]);
$reporte = $stmt->fetch();

if (!$reporte) {
    header("Location: index.php");
    exit();
}

// Obtener datos de mantenimiento si existen
$stmtMant = $pdo->prepare("SELECT m.*, u.nombre as tecnico_nombre FROM mantenimientos m JOIN usuarios u ON m.tecnico_id = u.id WHERE m.reporte_id = ?");
$stmtMant->execute([$id]);
$mantenimiento = $stmtMant->fetch();

$rol = $_SESSION['usuario_rol'];

// Solo Admin, Técnico, o el creador pueden ver
if ($rol == 'Docente' && $reporte['usuario_id'] != $_SESSION['usuario_id']) {
    header("Location: index.php");
    exit();
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Detalle de Reporte #<?php echo $reporte['id']; ?></h1>
    <div class="btn-toolbar mb-2 mb-md-0">
        <a href="index.php" class="btn btn-sm btn-secondary me-2"><i class="bi bi-arrow-left"></i> Volver</a>
        <?php if(($rol == 'Administrador' || $rol == 'Técnico') && $reporte['estado_nombre'] != 'Cerrado'): ?>
            <a href="../mantenimiento/assign.php?reporte_id=<?php echo $reporte['id']; ?>" class="btn btn-sm btn-success"><i class="bi bi-tools"></i> Actualizar Mantenimiento</a>
        <?php endif; ?>
    </div>
</div>

<div class="row">
    <div class="col-md-6 mb-4">
        <div class="card shadow-sm h-100">
            <div class="card-header bg-dark text-white">
                <h5 class="mb-0">Información del Reporte</h5>
            </div>
            <div class="card-body">
                <p><strong>Estado Actual:</strong> <span class="badge bg-secondary"><?php echo h($reporte['estado_nombre']); ?></span></p>
                <p><strong>Fecha de Creación:</strong> <?php echo date('d/m/Y H:i', strtotime($reporte['fecha_reporte'])); ?></p>
                <p><strong>Reportado por:</strong> <?php echo h($reporte['reportador']); ?></p>
                <p><strong>Descripción del Problema:</strong></p>
                <div class="p-3 bg-light border rounded">
                    <?php echo nl2br(h($reporte['descripcion'])); ?>
                </div>
            </div>
        </div>
    </div>

    <div class="col-md-6 mb-4">
        <div class="card shadow-sm h-100">
            <div class="card-header bg-dark text-white">
                <h5 class="mb-0">Información del Equipo</h5>
            </div>
            <div class="card-body">
                <p><strong>Código:</strong> <?php echo h($reporte['codigo']); ?></p>
                <p><strong>Tipo:</strong> <?php echo h($reporte['tipo_nombre']); ?></p>
                <p><strong>Marca/Modelo:</strong> <?php echo h($reporte['marca'] . ' ' . $reporte['modelo']); ?></p>
                <p><strong>Número de Serie:</strong> <?php echo h($reporte['numero_serie']); ?></p>
                <p><strong>Ubicación:</strong> <?php echo h($reporte['ubicacion_nombre']); ?></p>
            </div>
        </div>
    </div>

    <?php if($mantenimiento): ?>
    <div class="col-12 mb-4">
        <div class="card shadow-sm">
            <div class="card-header bg-primary text-white">
                <h5 class="mb-0">Bitácora de Mantenimiento</h5>
            </div>
            <div class="card-body">
                <div class="row">
                    <div class="col-md-6">
                        <p><strong>Técnico Asignado:</strong> <?php echo h($mantenimiento['tecnico_nombre']); ?></p>
                        <p><strong>Fecha de Inicio:</strong> <?php echo date('d/m/Y H:i', strtotime($mantenimiento['fecha_inicio'])); ?></p>
                        <?php if($mantenimiento['fecha_fin']): ?>
                        <p><strong>Fecha de Finalización:</strong> <?php echo date('d/m/Y H:i', strtotime($mantenimiento['fecha_fin'])); ?></p>
                        <?php endif; ?>
                    </div>
                    <div class="col-md-6">
                        <p><strong>Diagnóstico:</strong></p>
                        <div class="p-2 bg-light border rounded mb-3">
                            <?php echo $mantenimiento['diagnostico'] ? nl2br(h($mantenimiento['diagnostico'])) : '<em>Pendiente</em>'; ?>
                        </div>
                        <p><strong>Solución Aplicada:</strong></p>
                        <div class="p-2 bg-light border rounded">
                            <?php echo $mantenimiento['solucion'] ? nl2br(h($mantenimiento['solucion'])) : '<em>Pendiente</em>'; ?>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
