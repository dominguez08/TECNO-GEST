<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$id = $_GET['id'] ?? null;
if (!$id) {
    header("Location: index.php");
    exit();
}

$stmt = $pdo->prepare("SELECT * FROM equipos WHERE id = ?");
$stmt->execute([$id]);
$equipo = $stmt->fetch();

if (!$equipo) {
    header("Location: index.php");
    exit();
}

$error = '';
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
        $stmt = $pdo->prepare("UPDATE equipos SET codigo=?, tipo_id=?, marca=?, modelo=?, numero_serie=?, ubicacion_id=?, estado=? WHERE id=?");
        try {
            $pdo->beginTransaction();
            $lock=$pdo->prepare('SELECT id FROM equipos WHERE id=? FOR UPDATE'); $lock->execute([$id]);
            $open=$pdo->prepare("SELECT COUNT(*) FROM reportes r JOIN estados_reporte s ON s.id=r.estado_id WHERE equipo_id=? AND s.nombre NOT IN ('Reparado','Cerrado')"); $open->execute([$id]);
            if ($estado !== 'En Mantenimiento' && $open->fetchColumn()) throw new DomainException('El equipo tiene reportes abiertos; finalice su mantenimiento primero.');
            if ($stmt->execute([$codigo, $tipo_id, $marca, $modelo, $numero_serie, $ubicacion_id, $estado, $id])) {
                $pdo->commit(); header("Location: index.php");
                exit();
            }
        } catch (DomainException $e) { if ($pdo->inTransaction()) $pdo->rollBack(); $error=$e->getMessage(); } catch (PDOException $e) { if ($pdo->inTransaction()) $pdo->rollBack();
             if ($e->getCode() == 23000) {
                $error = "El código del equipo ya existe en otro registro.";
            } else {
                $error = "No se pudo actualizar el equipo.";
            }
        }
    }
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Editar Equipo</h1>
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
                    <input type="text" class="form-control" id="codigo" name="codigo" value="<?php echo h($_POST['codigo'] ?? $equipo['codigo']); ?>" required>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="tipo_id" class="form-label">Tipo de Equipo *</label>
                    <select class="form-select" id="tipo_id" name="tipo_id" required>
                        <?php foreach($tipos as $t): ?>
                            <option value="<?php echo $t['id']; ?>" <?php echo ($t['id'] == $equipo['tipo_id']) ? 'selected' : ''; ?>><?php echo h($t['nombre']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="marca" class="form-label">Marca</label>
                    <input type="text" class="form-control" id="marca" name="marca" value="<?php echo h($_POST['marca'] ?? $equipo['marca']); ?>">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="modelo" class="form-label">Modelo</label>
                    <input type="text" class="form-control" id="modelo" name="modelo" value="<?php echo h($_POST['modelo'] ?? $equipo['modelo']); ?>">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="numero_serie" class="form-label">Número de Serie</label>
                    <input type="text" class="form-control" id="numero_serie" name="numero_serie" value="<?php echo h($_POST['numero_serie'] ?? $equipo['numero_serie']); ?>">
                </div>
                <div class="col-md-6 mb-3">
                    <label for="ubicacion_id" class="form-label">Ubicación *</label>
                    <select class="form-select" id="ubicacion_id" name="ubicacion_id" required>
                        <?php foreach($ubicaciones as $u): ?>
                            <option value="<?php echo $u['id']; ?>" <?php echo ($u['id'] == $equipo['ubicacion_id']) ? 'selected' : ''; ?>><?php echo h($u['nombre']); ?></option>
                        <?php endforeach; ?>
                    </select>
                </div>
                <div class="col-md-6 mb-3">
                    <label for="estado" class="form-label">Estado Inicial *</label>
                    <select class="form-select" id="estado" name="estado" required>
                        <option value="Activo" <?php echo ($equipo['estado'] == 'Activo') ? 'selected' : ''; ?>>Activo</option>
                        <option value="Inactivo" <?php echo ($equipo['estado'] == 'Inactivo') ? 'selected' : ''; ?>>Inactivo</option>
                        <option value="En Mantenimiento" <?php echo ($equipo['estado'] == 'En Mantenimiento') ? 'selected' : ''; ?>>En Mantenimiento</option>
                    </select>
                </div>
            </div>
            <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Guardar Cambios</button>
            <a href="index.php" class="btn btn-secondary">Cancelar</a>
        </form>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php';
