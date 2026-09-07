<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || $_SESSION['usuario_rol'] != 'Administrador') {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$id = $_GET['id'] ?? null;
if (!$id) {
    header("Location: index.php");
    exit();
}

$stmt = $pdo->prepare("SELECT * FROM usuarios WHERE id = ?");
$stmt->execute([$id]);
$usuario = $stmt->fetch();

if (!$usuario) {
    header("Location: index.php");
    exit();
}

$error = '';
$roles = $pdo->query("SELECT * FROM roles")->fetchAll();

if ($_SERVER['REQUEST_METHOD'] == 'POST' && !($error = validate_form($pdo, 'usuarios'))) {
    $nombre = trim($_POST['nombre']);
    $email = trim($_POST['email']);
    $password = $_POST['password']; // Opcional al editar
    $rol_id = $_POST['rol_id'];

    if (empty($nombre) || empty($email) || empty($rol_id)) {
        $error = "Nombre, email y rol son obligatorios.";
    } else {
        if (!empty($password)) {
            $hashed_password = password_hash($password, PASSWORD_DEFAULT);
            $stmt = $pdo->prepare("UPDATE usuarios SET nombre=?, email=?, password=?, rol_id=? WHERE id=?");
            $params = [$nombre, $email, $hashed_password, $rol_id, $id];
        } else {
            $stmt = $pdo->prepare("UPDATE usuarios SET nombre=?, email=?, rol_id=? WHERE id=?");
            $params = [$nombre, $email, $rol_id, $id];
        }

        try {
            if ($stmt->execute($params)) {
                header("Location: index.php");
                exit();
            }
        } catch (PDOException $e) {
            if ($e->getCode() == 23000) {
                $error = "El correo electrónico ya está registrado por otro usuario.";
            } else {
                $error = "Error al actualizar el usuario.";
            }
        }
    }
}
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Editar Usuario</h1>
</div>

<div class="card shadow-sm">
    <div class="card-body">
        <?php if($error): ?>
            <div class="alert alert-danger"><?php echo h($error); ?></div>
        <?php endif; ?>
        <form method="POST" action=""><?php echo csrf_field(); ?>
            <div class="mb-3">
                <label for="nombre" class="form-label">Nombre Completo</label>
                <input type="text" class="form-control" id="nombre" name="nombre" value="<?php echo h($_POST['nombre'] ?? $usuario['nombre']); ?>" required>
            </div>
            <div class="mb-3">
                <label for="email" class="form-label">Correo Electrónico</label>
                <input type="email" class="form-control" id="email" name="email" value="<?php echo h($_POST['email'] ?? $usuario['email']); ?>" required>
            </div>
            <div class="mb-3">
                <label for="password" class="form-label">Nueva Contraseña (dejar en blanco para mantener la actual)</label>
                <input type="password" class="form-control" id="password" name="password">
            </div>
            <div class="mb-3">
                <label for="rol_id" class="form-label">Rol del Usuario</label>
                <select class="form-select" id="rol_id" name="rol_id" required>
                    <?php foreach($roles as $r): ?>
                        <option value="<?php echo $r['id']; ?>" <?php echo ($r['id'] == $usuario['rol_id']) ? 'selected' : ''; ?>><?php echo h($r['nombre']); ?></option>
                    <?php endforeach; ?>
                </select>
            </div>
            <button type="submit" class="btn btn-primary"><i class="bi bi-save"></i> Guardar Cambios</button>
            <a href="index.php" class="btn btn-secondary">Cancelar</a>
        </form>
    </div>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php';
