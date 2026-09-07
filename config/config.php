<?php
if (PHP_SAPI !== 'cli' && session_status() === PHP_SESSION_NONE) {
    ini_set('session.use_strict_mode', '1');
    session_set_cookie_params(['httponly' => true, 'secure' => !empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite' => 'Lax', 'path' => '/']);
    session_start();
}
$script = str_replace('\\', '/', $_SERVER['SCRIPT_NAME'] ?? '');
$base = preg_replace('~/(?:modules/[^/]+|auth)/[^/]+$~', '', $script);
if ($base === $script) $base = rtrim(dirname($script), '/.');
define('BASE_URL', getenv('APP_BASE_URL') !== false ? rtrim(getenv('APP_BASE_URL'), '/') : $base);
function h($value) { return htmlspecialchars((string)($value ?? ''), ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8'); }
function csrf_field() { return '<input type="hidden" name="csrf_token" value="' . h($_SESSION['csrf_token']) . '">'; }
$_SESSION['csrf_token'] = $_SESSION['csrf_token'] ?? bin2hex(random_bytes(32));
if (PHP_SAPI !== 'cli') {
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: DENY');
    header('Referrer-Policy: same-origin');
    header('Cache-Control: no-store');
    if (isset($_SESSION['usuario_id']) && time() - ($_SESSION['last_activity'] ?? time()) > 1800) {
        session_unset(); session_regenerate_id(true);
        header('Location: ' . BASE_URL . '/auth/login.php'); exit;
    }
    $_SESSION['last_activity'] = time();
    foreach ([$_GET, $_POST] as $input) foreach ($input as $value) {
        if (!is_string($value)) { http_response_code(400); exit('Solicitud inválida.'); }
    }
    if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST' && !hash_equals($_SESSION['csrf_token'], $_POST['csrf_token'] ?? '')) {
        http_response_code(403); exit('El formulario ha caducado. Recargue la página e intente nuevamente.');
    }
    foreach (['id', 'reporte_id', 'equipo_id'] as $key) {
        if (isset($_GET[$key]) && !filter_var($_GET[$key], FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]])) {
            http_response_code(400); exit('Identificador inválido.');
        }
    }
}
set_exception_handler(function ($e) {
    if (PHP_SAPI === 'cli') { fwrite(STDERR, $e->getMessage() . PHP_EOL); exit(1); }
    error_log('TECNO-GEST: ' . get_class($e) . ' (' . $e->getCode() . ')');
    http_response_code(500);
    echo 'No fue posible completar la operación. Inténtelo nuevamente o contacte al administrador.';
});
require_once __DIR__ . '/../includes/validation.php';
