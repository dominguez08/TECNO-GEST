function parseConnectionUrl(value) {
  if (!value) return {};
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error('La URL de conexión MySQL no tiene un formato válido.');
  }
  if (!['mysql:', 'mysql2:'].includes(url.protocol)) {
    throw new Error('La URL de conexión debe utilizar el protocolo mysql.');
  }
  return {
    host: url.hostname,
    port: url.port ? Number(url.port) : undefined,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: decodeURIComponent(url.pathname.replace(/^\//, ''))
  };
}

function getDatabaseConfig(env = process.env) {
  const databaseUrl = /^mysql(?:2)?:\/\//i.test(env.DATABASE_URL || '')
    ? env.DATABASE_URL
    : undefined;
  const fromUrl = parseConnectionUrl(env.MYSQL_URL || databaseUrl);
  const config = {
    host: env.DB_HOST || env.MYSQLHOST || fromUrl.host || '127.0.0.1',
    port: Number(env.DB_PORT || env.MYSQLPORT || fromUrl.port || 3307),
    user: env.DB_USER || env.MYSQLUSER || fromUrl.user || 'inventic_app',
    password: env.DB_PASS || env.MYSQLPASSWORD || fromUrl.password,
    database: env.DB_NAME || env.MYSQLDATABASE || fromUrl.database || 'inventic_html'
  };
  if (!Number.isInteger(config.port) || config.port < 1 || config.port > 65535) {
    throw new Error('El puerto configurado para MySQL no es válido.');
  }
  return config;
}

module.exports = { getDatabaseConfig };
