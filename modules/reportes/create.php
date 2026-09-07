<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id'])) {
    header("Location: " . BASE_URL . "/auth/login.php");
    exit();
}

$error = '';
$success = '';

// Obtener equipos activos para el select
$equipos = $pdo->query("
    SELECT e.id, e.codigo, e.marca, e.modelo, t.nombre as tipo_nombre, u.nombre as ubicacion_nombre
    FROM equipos e
    JOIN tipos_equipo t ON e.tipo_id = t.id
    JOIN ubicaciones u ON e.ubicacion_id = u.id
    WHERE e.estado = 'Activo'
    ORDER BY u.nombre, e.codigo
")->fetchAll();

$equipo_id_get = $_GET['equipo_id'] ?? '';

if ($_SERVER['REQUEST_METHOD'] == 'POST' && !($error = validate_form($pdo, 'reportes'))) {
    $equipo_id = $_POST['equipo_id'];
    $descripcion = trim($_POST['descripcion']);
    $usuario_id = $_SESSION['usuario_id'];

    if (empty($equipo_id) || empty($descripcion)) {
        $error = "Debe seleccionar un equipo y describir el problema.";
    } else {
        require_once __DIR__ . '/../../includes/maintenance.php';
        try {
            $id = create_report($pdo, (int)$equipo_id, (int)$usuario_id, $descripcion);
            header('Location: view.php?id=' . $id); exit;
        } catch (DomainException $e) { $error = $e->getMessage(); }
          catch (Throwable $e) { $error = 'No se pudo guardar el reporte.'; }
    }
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Crear Nuevo Reporte de Falla</h1>
</div>

<div class="card shadow-sm">
    <div class="card-body">
        <?php if($error): ?>
            <div class="alert alert-danger"><?php echo h($error); ?></div>
        <?php endif; ?>
        <?php if($success): ?>
            <div class="alert alert-success"><?php echo h($success); ?></div>
            <a href="index.php" class="btn btn-primary">Volver a mis reportes</a>
        <?php else: ?>
        <form method="POST" action=""><?php echo csrf_field(); ?>
            <div class="mb-3">
                <label for="equipo_id" class="form-label">Equipo que presenta la falla *</label>
                <select class="form-select" id="equipo_id" name="equipo_id" required>
                    <option value="">Seleccione un equipo...</option>
                    <?php foreach($equipos as $eq): ?>
                        <option value="<?php echo $eq['id']; ?>" <?php echo ($equipo_id_get == $eq['id']) ? 'selected' : ''; ?>>
                            [<?php echo h($eq['ubicacion_nombre']); ?>] - <?php echo h($eq['codigo'] . ' - ' . $eq['tipo_nombre'] . ' ' . $eq['marca']); ?>
                        </option>
                    <?php endforeach; ?>
                </select>
                <div class="form-text">Si el equipo no aparece, asegúrese de que esté registrado y activo.</div>
            </div>
            <div class="mb-3">
                <label for="descripcion" class="form-label">Descripción del Problema *</label>
                <textarea class="form-control" id="descripcion" name="descripcion" rows="5" required placeholder="Describa detalladamente el problema o falla que presenta el equipo..."></textarea>
            </div>
            <button type="submit" class="btn btn-primary"><i class="bi bi-send"></i> Enviar Reporte</button>
            <a href="index.php" class="btn btn-secondary">Cancelar</a>
        </form>
        <?php endif; ?>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
