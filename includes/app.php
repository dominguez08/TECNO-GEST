<?php
require_once __DIR__.'/../config/database.php';
function access(bool $staff = true): void {
    if(!isset($_SESSION['usuario_id'])) {header('Location: '.BASE_URL.'/auth/login.php');exit;}
    if($staff && !in_array($_SESSION['usuario_rol'],['Administrador','Técnico'],true)){http_response_code(403);exit('Acceso denegado.');}
}
function admin_access(): void {access();if($_SESSION['usuario_rol']!=='Administrador'){http_response_code(403);exit('Acceso denegado.');}}
function rows(string $sql,array $params=[]): array {global $pdo;$q=$pdo->prepare($sql);$q->execute($params);return $q->fetchAll();}
function record(string $sql,array $params=[]): array {return rows($sql,$params)[0]??[];}
function execute_sql(string $sql,array $params=[]): void {global $pdo;$q=$pdo->prepare($sql);$q->execute($params);}
function redirect_to(string $url,string $message=''): void {if($message!=='')$_SESSION['flash']=$message;header('Location: '.$url);exit;}
function activity(PDO $db,string $message,?int $equipment=null): void {$q=$db->prepare('INSERT INTO actividad(usuario_id,equipo_id,descripcion) VALUES (?,?,?)');$q->execute([$_SESSION['usuario_id']??null,$equipment,mb_substr($message,0,255)]);}
function page_start(string $title,string $subtitle='',string $actions=''): void {
    $GLOBALS['page_title']=$title;
    require __DIR__.'/header.php';require __DIR__.'/navbar.php';
    echo '<div class="page-title-box"><div><h1 class="page-title">'.h($title).'</h1><p class="page-subtitle">'.h($subtitle).'</p></div><div class="page-actions">'.$actions.'</div></div>';
}
function page_end(): void {require __DIR__.'/footer.php';}
function button_link(string $url,string $text,string $icon='plus-lg',string $class='btn-dark-blue'): string {return '<a class="btn '.h($class).'" href="'.h($url).'"><i class="bi bi-'.h($icon).'"></i> '.h($text).'</a>';}
function badge(string $state): string {
    $colors=['Activo'=>'green','Disponible'=>'green','Devuelto'=>'green','Completado'=>'green','Reparado'=>'green','Cerrado'=>'green','Prestado'=>'amber','Pendiente'=>'amber','Inactivo'=>'gray','Atrasado'=>'red','En Mantenimiento'=>'red','En reparación'=>'blue','En revisión'=>'blue'];
    return '<span class="status-badge tone-'.($colors[$state]??'gray').'">'.h($state==='Activo'?'Disponible':$state).'</span>';
}
function stats_cards(array $cards): void {echo '<div class="metric-grid">';foreach($cards as [$value,$label,$color,$icon])echo '<div class="metric-card tone-'.h($color).'"><strong>'.h($value).'</strong><span>'.h($label).'</span><i class="bi bi-'.h($icon).'"></i></div>';echo '</div>';}
function field(string $name,string $label,$value='',string $type='text',bool $required=false): void {echo '<div class="field"><label for="'.h($name).'">'.h($label).'</label><input class="form-control" id="'.h($name).'" name="'.h($name).'" type="'.h($type).'" value="'.h($value).'" '.($required?'required':'').($type==='number'?' min="0" step="0.01"':'').'></div>';}
function select_field(string $name,string $label,array $options,$value='',bool $required=false): void {echo '<div class="field"><label for="'.h($name).'">'.h($label).'</label><select class="form-select" id="'.h($name).'" name="'.h($name).'" '.($required?'required':'').'><option value="">Seleccionar</option>';foreach($options as $option)echo '<option value="'.h($option['id']).'" '.((string)$value===(string)$option['id']?'selected':'').'>'.h($option['nombre']).'</option>';echo '</select></div>';}
function empty_row(int $columns,string $message='No hay registros para mostrar.'): void {echo '<tr><td colspan="'.$columns.'" class="empty-state"><i class="bi bi-inbox"></i><span>'.h($message).'</span></td></tr>';}
function filter_tabs(array $labels,string $active): void {echo '<nav class="filter-tabs"><span>FILTRAR</span>';foreach($labels as $label){$url='?'.http_build_query(array_merge($_GET,['estado'=>$label,'page'=>1]));echo '<a class="filter-pill '.($active===$label?'active':'').'" href="'.h($url).'">'.h($label).'</a>';}echo '</nav>';}
function pagination(int $total,int $page,int $size=20): void {$pages=max(1,(int)ceil($total/$size));echo '<nav class="pagination-bar"><span>'.$total.' resultados · Página '.$page.' de '.$pages.'</span>';foreach([$page-1=>'Anterior',$page+1=>'Siguiente'] as $p=>$label)if($p>0&&$p<=$pages)echo '<a class="btn btn-light btn-sm" href="?'.h(http_build_query(array_merge($_GET,['page'=>$p]))).'">'.$label.'</a>';echo '</nav>';}
function equipment_from(): string {return " FROM equipos e JOIN tipos_equipo t ON t.id=e.tipo_id JOIN ubicaciones u ON u.id=e.ubicacion_id LEFT JOIN sedes s ON s.id=u.sede_id LEFT JOIN usuarios r ON r.id=e.responsable_id LEFT JOIN prestamos p ON p.equipo_id=e.id AND p.devuelto_en IS NULL LEFT JOIN usuarios b ON b.id=p.usuario_id ";}
function equipment_status_sql(): string {return "CASE WHEN e.estado='En Mantenimiento' THEN 'En Mantenimiento' WHEN p.id IS NOT NULL THEN 'Prestado' ELSE e.estado END";}
function inventory_counts(int $site=0): array {$where=$site?' WHERE u.sede_id=?':'';return record("SELECT COUNT(*) total,COALESCE(SUM(e.estado='Activo' AND p.id IS NULL),0) active,COALESCE(SUM(p.id IS NOT NULL),0) loaned,COALESCE(SUM(e.estado='En Mantenimiento'),0) maintenance,COALESCE(SUM(e.estado='Inactivo'),0) inactive".equipment_from().$where,$site?[$site]:[]);}
function inventory_cards(array $c): void {stats_cards([[$c['total'],'Equipos totales','purple','people'],[$c['active'],'Disponibles','green','plus-circle-fill'],[$c['loaned'],'En préstamo','amber','hand-index-thumb-fill'],[$c['maintenance'],'En mantenimiento','red','tools']]);}
function bar_chart(array $data,string $label='nombre',string $value='total'): void {$max=max(1,...array_map(fn($r)=>(int)$r[$value],$data));echo '<div class="bar-chart">';foreach($data as $i=>$item)echo '<div class="bar-row"><span>'.h($item[$label]).'</span><div><b style="width:'.max(0,100*$item[$value]/$max).'%;--bar:'.(['#4a9eff','#67cffa','#899bec','#a191e4'][$i%4]).'"></b></div><strong>'.h($item[$value]).'</strong></div>';if(!$data)echo '<p class="text-muted">Sin datos todavía.</p>';echo '</div>';}
function donut(array $c): void {$total=max(1,(int)$c['total']);$a=round($c['active']/$total*100,2);$b=$a+round($c['loaned']/$total*100,2);$d=$b+round($c['maintenance']/$total*100,2);echo '<div class="donut-layout"><div class="donut" role="img" aria-label="Estado de '.$c['total'].' equipos" style="background:conic-gradient(#50b995 0 '.$a.'%,#ffb64d '.$a.'% '.$b.'%,#ee6b80 '.$b.'% '.$d.'%,#bdc7d8 '.$d.'% 100%)"><div><strong>'.$c['total'].'</strong><span>Total</span></div></div><div class="chart-legend">';foreach([['Disponibles','active','green'],['Prestados','loaned','amber'],['Mantenimiento','maintenance','red'],['Inactivos','inactive','gray']] as [$label,$key,$color])echo '<div><i class="legend-dot tone-'. $color.'"></i><span>'.$label.'</span><b>'.round($c[$key]/$total*100).'%</b></div>';echo '</div></div>';}
