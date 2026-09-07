<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$error = '';
// Obtener catálogos para los selects
$tipos = $pdo->query("SELECT * FROM tipos_equipo ORDER BY nombre")->fetchAll();
$ubicaciones = $pdo->query("SELECT * FROM ubicaciones ORDER BY nombre")->fetchAll();

if ($_SERVER['REQUEST_METHOD'] == 'POST' && !($error = validate_form($pdo, 'equipos'))) {
    $codigo = trim($_POST['codigo']);
    $tipo_id = $_POST['tipo_id'];
    $marca = trim($_POST['marca']);
    $modelo = trim($_POST['modelo']);
    $numero_serie = trim($_POST['numero_serie']);
    $ubicacion_id = $_POST['ubicacion_id'];
    $estado = $_POST['estado'];

    if (empty($codigo) || empty($tipo_id) || empty($ubicacion_id)) {
        $error = "Código, Tipo y Ubicación son obligatorios.";
    } else {
        $stmt = $pdo->prepare("INSERT INTO equipos (codigo, tipo_id, marca, modelo, numero_serie, ubicacion_id, estado) VALUES (?, ?, ?, ?, ?, ?, ?)");
        try {
            if ($stmt->execute([$codigo, $tipo_id, $marca, $modelo, $numero_serie, $ubicacion_id, $estado])) {
                header("Location: index.php");
                exit();
            }
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) { // Constraint violation (duplicate unique)
                $error = "El código del equipo ya existe.";
            } else {
                $error = "No se pudo guardar el equipo.";
            }
        }
    }
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Nuevo Equipo</h1>
</div>

<div class="card shadow-sm">
    <div class="card-body">
        <?php if($error): ?>
            <div class="alert alert-danger"><?php echo h($error); ?></div>
        <?php endif; ?>
        <form method="POST" action=""><?php echo csrf_field(); ?>
            <div class="row">
                <div class="col-md-6 mb-3">
                    <label for="codigo" class="form-label">Código de Inventario *</label>
                    <input type="text" class="form-control" id="codigo" name="codigo" required value="<?php echo h($_POST['codigo'] ?? ''); ?>">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="tipo_id" class="form-label">Tipo de Equipo *</label>
                    <select class="form-select" id="tipo_id" name="tipo_id" required>
                        <option value="">Seleccione...</option>
                        <?php foreach($tipos as $t): ?>
                            <option value="<?php echo $t['id']; ?>"><?php echo h($t['nombre']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="marca" class="form-label">Marca</label>
                    <input type="text" class="form-control" id="marca" name="marca" value="<?php echo h($_POST['marca'] ?? ''); ?>">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="modelo" class="form-label">Modelo</label>
                    <input type="text" class="form-control" id="modelo" name="modelo" value="<?php echo h($_POST['modelo'] ?? ''); ?>">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="numero_serie" class="form-label">Número de Serie</label>
                    <input type="text" class="form-control" id="numero_serie" name="numero_serie" value="<?php echo h($_POST['numero_serie'] ?? ''); ?>">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="ubicacion_id" class="form-label">Ubicación *</label>
                    <select class="form-select" id="ubicacion_id" name="ubicacion_id" required>
                        <option value="">Seleccione...</option>
                        <?php foreach($ubicaciones as $u): ?>
                            <option value="<?php echo $u['id']; ?>"><?php echo h($u['nombre']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="estado" class="form-label">Estado Inicial *</label>
                    <select class="form-select" id="estado" name="estado" required>
                        <option value="Activo">Activo</option>
                        <option value="Inactivo">Inactivo</option>
                        <option value="En Mantenimiento">En Mantenimiento</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Registrar Equipo</button>
            <a href="index.php" class="btn btn-secondary">Cancelar</a>
        </form>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
