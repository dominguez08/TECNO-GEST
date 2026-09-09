<?php
/**
 * Importa el inventario entregado con sus fotografías, sin duplicar equipos.
 * Uso: php tools/import-supplied-inventory.php "C:\ruta\a\Imagenes"
 */
require_once __DIR__ . '/../config/database.php';

$imagesDir = $argv[1] ?? '';
if ($imagesDir === '' || !is_dir($imagesDir)) {
    fwrite(STDERR, "Uso: php tools/import-supplied-inventory.php \"C:\\ruta\\a\\Imagenes\"\n");
    exit(1);
}

function id_for(PDO $pdo, string $table, string $name): ?int {
    $query = $pdo->prepare("SELECT id FROM {$table} WHERE nombre=? LIMIT 1");
    $query->execute([$name]);
    $id = $query->fetchColumn();
    return $id === false ? null : (int)$id;
}
function ensure_named(PDO $pdo, string $table, string $name): int {
    $id = id_for($pdo, $table, $name);
    if ($id !== null) return $id;
    $pdo->prepare("INSERT INTO {$table}(nombre) VALUES (?)")->execute([$name]);
    return (int)$pdo->lastInsertId();
}
function ensure_location(PDO $pdo, int $siteId, string $name, string $type): int {
    $query = $pdo->prepare('SELECT id FROM ubicaciones WHERE nombre=? LIMIT 1');
    $query->execute([$name]);
    $id = $query->fetchColumn();
    if ($id !== false) return (int)$id;
    $pdo->prepare('INSERT INTO ubicaciones(nombre,descripcion,sede_id,tipo) VALUES (?,?,?,?)')
        ->execute([$name, 'Ubicación creada para el inventario inicial de InventIC-IEP San Rafael.', $siteId, $type]);
    return (int)$pdo->lastInsertId();
}
function store_photo(string $source, string $storage, string $code): ?string {
    if (!is_file($source)) return null;
    $extension = strtolower(pathinfo($source, PATHINFO_EXTENSION));
    if ($extension === 'gif') {
        if (!function_exists('imagecreatefromgif')) throw new RuntimeException('Se requiere GD para convertir la fotografía GIF del teclado.');
        $image = imagecreatefromgif($source);
        if (!$image) throw new RuntimeException('No se pudo leer la fotografía GIF: ' . basename($source));
        $extension = 'png';
        $filename = hash('sha256', $code . hash_file('sha256', $source)) . '.png';
        if (!imagepng($image, $storage . DIRECTORY_SEPARATOR . $filename, 7)) throw new RuntimeException('No se pudo guardar la fotografía del teclado.');
        imagedestroy($image);
        return $filename;
    }
    if (!in_array($extension, ['jpg', 'jpeg', 'png', 'webp'], true)) return null;
    $filename = hash('sha256', $code . hash_file('sha256', $source)) . '.' . ($extension === 'jpeg' ? 'jpg' : $extension);
    $destination = $storage . DIRECTORY_SEPARATOR . $filename;
    if (!is_file($destination) && !copy($source, $destination)) throw new RuntimeException('No se pudo copiar ' . basename($source));
    return $filename;
}

