<?php
$current_page = basename($_SERVER['PHP_SELF']);
$current_dir = basename(dirname($_SERVER['PHP_SELF']));
?>
<div id="wrapper">
    <!-- Sidebar -->
    <div id="sidebar-wrapper">
        <a href="<?php echo BASE_URL; ?>/modules/dashboard/index.php" class="sidebar-brand">
            <i class="bi bi-laptop"></i>
            <div>
                TECNO-GEST
                <span>IEP Institucional</span>
            </div>
        </a>

        <?php if(isset($_SESSION['usuario_id'])): ?>
        <div class="list-group list-group-flush mt-3">
            <a href="<?php echo BASE_URL; ?>/modules/dashboard/index.php" class="list-group-item-sidebar <?php echo ($current_dir == 'dashboard') ? 'active' : ''; ?>">
                <i class="bi bi-grid-1x2"></i> Panel
            </a>

            <?php if($_SESSION['usuario_rol'] == 'Administrador' || $_SESSION['usuario_rol'] == 'Técnico'): ?>
            <a href="<?php echo BASE_URL; ?>/modules/equipos/index.php" class="list-group-item-sidebar <?php echo ($current_dir == 'equipos') ? 'active' : ''; ?>">
                <i class="bi bi-pc-display"></i> Inventario
            </a>
            <a href="<?php echo BASE_URL; ?>/modules/mantenimiento/index.php" class="list-group-item-sidebar <?php echo ($current_dir == 'mantenimiento') ? 'active' : ''; ?>">
                <i class="bi bi-tools"></i> Mantenimiento
            </a>
            <a href="<?php echo BASE_URL; ?>/modules/ubicaciones/index.php" class="list-group-item-sidebar <?php echo ($current_dir == 'ubicaciones') ? 'active' : ''; ?>">
                <i class="bi bi-geo-alt"></i> Ubicaciones
            </a>
            <?php endif; ?>

            <div class="sidebar-heading mt-4">GESTIÓN</div>
            <a href="<?php echo BASE_URL; ?>/modules/reportes/index.php" class="list-group-item-sidebar <?php echo ($current_dir == 'reportes') ? 'active' : ''; ?>">
                <i class="bi bi-file-earmark-text"></i> Reportes
            </a>

            <?php if($_SESSION['usuario_rol'] == 'Administrador' || $_SESSION['usuario_rol'] == 'Técnico'): ?>
            <a href="<?php echo BASE_URL; ?>/modules/estadisticas/index.php" class="list-group-item-sidebar <?php echo ($current_dir == 'estadisticas') ? 'active' : ''; ?>">
                <i class="bi bi-bar-chart"></i> Informes
            </a>
            <?php endif; ?>

            <?php if($_SESSION['usuario_rol'] == 'Administrador'): ?>
            <a href="<?php echo BASE_URL; ?>/modules/usuarios/index.php" class="list-group-item-sidebar <?php echo ($current_dir == 'usuarios') ? 'active' : ''; ?>">
                <i class="bi bi-people"></i> Usuarios
            </a>
            <?php endif; ?>
        </div>
        <?php endif; ?>
    </div>

    <!-- Page Content -->
    <div id="page-content-wrapper">
        <?php if(isset($_SESSION['usuario_id'])): ?>
        <div class="top-navbar mb-4"><button class="btn btn-light mobile-menu" type="button" aria-controls="sidebar-wrapper" aria-expanded="false" id="menu-toggle"><i class="bi bi-list" aria-hidden="true"></i> Menú</button>
            <div class="dropdown">
                <a class="nav-link dropdown-toggle text-dark" href="#" role="button" data-bs-toggle="dropdown" aria-expanded="false">
                    <i class="bi bi-person-circle"></i> <?php echo h($_SESSION['usuario_nombre']); ?>
                </a>
                <ul class="dropdown-menu dropdown-menu-end shadow-sm border-0">
                    <li><span class="dropdown-item-text text-muted"><?php echo h($_SESSION['usuario_rol']); ?></span></li>
                    <li><hr class="dropdown-divider"></li>
                    <li><form method="POST" action="<?php echo BASE_URL; ?>/auth/logout.php"><?php echo csrf_field(); ?><button class="dropdown-item text-danger" type="submit"><i class="bi bi-box-arrow-right"></i> Cerrar sesión</button></form></li>
                </ul>
            </div>
        </div>
        <?php endif; ?>
        <main class="p-content" id="main-content"><?php if(isset($_SESSION['flash'])): ?><div class="alert alert-info" role="status"><?php echo h($_SESSION['flash']); unset($_SESSION['flash']); ?></div><?php endif; ?>
