<?php
// Development server only: php -S 127.0.0.1:8000 tools/router.php
if (PHP_SAPI !== 'cli-server') { http_response_code(404); exit; }
$path=rawurldecode(parse_url($_SERVER['REQUEST_URI'],PHP_URL_PATH));
if (preg_match('~(^|/)(\.|config/|includes/|storage/|tools/|tests/)|\.(sql|md|log)$~i',$path)) { http_response_code(404); exit; }
return false;