$items = [
    ['TEC-2026-LAP-001','Laptop ASUS Vivobook 15','Laptop','ASUS','Vivobook 15 X1504VAP-C38128','UPC 199291324404','1.jpg','Activo','Aula 1','Intel Core 3 100U; 8 GB RAM; SSD 128 GB; FHD 15.6; Windows 11 Home; teclado US; azul sereno.'],
    ['TEC-2026-LAP-002','Laptop Acer Aspire Go 15','Laptop','Acer','Aspire Go 15 AG15-42P-R917','UPC 195133336888','2.png','Activo','Laboratorio de Informática','AMD Ryzen 7 7730U; 16 GB DDR4; SSD 512 GB; FHD 15.6; Windows 11 Home; silver; teclado US.'],
    ['TEC-2026-LAP-003','Laptop ASUS Vivobook','Laptop','ASUS','Vivobook E1504GA-WS35','UPC 197105808058','3.png','En Mantenimiento','Biblioteca','Intel Core i3-N305; 8 GB DDR4; SSD 256 GB; FHD 15.6; Windows 11 Home Single; plateado; teclado US.'],
    ['TEC-2026-LAP-004','Laptop ASUS Vivobook 14','Laptop','ASUS','X1404VA-V14','UPC 199291148536','4.png','Activo','Aula 2','Intel Core i3-1315U; 8 GB DDR4; SSD 128 GB; FHD 14; WiFi y Bluetooth; Windows 11 Home; quiet blue.'],
    ['TEC-2026-LAP-005','Laptop HP OmniBook 3','Laptop','HP','OmniBook 3 16-BZ0010WM','UPC 199764338266','5.jpg','Inactivo','Administración','Snapdragon X X1-26-100; 16 GB DDR5; SSD 512 GB; IPS 2K 16; Windows 11 Home; negro; CQ1M7UA.'],
    ['TEC-2026-IMP-001','Impresora multifuncional Epson','Impresora','Epson','L3250','SKU 1306000051','I1.jpg','Activo','Administración','Tanque de tinta. Imprime, copia y escanea.'],
    ['TEC-2026-IMP-002','Impresora multifuncional HP','Impresora','HP','Smart Tank 790','SKU 1306000041','I2.jpg','En Mantenimiento','Sala de Maestros','Tanque de tinta. Imprime, copia y escanea.'],
    ['TEC-2026-IMP-003','Impresora multifuncional Epson','Impresora','Epson','WorkForce Pro WF-C5810','SKU 1306000024','I3.jpg','Activo','Laboratorio de Informática','Imprime, copia y escanea.'],
    ['TEC-2026-IMP-004','Impresora multifuncional Brother','Impresora','Brother','DCP-L2640DW','SKU 1306000121','I4.jpg','Activo','Biblioteca','Impresora multifuncional láser.'],
    ['TEC-2026-PRO-001','Proyector multimedia Steren','Proyector','Steren','PRO-550','PRO-550','P1.jpg','Activo','Aula 1','Full HD, 600 ANSI lm y función espejo.'],
    ['TEC-2026-PRO-002','Proyector multimedia Steren','Proyector','Steren','PRO-6000','PRO-6000','P2.jpg','En Mantenimiento','Aula 2','Home Theater Full HD, 650 ANSI lm, función espejo, enfoque y trapecio automáticos; sistema óptico sellado.'],
    ['TEC-2026-PRO-003','Proyector multimedia Steren','Proyector','Steren','PRO-8000','PRO-8000','P3.jpg','Activo','Sala de Maestros','Home Theater Full HD, 1100 ANSI lm, función espejo, enfoque y trapecio automáticos.'],
    ['TEC-2026-PAN-001','Pantalla para proyector','Pantalla','Steren','PRO-014','PRO-014','PP1.jpg','Activo','Aula 1','Pantalla para proyector de 84 pulgadas con tripié.'],
    ['TEC-2026-MON-001','Monitor MSI 22 pulgadas','Monitor','MSI','PRO MP225 E12VL','9S6-3PE0CM-024','M1.jpg','Activo','Laboratorio de Informática','FHD 1920x1080, 120 Hz, HDMI y VGA. Referencia SKU 824142447697.'],
    ['TEC-2026-MON-002','Monitor MSI 24 pulgadas','Monitor','MSI','MP242 E14A','9S6-3PD1CT-014','M2.jpg','Activo','Laboratorio de Informática','FHD 1920x1080, 144 Hz.'],
    ['TEC-2026-MON-003','Monitor MSI 24 pulgadas','Monitor','MSI','MP242 E14A','9S6-3PD1CT-014-2','M3.jpg','En Mantenimiento','Laboratorio de Informática','FHD 1920x1080, 144 Hz.'],
    ['TEC-2026-MON-004','Monitor MSI 24 pulgadas','Monitor','MSI','MP242 E14A','REF M4','M4.jpg','Activo','Sala de Maestros','FHD 1920x1080, 144 Hz. Referencia visual M4; el documento no indica serie individual.'],
    ['TEC-2026-MON-005','Monitor MSI 27 pulgadas','Monitor','MSI','PRO MP271 E14A','MP271-E14A','M5.jpg','Inactivo','Administración','FHD 1920x1080, 144 Hz.'],
    ['TEC-2026-CPU-001','Mini CPU AON Nano W3','Computadora de Escritorio','AON','Nano W3 Core i3-1115G4','AO-NU-1003','PC1.jpg','Activo','Laboratorio de Informática','8 GB RAM, SSD 512 GB y Windows 11.'],
    ['TEC-2026-CPU-002','Mini CPU AON Nano W5','Computadora de Escritorio','AON','Nano W5 Core i5-1135G7','AO-NU-1004','PC2.jpg','Activo','Sala de Maestros','8 GB RAM, SSD 512 GB y Windows 11. SKU 810098152488.'],
    ['TEC-2026-CPU-003','PC Max AMD Athlon','Computadora de Escritorio','AON','PC Max AMD Athlon 3000G','SKU 810098152501','PC3.jpg','En Mantenimiento','Administración','8 GB RAM, SSD 256 GB, Windows 11 Pro, case con fuente, teclado y mouse AON.'],
    ['TEC-2026-ACC-001','Teclado Logitech español','Accesorio','Logitech','K120','SKU 1303000057','T1.gif','Activo','Laboratorio de Informática','Teclado español Logitech K120, referencia 920-004422.'],
    ['TEC-2026-ACC-002','Mouse Argom USB','Accesorio','Argom Tech','ARG-MS-0014B','SKU 1303000146','MS1.jpg','Activo','Laboratorio de Informática','Mouse USB alámbrico negro.'],
];

