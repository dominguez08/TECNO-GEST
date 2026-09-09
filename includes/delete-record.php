<?php
// Shared deletion endpoint. Tables must be selected by a source-code constant, never request input.
if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') { http_response_code(405); header('Allow: POST'); exit; }
if (($_SESSION['usuario_rol'] ?? '') !== 'Administrador') { http_response_code(403); exit('Acceso denegado.'); }
$id=filter_var($_POST['id']??'',FILTER_VALIDATE_INT,['options'=>['min_range'=>1]]);
if (!$id) { http_response_code(400); exit('Identificador inválido.'); }
if (!in_array($deleteTable,['equipos','ubicaciones','usuarios'],true)) throw new LogicException('Invalid deletion table');
if ($deleteTable==='usuarios' && $id===(int)$_SESSION['usuario_id']) {
    $_SESSION['flash']='No puede eliminar su propia cuenta.';
} else {
    try {
        $stmt=$pdo->prepare("DELETE FROM $deleteTable WHERE id=?"); $stmt->execute([$id]);
        $_SESSION['flash']=$stmt->rowCount()?'Registro eliminado.':'El registro ya no existe.';
    } catch(PDOException $e) {
        $_SESSION['flash']='No se puede eliminar: existen registros asociados. Se ha conservado la información.';
    }
}
header('Location: index.php'); exit;
