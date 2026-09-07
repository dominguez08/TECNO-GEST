<?php
function equipment_stats(PDO $pdo): array {
    return $pdo->query("SELECT COUNT(*) AS total, COALESCE(SUM(estado='Activo'),0) AS active, COALESCE(SUM(estado='Inactivo'),0) AS inactive, COALESCE(SUM(estado='En Mantenimiento'),0) AS maintenance FROM equipos")->fetch();
}
