<?php
require_once __DIR__ . '/config.php';
$local = is_file(__DIR__ . '/local.php') ? require __DIR__ . '/local.php' : [];
function db_setting($key, $default = '') {
    global $local;
    $value = getenv($key);
    return $value !== false ? $value : ($local[$key] ?? $default);
}
try {
    $pdo = new PDO('mysql:host=' . db_setting('DB_HOST', 'localhost') . ';port=' . db_setting('DB_PORT', '3306') . ';dbname=' . db_setting('DB_NAME', 'tecnogest') . ';charset=utf8mb4', db_setting('DB_USER'), db_setting('DB_PASS'), [
        PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
        PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        PDO::ATTR_EMULATE_PREPARES => false,
    ]);
} catch (PDOException $e) {
    error_log('TECNO-GEST: database connection failed (' . $e->getCode() . ')');
    http_response_code(503);
    exit('No se pudo conectar con la base de datos. Revise la configuración local del servidor.');
}
if (PHP_SAPI !== 'cli' && isset($_SESSION['usuario_id'])) {
    $sessionUser = $pdo->prepare('SELECT u.nombre, u.rol_id, u.password, r.nombre AS rol FROM usuarios u JOIN roles r ON r.id=u.rol_id WHERE u.id=?');
    $sessionUser->execute([$_SESSION['usuario_id']]);
    $currentUser = $sessionUser->fetch();
    if (!$currentUser || (isset($_SESSION['auth_version']) && !hash_equals($_SESSION['auth_version'], hash('sha256', $currentUser['password']))) || !in_array($currentUser['rol'], ['Administrador', 'Técnico', 'Docente'], true)) {
        session_unset();
        header('Location: ' . BASE_URL . '/auth/login.php'); exit;
    }
    $_SESSION['usuario_nombre'] = $currentUser['nombre'];
    $_SESSION['usuario_rol'] = $currentUser['rol'];
    $_SESSION['usuario_rol_id'] = $currentUser['rol_id'];
}
