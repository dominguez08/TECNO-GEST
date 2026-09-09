<?php
function validate_form(PDO $pdo, string $module): string {
    $required = ['equipos'=>['codigo','tipo_id','ubicacion_id','estado'], 'ubicaciones'=>['nombre'], 'usuarios'=>['nombre','email','rol_id'], 'reportes'=>['equipo_id','descripcion'], 'mantenimiento'=>['estado_id']];
    foreach ($required[$module] ?? [] as $field) if (trim($_POST[$field] ?? '') === '') return 'Complete todos los campos obligatorios.';
    if ($module === 'usuarios' && basename($_SERVER['SCRIPT_NAME'] ?? '') === 'create.php' && empty($_POST['password'])) return 'La contraseña es obligatoria.';
    foreach (['marca','modelo','numero_serie','descripcion','diagnostico','solucion','password'] as $field) $_POST[$field] = $_POST[$field] ?? '';
    $limits = ['nombre'=>100, 'email'=>100, 'codigo'=>50, 'marca'=>50, 'modelo'=>50, 'numero_serie'=>100, 'descripcion'=>16000, 'diagnostico'=>16000, 'solucion'=>16000];
    foreach ($limits as $field=>$limit) if (isset($_POST[$field]) && mb_strlen($_POST[$field], 'UTF-8') > $limit) return "El campo $field excede el máximo de $limit caracteres.";
    if (isset($_POST['email']) && !filter_var($_POST['email'], FILTER_VALIDATE_EMAIL)) return 'El correo electrónico no es válido.';
    if ($module === 'usuarios' && !empty($_POST['password']) && (strlen($_POST['password']) < 12 || strlen($_POST['password']) > 72)) return 'Use una contraseña de entre 12 y 72 bytes.';
    if (isset($_POST['estado']) && !in_array($_POST['estado'], ['Activo','Inactivo','En Mantenimiento'], true)) return 'Estado de equipo inválido.';
    foreach (['tipo_id'=>'tipos_equipo','ubicacion_id'=>'ubicaciones','rol_id'=>'roles','equipo_id'=>'equipos','estado_id'=>'estados_reporte'] as $field=>$table) {
        if (!isset($_POST[$field])) continue;
        if (!filter_var($_POST[$field], FILTER_VALIDATE_INT, ['options'=>['min_range'=>1]])) return 'Seleccione una opción válida.';
        $stmt = $pdo->prepare("SELECT id FROM $table WHERE id=?");
        $stmt->execute([$_POST[$field]]);
        if (!$stmt->fetchColumn()) return 'La opción seleccionada ya no existe.';
    }
    if ($module === 'usuarios' && isset($_GET['id']) && (int)$_GET['id'] === (int)$_SESSION['usuario_id'] && (int)$_POST['rol_id'] !== (int)$_SESSION['usuario_rol_id']) return 'No puede quitarse su propio rol de administrador.';
    if ($module === 'ubicaciones' && !empty($_POST['nombre'])) {
        $stmt = $pdo->prepare('SELECT id FROM ubicaciones WHERE nombre=? AND id<>?');
        $stmt->execute([trim($_POST['nombre']), $_GET['id'] ?? 0]);
        if ($stmt->fetchColumn()) return 'Ya existe una ubicación con ese nombre.';
    }
    return '';
}
