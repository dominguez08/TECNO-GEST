<?php
// Cross-session throttling, keyed by a hash of the remote address; no credentials are stored.
function login_limiter(): array {
    $path = (getenv('APP_STORAGE_DIR') ?: __DIR__ . '/../storage') . '/login-' . hash('sha256', $_SERVER['REMOTE_ADDR'] ?? 'local') . '.json';
    $file = fopen($path, 'c+');
    if (!$file || !flock($file, LOCK_EX)) throw new RuntimeException('Login limiter unavailable');
    $data = json_decode(stream_get_contents($file), true) ?: ['start'=>time(),'count'=>0];
    if (time()-$data['start'] >= 900) $data=['start'=>time(),'count'=>0];
    $allowed = $data['count'] < 10;
    if ($allowed) $data['count']++;
    ftruncate($file,0); rewind($file); fwrite($file,json_encode($data)); fflush($file); flock($file,LOCK_UN); fclose($file);
    return [$allowed,$path];
}
