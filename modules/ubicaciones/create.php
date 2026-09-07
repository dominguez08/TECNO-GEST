<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$error = '';
if ($_SERVER['REQUEST_METHOD'] == 'POST' && !($error = validate_form($pdo, 'ubicaciones'))) {
    $nombre = trim($_POST['nombre']);
    $descripcion = trim($_POST['descripcion']);

    if (empty($nombre)) {
        $error = "El nombre es obligatorio.";
    } else {
        $stmt = $pdo->prepare("INSERT INTO ubicaciones (nombre, descripcion) VALUES (?, ?)");
        if ($stmt->execute([$nombre, $descripcion])) {
            header("Location: index.php");
            exit();
        } else {
            $error = "Error al guardar la ubicación.";
        }
    }
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Nueva Ubicación</h1>
</div>

<div class="card shadow-sm">
    <div class="card-body">
        <?php if($error): ?>
            <div class="alert alert-danger"><?php echo h($error); ?></div>
        <?php endif; ?>
        <form method="POST" action=""><?php echo csrf_field(); ?>
            <div class="mb-3">
                <label for="nombre" class="form-label">Nombre de la Ubicación</label>
                <input type="text" class="form-control" id="nombre" name="nombre" required value="<?php echo h($_POST['nombre'] ?? ''); ?>">
            </div>
            <div class="mb-3">
                <label for="descripcion" class="form-label">Descripción</label>
                <textarea class="form-control" id="descripcion" name="descripcion" rows="3"></textarea>
            </div>
            <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Guardar</button>
            <a href="index.php" class="btn btn-secondary">Cancelar</a>
        </form>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
