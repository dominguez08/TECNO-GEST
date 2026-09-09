<?php
function create_loan(PDO $pdo,int $equipment,int $borrower,int $operator,string $start,string $due,string $notes=''): int {
    foreach([$start,$due] as $date) { $d=DateTimeImmutable::createFromFormat('!Y-m-d',$date);if(!$d||$d->format('Y-m-d')!==$date)throw new DomainException('Las fechas no son válidas.'); }
    if($due<$start || $start>date('Y-m-d'))throw new DomainException('Revise las fechas del préstamo y la devolución.');
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare('SELECT estado FROM equipos WHERE id=? FOR UPDATE');$q->execute([$equipment]);
        if($q->fetchColumn()!=='Activo')throw new DomainException('El equipo no está disponible.');
        $q=$pdo->prepare('SELECT id FROM prestamos WHERE equipo_id=? AND devuelto_en IS NULL FOR UPDATE');$q->execute([$equipment]);
        if($q->fetchColumn())throw new DomainException('El equipo ya tiene un préstamo activo.');
        $q=$pdo->prepare("SELECT r.id FROM reportes r JOIN estados_reporte s ON s.id=r.estado_id WHERE r.equipo_id=? AND s.nombre NOT IN ('Reparado','Cerrado') FOR UPDATE");$q->execute([$equipment]);
        if($q->fetchColumn())throw new DomainException('El equipo tiene fallas pendientes.');
        $q=$pdo->prepare('SELECT id FROM usuarios WHERE id=?');$q->execute([$borrower]);if(!$q->fetchColumn())throw new DomainException('Seleccione un usuario existente.');
        $q=$pdo->prepare('INSERT INTO prestamos(equipo_id,usuario_id,registrado_por,fecha_prestamo,fecha_devolucion,observaciones) VALUES (?,?,?,?,?,?)');$q->execute([$equipment,$borrower,$operator,$start,$due,$notes]);
        $id=(int)$pdo->lastInsertId();
        $q=$pdo->prepare("INSERT INTO actividad(usuario_id,equipo_id,descripcion) VALUES (?,?,'Registró un préstamo de equipo')");$q->execute([$operator,$equipment]);
        $pdo->commit();return $id;
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
function return_loan(PDO $pdo,int $id,int $operator): void {
    $pdo->beginTransaction();
    try {
        $q=$pdo->prepare('SELECT equipo_id FROM prestamos WHERE id=?');$q->execute([$id]);$equipment=$q->fetchColumn();if(!$equipment)throw new DomainException('Préstamo no encontrado.');
        $q=$pdo->prepare('SELECT id FROM equipos WHERE id=? FOR UPDATE');$q->execute([$equipment]);
        $q=$pdo->prepare('SELECT devuelto_en FROM prestamos WHERE id=? FOR UPDATE');$q->execute([$id]);if($q->fetchColumn()!==null)throw new DomainException('El préstamo ya fue devuelto.');
        $q=$pdo->prepare('UPDATE prestamos SET devuelto_en=NOW() WHERE id=?');$q->execute([$id]);
        $q=$pdo->prepare("INSERT INTO actividad(usuario_id,equipo_id,descripcion) VALUES (?,?,'Registró la devolución de un equipo')");$q->execute([$operator,$equipment]);
        $pdo->commit();
    }catch(Throwable $e){if($pdo->inTransaction())$pdo->rollBack();throw $e;}
}
