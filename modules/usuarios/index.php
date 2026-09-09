<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || $_SESSION['usuario_rol'] != 'Administrador') {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$stmt = $pdo->query("SELECT u.*, r.nombre as rol_nombre FROM usuarios u JOIN roles r ON u.rol_id = r.id ORDER BY u.nombre");
$usuarios = $stmt->fetchAll();
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Gestión de Usuarios</h1>
    <div class="btn-toolbar mb-2 mb-md-0">
        <a href="create.php" class="btn btn-sm btn-primary">
            <i class="bi bi-person-plus"></i> Nuevo Usuario
        </a>
    </div>
</div>

<div class="table-responsive">
    <table class="table table-striped table-hover">
        <thead class="table-dark">
            <tr>
                <th>Nombre</th>
                <th>Correo Electrónico</th>
                <th>Rol</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($usuarios as $u): ?>
            <tr>
                <td><?php echo h($u['nombre']); ?></td>
                <td><?php echo h($u['email']); ?></td>
                <td><span class="badge bg-secondary"><?php echo h($u['rol_nombre']); ?></span></td>
                <td>
                    <a href="edit.php?id=<?php echo $u['id']; ?>" class="btn btn-sm btn-warning" title="Editar"><i class="bi bi-pencil"></i></a>
                    <?php if($_SESSION['usuario_rol']==='Administrador'): ?><form class="d-inline" method="POST" action="delete.php" data-confirm="¿Eliminar este registro? Solo se eliminará si no tiene información asociada."><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo $u['id']; ?>"><button class="btn btn-sm btn-light text-danger" aria-label="Eliminar <?php echo h($u['nombre']); ?>"><i class="bi bi-trash"></i></button></form><?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
        </tbody>
    </table>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