$loanCodes = [
    'TEC-2026-LAP-001' => ['2026-09-01', '2026-09-08'],
    'TEC-2026-LAP-004' => ['2026-09-03', '2026-09-16'],
    'TEC-2026-IMP-003' => ['2026-09-02', '2026-09-13'],
    'TEC-2026-PRO-003' => ['2026-09-05', '2026-09-18'],
    'TEC-2026-MON-002' => ['2026-09-04', '2026-09-15'],
    'TEC-2026-CPU-002' => ['2026-09-06', '2026-09-20'],
];
$maintenance = [
    'TEC-2026-LAP-003' => ['En reparación', 'Revisión de carga y respuesta del sistema.'],
    'TEC-2026-IMP-002' => ['Pendiente', 'Revisión de alimentación de papel y calidad de impresión.'],
    'TEC-2026-PRO-002' => ['En reparación', 'Revisión de enfoque automático y salida de imagen.'],
    'TEC-2026-MON-003' => ['Pendiente', 'Revisión de imagen intermitente.'],
    'TEC-2026-CPU-003' => ['En reparación', 'Diagnóstico de encendido y rendimiento.'],
];

$storage = realpath(__DIR__ . '/../storage');
if ($storage === false || !is_writable($storage)) throw new RuntimeException('storage/ debe existir y permitir escritura.');
$pdo->beginTransaction();
try {
    $siteId = id_for($pdo, 'sedes', 'Sede San Rafael');
    if ($siteId === null) { $pdo->prepare('INSERT INTO sedes(nombre) VALUES (?)')->execute(['Sede San Rafael']); $siteId = (int)$pdo->lastInsertId(); }
    $locations = [];
    foreach ([['Laboratorio de Informática','Laboratorio'],['Aula 1','Aula'],['Aula 2','Aula'],['Biblioteca','Biblioteca'],['Sala de Maestros','Administración'],['Administración','Administración']] as [$name,$type]) $locations[$name] = ensure_location($pdo, $siteId, $name, $type);
    $operator = (int)$pdo->query("SELECT id FROM usuarios WHERE rol_id=(SELECT id FROM roles WHERE nombre='Administrador' LIMIT 1) ORDER BY id LIMIT 1")->fetchColumn();
    if (!$operator) throw new RuntimeException('Debe existir al menos un usuario administrador antes de importar.');
    $types = [];
    foreach (array_unique(array_column($items, 2)) as $type) $types[$type] = ensure_named($pdo, 'tipos_equipo', $type);
    $insert = $pdo->prepare('INSERT INTO equipos(codigo,tipo_id,marca,modelo,numero_serie,ubicacion_id,estado,nombre,responsable_id,fecha_adquisicion,precio,proveedor,observaciones,fotografia) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
    $find = $pdo->prepare('SELECT id FROM equipos WHERE codigo=?');
    $imported = [];
    foreach ($items as [$code,$name,$type,$brand,$model,$reference,$image,$state,$location,$details]) {
        $find->execute([$code]);
        if ($find->fetchColumn()) { echo "Omitido (ya existe): {$code}\n"; continue; }
        $photo = store_photo($imagesDir . DIRECTORY_SEPARATOR . $image, $storage, $code);
        $observations = $details . ' Referencia de inventario documentada: ' . $reference . '. El documento fuente no aporta número de serie físico individual.';
        $insert->execute([$code,$types[$type],$brand,$model,$reference,$locations[$location],$state,$name,$operator,'2026-09-01',null,'Registro institucional',$observations,$photo]);
        $imported[$code] = (int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO actividad(usuario_id,equipo_id,descripcion) VALUES (?,?,?)')->execute([$operator,$imported[$code],'Importó equipo desde inventario institucional']);
        echo "Importado: {$code}\n";
    }
    $stateIds = [];
    foreach (['Pendiente','En reparación'] as $state) $stateIds[$state] = ensure_named($pdo, 'estados_reporte', $state);
    foreach ($maintenance as $code => [$state,$description]) {
        if (!isset($imported[$code])) continue;
        $report = $pdo->prepare('INSERT INTO reportes(equipo_id,usuario_id,descripcion,estado_id) VALUES (?,?,?,?)');
        $report->execute([$imported[$code],$operator,'Mantenimiento inicial: '.$description,$stateIds[$state]]);
        $reportId = (int)$pdo->lastInsertId();
        $pdo->prepare('INSERT INTO mantenimientos(reporte_id,tecnico_id,diagnostico,solucion) VALUES (?,?,?,NULL)')->execute([$reportId,$operator,$description]);
    }
    foreach ($loanCodes as $code => [$start,$due]) {
        if (!isset($imported[$code])) continue;
        $pdo->prepare('INSERT INTO prestamos(equipo_id,usuario_id,registrado_por,fecha_prestamo,fecha_devolucion,observaciones) VALUES (?,?,?,?,?,?)')
            ->execute([$imported[$code],$operator,$operator,$start,$due,'Préstamo inicial de demostración para seguimiento institucional.']);
    }
    $pdo->commit();
    echo 'Importación terminada. Equipos nuevos: '.count($imported)."\n";
} catch (Throwable $e) {
    if ($pdo->inTransaction()) $pdo->rollBack();
    throw $e;
}
