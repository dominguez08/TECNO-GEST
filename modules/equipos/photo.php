<?php
require __DIR__.'/../../includes/app.php';access();
$e=record('SELECT fotografia FROM equipos WHERE id=?',[(int)($_GET['id']??0)]);$name=$e['fotografia']??'';
if(!preg_match('/^[a-f0-9]{40,64}\.(jpg|png|webp)$/',$name)||!is_file(__DIR__.'/../../storage/'.$name)){http_response_code(404);exit;}
header('Content-Type: '.['jpg'=>'image/jpeg','png'=>'image/png','webp'=>'image/webp'][pathinfo($name,PATHINFO_EXTENSION)]);header('X-Content-Type-Options: nosniff');readfile(__DIR__.'/../../storage/'.$name);
