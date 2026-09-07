<?php
require_once __DIR__ . '/../../config/database.php';
require_once __DIR__ . '/../../config/config.php';

if (!isset($_SESSION['usuario_id']) || ($_SESSION['usuario_rol'] != 'Administrador' && $_SESSION['usuario_rol'] != 'Técnico')) {
    header("Location: " . BASE_URL . "/modules/dashboard/index.php");
    exit();
}

$stmt = $pdo->query("SELECT * FROM ubicaciones ORDER BY nombre");
$ubicaciones = $stmt->fetchAll();
?>
<?php require_once __DIR__ . '/../../includes/header.php'; ?>
<?php require_once __DIR__ . '/../../includes/navbar.php'; ?>

<div class="d-flex justify-content-between flex-wrap flex-md-nowrap align-items-center pt-3 pb-2 mb-3 border-bottom">
    <h1 class="h2">Gestión de Ubicaciones</h1>
    <div class="btn-toolbar mb-2 mb-md-0">
        <a href="create.php" class="btn btn-sm btn-primary">
            <i class="bi bi-plus-circle"></i> Nueva Ubicación
        </a>
    </div>
</div>

<div class="table-responsive">
    <table class="table table-striped table-hover">
        <thead class="table-dark">
            <tr>
                <th>ID</th>
                <th>Nombre</th>
                <th>Descripción</th>
                <th>Acciones</th>
            </tr>
        </thead>
        <tbody>
            <?php foreach ($ubicaciones as $ubicacion): ?>
            <tr>
                <td><?php echo $ubicacion['id']; ?></td>
                <td><?php echo h($ubicacion['nombre']); ?></td>
                <td><?php echo h($ubicacion['descripcion']); ?></td>
                <td>
                    <a href="edit.php?id=<?php echo $ubicacion['id']; ?>" class="btn btn-sm btn-warning"><i class="bi bi-pencil"></i></a>
                    <!-- Considerar no permitir borrar si hay equipos asociados -->
                    <?php if($_SESSION['usuario_rol']==='Administrador'): ?><form class="d-inline" method="POST" action="delete.php" data-confirm="¿Eliminar este registro? Solo se eliminará si no tiene información asociada."><?php echo csrf_field(); ?><input type="hidden" name="id" value="<?php echo $ubicacion['id']; ?>"><button class="btn btn-sm btn-light text-danger" aria-label="Eliminar <?php echo h($ubicacion['nombre']); ?>"><i class="bi bi-trash"></i></button></form><?php endif; ?>
                </td>
            </tr>
            <?php endforeach; ?>
            <?php if (count($ubicaciones) == 0): ?>
            <tr><td colspan="4" class="text-center">No hay ubicaciones registradas</td></tr>
            <?php endif; ?>
        </tbody>
    </table>
</div>

<?php require_once __DIR__ . '/../../includes/footer.php'; ?>
