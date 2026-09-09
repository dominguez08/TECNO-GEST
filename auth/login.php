<?php
require_once __DIR__ . '/../config/database.php';
require_once __DIR__ . '/../config/config.php';
$GLOBALS['page_title']='Iniciar sesión';

// Si ya está logueado, redirigir al dashboard
if (isset($_SESSION['usuario_id'])) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$error = '';

if ($_SERVER['REQUEST_METHOD'] == 'POST') {
    $email = trim($_POST['email'] ?? '');
    $password = ($_POST['password'] ?? '');

    require_once __DIR__ . '/../includes/login-limiter.php';
    [$allowed, $limiterPath] = login_limiter();
    if (!$allowed) {
        http_response_code(429);
        $error = 'Demasiados intentos. Espere 15 minutos antes de volver a intentar.';
    } elseif (empty($email) || empty($password)) {
        $error = "Por favor, complete todos los campos.";
    } else {
        $stmt = $pdo->prepare("SELECT u.*, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id WHERE u.email = ?");
        $stmt->execute([$email]);
        $usuario = $stmt->fetch();

        if ($usuario && password_verify($password, $usuario['password'])) {
            session_regenerate_id(true);
            $_SESSION['csrf_token'] = bin2hex(random_bytes(32));
            $_SESSION['auth_version'] = hash('sha256', $usuario['password']);
            $_SESSION['usuario_id'] = $usuario['id'];
            $_SESSION['usuario_nombre'] = $usuario['nombre'];
            $_SESSION['usuario_rol'] = $usuario['rol_nombre'];
            $_SESSION['usuario_rol_id'] = $usuario['rol_id'];
            $loginUpdate=$pdo->prepare('UPDATE usuarios SET ultimo_acceso=NOW() WHERE id=?');$loginUpdate->execute([$usuario['id']]);
            if ($usuario['notificaciones'] && in_array($usuario['rol_nombre'],['Administrador','Técnico'],true)) {
                $late=$pdo->query('SELECT COUNT(*) FROM prestamos WHERE devuelto_en IS NULL AND fecha_devolucion<CURRENT_DATE')->fetchColumn();
                if ($late) $_SESSION['flash']=$late.' préstamos requieren devolución.';
            }

            header("Location: " . BASE_URL . "/modules/dashboard/index.php");
            exit();
        } else {
            $error = "Credenciales incorrectas. Verifique su email y contraseña.";
        }
    }
}
?>
<?php require_once __DIR__ . '/../includes/header.php'; ?>
<?php require_once __DIR__ . '/../includes/navbar.php'; ?>

<div class="row justify-content-center mt-4">
    <div class="col-lg-6 col-xl-5">
        <div class="card shadow">
            <div class="card-header bg-primary text-white text-center">
                <h4><i class="bi bi-person-circle"></i> Iniciar Sesión</h4>
            </div>
            <div class="card-body">
                <?php if($error): ?>
                    <div class="alert alert-danger"><?php echo h($error); ?></div>
                <?php endif; ?>
                <form method="POST" action=""><?php echo csrf_field(); ?>
                    <div class="mb-3">
                        <label for="email" class="form-label">Correo Electrónico</label>
                        <input type="email" class="form-control" id="email" name="email" required autofocus>
                    </div>
                    <div class="mb-3">
                        <label for="password" class="form-label">Contraseña</label>
                        <input type="password" class="form-control" id="password" name="password" required>
                    </div>
                    <div class="d-grid">
                        <button type="submit" class="btn btn-primary">Ingresar al Sistema</button>
                    </div>
                </form>
            </div>
            <div class="card-footer text-center text-muted">
                <small>InventIC &copy; <?php echo date('Y'); ?></small>
            </div>
        </div>
    </div>
</div>

<?php require_once __DIR__ . '/../includes/footer.php'; ?>
