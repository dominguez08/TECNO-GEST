<?php
if(PHP_SAPI!=='cli'){http_response_code(404);exit;}
require __DIR__.'/../config/database.php';
require __DIR__.'/../includes/schema.php';
$file=__DIR__.'/../storage/backup-interface-'.date('Ymd-His').'.sql';
if(file_put_contents($file,backup_database($pdo))===false) throw new RuntimeException('Backup failed');
migrate_interface($pdo);
echo "Interface schema migrated; private backup created.\n";
