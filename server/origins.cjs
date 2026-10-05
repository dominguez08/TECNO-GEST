function allowedOrigins(env = process.env) {
  const port = Number(env.PORT || 3000);
  const livePort = Number(env.LIVE_SERVER_PORT || 5500);
  const origins = new Set([
    `http://localhost:${port}`,
    `http://localhost:${livePort}`,
    'http://localhost:5501',
    `http://127.0.0.1:${port}`,
    `http://127.0.0.1:${livePort}`,
    'http://127.0.0.1:5501'
  ]);
  // Railway terminates HTTPS before forwarding requests to the container.
  // Trust configured domains, never a client-supplied Host header.
  if (env.RAILWAY_PUBLIC_DOMAIN) {
    origins.add(new URL(`https://${env.RAILWAY_PUBLIC_DOMAIN}`).origin);
  }
  if (env.APP_ORIGIN) {
    const url = new URL(env.APP_ORIGIN);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('APP_ORIGIN debe ser una dirección HTTP o HTTPS.');
    }
    origins.add(url.origin);
  }
  return origins;
}

module.exports = { allowedOrigins };
