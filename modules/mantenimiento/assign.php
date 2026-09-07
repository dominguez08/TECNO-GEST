<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$reporte_id = $_GET['reporte_id'] ?? null;
if (!$reporte_id) {
    header("Location: index.php");
    exit();
}

// Obtener detalles del reporte
$stmtRep = $pdo->prepare("SELECT * FROM reportes WHERE id = ?");
$stmtRep->execute([$reporte_id]);
$reporte = $stmtRep->fetch();

if (!$reporte) {
    header("Location: index.php");
    exit();
}

// Obtener mantenimiento si ya existe
$stmtMant = $pdo->prepare("SELECT * FROM mantenimientos WHERE reporte_id = ?");
$stmtMant->execute([$reporte_id]);
$mantenimiento = $stmtMant->fetch();

$estados = $pdo->query("SELECT * FROM estados_reporte ORDER BY id")->fetchAll();
$error = '';
$success = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST' && !($error = validate_form($pdo, 'mantenimiento'))) {
    $estado_id = $_POST['estado_id'];
    $diagnostico = trim($_POST['diagnostico']);
    $solucion = trim($_POST['solucion']);

    require_once __DIR__ . '/../../includes/maintenance.php';
    try {
        save_maintenance($pdo, (int)$reporte_id, (int)$_SESSION['usuario_id'], (int)$estado_id, $diagnostico, $solucion);
        header('Location: ../reportes/view.php?id=' . (int)$reporte_id); exit;
    } catch (DomainException $e) { $error = $e->getMessage(); }
      catch (Throwable $e) { $error = 'No se pudo guardar el mantenimiento.'; }
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Gestión de Mantenimiento - Reporte #<?php echo $reporte_id; ?></h1>
</div>

<div class="card shadow-sm">
    <div class="card-body">
        <?php if($error): ?>
            <div class="alert alert-danger"><?php echo h($error); ?></div>
        <?php endif; ?>
        <?php if($success): ?>
            <div class="alert alert-success"><?php echo h($success); ?></div>
        <?php endif; ?>

        <form method="POST" action=""><?php echo csrf_field(); ?>
            <div class="mb-3">
                <label for="estado_id" class="form-label">Estado del Reporte *</label>
                <select class="form-select" id="estado_id" name="estado_id" required>
                    <?php foreach($estados as $est): ?>
                        <option value="<?php echo $est['id']; ?>" <?php echo ($est['id'] == $reporte['estado_id']) ? 'selected' : ''; ?>>
                            <?php echo h($est['nombre']); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <div class="form-text">El equipo vuelve a estar activo cuando no quedan reportes abiertos. Un reporte cerrado no puede modificarse.</div>
            </div>
            <div class="mb-3">
                <label for="diagnostico" class="form-label">Diagnóstico del Técnico</label>
                <textarea class="form-control" id="diagnostico" name="diagnostico" rows="3"><?php echo $mantenimiento ? h($mantenimiento['diagnostico']) : ''; ?></textarea>
            </div>
            <div class="mb-3">
                <label for="solucion" class="form-label">Solución Aplicada</label>
                <textarea class="form-control" id="solucion" name="solucion" rows="3"><?php echo $mantenimiento ? h($mantenimiento['solucion']) : ''; ?></textarea>
            </div>
            <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Actualizar Mantenimiento</button>
            <a href="../reportes/view.php?id=<?php echo $reporte_id; ?>" class="btn btn-secondary">Ver Detalle Completo</a>
            <a href="index.php" class="btn btn-outline-secondary">Volver al Historial</a>
        </form>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
