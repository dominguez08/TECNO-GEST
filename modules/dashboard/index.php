<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id'])) {
    header("Location: " . BASE_URL . "/auth/login.php");
    exit();
}

$rol = $_SESSION['usuario_rol'];
$usuario_id = $_SESSION['usuario_id'];

// Consultas para indicadores (Equipos en general)
$stats = [
    'equipos_totales' => 0,
    'equipos_activos' => 0,
    'equipos_inactivos' => 0,
    'equipos_mantenimiento' => 0,
    'mis_reportes' => 0
];

if ($rol == 'Administrador' || $rol == 'Técnico') {
    require_once __DIR__ . '/../../includes/queries.php';
    $counts = equipment_stats($pdo);
    $stats['equipos_totales']=$counts['total'];
    $stats['equipos_activos']=$counts['active'];
    $stats['equipos_inactivos']=$counts['inactive'];
    $stats['equipos_mantenimiento']=$counts['maintenance'];} else {
    // Si es docente
    $stmt = $pdo->prepare("SELECT COUNT(*) FROM reportes WHERE usuario_id = ?");
    $stmt->execute([$usuario_id]);
    $stats['mis_reportes'] = $stmt->fetchColumn();
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="page-title-box">
    <div>
        <h1 class="page-title">Panel de Control</h1>
        <p class="text-muted mb-0">Resumen general del estado tecnológico</p>
    </div>
</div>

<div class="row mt-4">
    <?php if ($rol == 'Administrador' || $rol == 'Técnico'): ?>

    <div class="col-md-3 mb-4">
        <a href="<?php echo BASE_URL; ?>/modules/equipos/index.php" class="text-decoration-none">
            <div class="stats-card card-total h-100">
                <p>Equipos totales</p>
                <h3><?php echo $stats['equipos_totales']; ?></h3>
                <div class="icon-box"><i class="bi bi-people"></i></div>
            </div>
        </a>
    </div>

    <div class="col-md-3 mb-4">
        <a href="<?php echo BASE_URL; ?>/modules/equipos/index.php" class="text-decoration-none">
            <div class="stats-card card-disponible h-100">
                <p>Disponibles</p>
                <h3><?php echo $stats['equipos_activos']; ?></h3>
                <div class="icon-box"><i class="bi bi-check-circle"></i></div>
            </div>
        </a>
    </div>

    <div class="col-md-3 mb-4">
        <a href="<?php echo BASE_URL; ?>/modules/equipos/index.php" class="text-decoration-none">
            <div class="stats-card card-inactivo h-100">
                <p>Inactivos</p>
                <h3><?php echo $stats['equipos_inactivos']; ?></h3>
                <div class="icon-box"><i class="bi bi-hand-thumbs-down"></i></div>
            </div>
        </a>
    </div>

    <div class="col-md-3 mb-4">
        <a href="<?php echo BASE_URL; ?>/modules/equipos/index.php" class="text-decoration-none">
            <div class="stats-card card-mantenimiento h-100">
                <p>En mantenimiento</p>
                <h3><?php echo $stats['equipos_mantenimiento']; ?></h3>
                <div class="icon-box"><i class="bi bi-tools"></i></div>
            </div>
        </a>
    </div>

    <?php else: ?>
    <!-- Vista para Docentes -->
    <div class="col-md-6 mb-4">
        <a href="<?php echo BASE_URL; ?>/modules/reportes/index.php" class="text-decoration-none">
            <div class="stats-card card-total h-100">
                <p>Mis Reportes</p>
                <h3><?php echo $stats['mis_reportes']; ?></h3>
                <div class="icon-box"><i class="bi bi-file-earmark-text"></i></div>
            </div>
        </a>
    </div>
    <div class="col-md-6 mb-4">
        <div class="card h-100 shadow-sm border-0" style="border-radius:12px;">
            <div class="card-body text-center d-flex flex-column justify-content-center p-4">
                <i class="bi bi-plus-circle-dotted text-muted mb-3" style="font-size: 3rem;"></i>
                <h5 class="card-title">¿Un equipo falló?</h5>
                <p class="card-text text-muted">Ayúdanos a mantener los equipos funcionando correctamente.</p>
                <a href="<?php echo BASE_URL; ?>/modules/reportes/create.php" class="btn btn-dark-blue mt-auto">Crear Nuevo Reporte</a>
            </div>
        </div>
    </div>
    <?php endif; ?>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
