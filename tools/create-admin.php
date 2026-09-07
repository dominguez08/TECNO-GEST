<?php
if (PHP_SAPI !== 'cli') { http_response_code(404); exit; }
require __DIR__ . '/../config/database.php';
$email = getenv('ADMIN_EMAIL'); $password = getenv('ADMIN_PASSWORD');
if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password ?: '') < 12 || strlen($password) > 72) exit("Set ADMIN_EMAIL and ADMIN_PASSWORD (12-72 bytes) in your environment.\n");
$q = $pdo->prepare("INSERT INTO usuarios(nombre,email,password,rol_id) SELECT 'Administrador',?,?,id FROM roles WHERE nombre='Administrador'");
$q->execute([$email,password_hash($password,PASSWORD_DEFAULT)]);
echo "Administrator created.\n";
