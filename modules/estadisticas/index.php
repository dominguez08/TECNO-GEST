<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

// 1. Equipos por estado
$stmtEst = $pdo->query("SELECT estado, COUNT(*) as total FROM equipos GROUP BY estado");
$equipos_estado = $stmtEst->fetchAll();

// 2. Reportes por técnico
$stmtTec = $pdo->query("
    SELECT u.nombre, COUNT(m.id) as total
    FROM mantenimientos m
    JOIN usuarios u ON m.tecnico_id = u.id
    GROUP BY u.id, u.nombre
");
$mantenimientos_tecnico = $stmtTec->fetchAll();

// 3. Fallas por ubicación
$stmtUbi = $pdo->query("
    SELECT u.nombre, COUNT(r.id) as total
    FROM reportes r
    JOIN equipos e ON r.equipo_id = e.id
    JOIN ubicaciones u ON e.ubicacion_id = u.id
    GROUP BY u.id, u.nombre
    ORDER BY total DESC
");
$fallas_ubicacion = $stmtUbi->fetchAll();
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Informes Estadísticos</h1>
    <button class="btn btn-sm btn-outline-secondary" onclick="window.print()">
        <i class="bi bi-printer"></i> Imprimir Informe
    </button>
</div>

<div class="row">
    <div class="col-md-4 mb-4">
        <div class="card shadow-sm h-100">
            <div class="card-header bg-dark text-white">Equipos por Estado</div>
            <div class="card-body">
                <table class="table table-sm">
                    <thead><tr><th>Estado</th><th>Total</th></tr></thead>
                    <tbody>
                        <?php foreach($equipos_estado as $e): ?>
                        <tr>
                            <td><?php echo $e['estado']; ?></td>
                            <td><strong><?php echo $e['total']; ?></strong></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="col-md-4 mb-4">
        <div class="card shadow-sm h-100">
            <div class="card-header bg-dark text-white">Reportes Atendidos por Técnico</div>
            <div class="card-body">
                <table class="table table-sm">
                    <thead><tr><th>Técnico</th><th>Atendidos</th></tr></thead>
                    <tbody>
                        <?php foreach($mantenimientos_tecnico as $t): ?>
                        <tr>
                            <td><?php echo h($t['nombre']); ?></td>
                            <td><strong><?php echo $t['total']; ?></strong></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>

    <div class="col-md-4 mb-4">
        <div class="card shadow-sm h-100">
            <div class="card-header bg-dark text-white">Fallas Reportadas por Ubicación</div>
            <div class="card-body">
                <table class="table table-sm">
                    <thead><tr><th>Ubicación</th><th>Nº Fallas</th></tr></thead>
                    <tbody>
                        <?php foreach($fallas_ubicacion as $u): ?>
                        <tr>
                            <td><?php echo h($u['nombre']); ?></td>
                            <td><strong><?php echo $u['total']; ?></strong></td>
                        </tr>
                        <?php endforeach; ?>
                    </tbody>
                </table>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
