<?php
require_once __DIR__ . '/../config/config.php';
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); header('Allow: POST'); exit('Use el botón Cerrar sesión.'); }
session_unset();
setcookie(session_name(), '', ['expires'=>time()-42000, 'path'=>'/', 'httponly'=>true, 'secure'=>!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off', 'samesite'=>'Lax']);
session_destroy();
header('Location: ' . BASE_URL . '/auth/login.php'); exit;
