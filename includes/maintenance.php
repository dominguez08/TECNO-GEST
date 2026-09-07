<?php
function save_maintenance(PDO $pdo, int $reportId, int $technicianId, int $stateId, string $diagnosis, string $solution): void {
    $pdo->beginTransaction();
    try {
        $q = $pdo->prepare('SELECT equipo_id FROM reportes WHERE id=?'); $q->execute([$reportId]);
        $equipmentId = $q->fetchColumn();
        if (!$equipmentId) throw new DomainException('El reporte ya no existe.');
        // All report/maintenance writers lock the equipment first to serialize its state.
        $q = $pdo->prepare('SELECT id FROM equipos WHERE id=? FOR UPDATE'); $q->execute([$equipmentId]);
        $q = $pdo->prepare('SELECT r.*, e.nombre AS estado_nombre FROM reportes r JOIN estados_reporte e ON e.id=r.estado_id WHERE r.id=? FOR UPDATE'); $q->execute([$reportId]);
        $report = $q->fetch();
        if ($report['estado_nombre'] === 'Cerrado') throw new DomainException('El reporte está cerrado y no puede modificarse.');
        $q = $pdo->prepare('SELECT nombre FROM estados_reporte WHERE id=?'); $q->execute([$stateId]); $state = $q->fetchColumn();
        if (!$state) throw new DomainException('Estado inválido.');
        $finished = in_array($state, ['Reparado','Cerrado'], true);
        if ($finished && trim($solution) === '') throw new DomainException('Indique la solución antes de finalizar.');
        $q = $pdo->prepare('UPDATE reportes SET estado_id=? WHERE id=?'); $q->execute([$stateId,$reportId]);
        $q = $pdo->prepare('SELECT * FROM mantenimientos WHERE reporte_id=? FOR UPDATE'); $q->execute([$reportId]); $maintenance = $q->fetch();
        $end = $finished ? ($maintenance['fecha_fin'] ?? date('Y-m-d H:i:s')) : null;
        if ($maintenance) {
            $q = $pdo->prepare('UPDATE mantenimientos SET diagnostico=?,solucion=?,fecha_fin=? WHERE id=?');
            $q->execute([$diagnosis,$solution,$end,$maintenance['id']]);
        } else {
            $q = $pdo->prepare('INSERT INTO mantenimientos(reporte_id,tecnico_id,diagnostico,solucion,fecha_fin) VALUES (?,?,?,?,?)');
            $q->execute([$reportId,$technicianId,$diagnosis,$solution,$end]);
        }
        $q = $pdo->prepare("SELECT r.id FROM reportes r JOIN estados_reporte s ON s.id=r.estado_id WHERE r.equipo_id=? AND s.nombre NOT IN ('Reparado','Cerrado') FOR UPDATE"); $q->execute([$equipmentId]);
        $equipmentState = $q->fetchColumn() ? 'En Mantenimiento' : 'Activo';
        $q = $pdo->prepare('UPDATE equipos SET estado=? WHERE id=?'); $q->execute([$equipmentState,$equipmentId]);
        $pdo->commit();
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}
function create_report(PDO $pdo, int $equipmentId, int $userId, string $description): int {
    $pdo->beginTransaction();
    try {
        $q = $pdo->prepare('SELECT estado FROM equipos WHERE id=? FOR UPDATE'); $q->execute([$equipmentId]);
        if ($q->fetchColumn() !== 'Activo') throw new DomainException('El equipo ya no está disponible para reportar.');
        $q = $pdo->prepare("SELECT COUNT(*) FROM reportes r JOIN estados_reporte s ON s.id=r.estado_id WHERE equipo_id=? AND s.nombre NOT IN ('Reparado','Cerrado')"); $q->execute([$equipmentId]);
        if ($q->fetchColumn()) throw new DomainException('Este equipo ya tiene un reporte abierto.');
        $state = $pdo->query("SELECT id FROM estados_reporte WHERE nombre='Pendiente'")->fetchColumn();
        if (!$state) throw new DomainException('Falta el estado Pendiente en el catálogo.');
        $q = $pdo->prepare('INSERT INTO reportes(equipo_id,usuario_id,descripcion,estado_id) VALUES (?,?,?,?)'); $q->execute([$equipmentId,$userId,$description,$state]);
        $id = (int)$pdo->lastInsertId();
        $q = $pdo->prepare("UPDATE equipos SET estado='En Mantenimiento' WHERE id=?"); $q->execute([$equipmentId]);
        $pdo->commit(); return $id;
    } catch (Throwable $e) { if ($pdo->inTransaction()) $pdo->rollBack(); throw $e; }
}

