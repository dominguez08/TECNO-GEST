function publicError(error) {
  if (['ER_ACCESS_DENIED_ERROR', 'ER_DBACCESS_DENIED_ERROR'].includes(error.code)) {
    return {
      status: 503,
      code: 'DATABASE_CONFIGURATION',
      error:
        'MySQL rechazó las credenciales de conexión a la base de datos. Revisa DB_HOST, DB_PORT, DB_USER y DB_PASS en el archivo .env de esta computadora. No se trata del correo ni de la contraseña de tu cuenta de InventIC.'
    };
  }
  if (['ECONNREFUSED', 'ETIMEDOUT', 'ENOTFOUND', 'EHOSTUNREACH'].includes(error.code)) {
    return {
      status: 503,
      code: 'DATABASE_UNAVAILABLE',
      error:
        'No se pudo conectar con la base de datos. Ejecuta Iniciar InventIC.cmd y revisa que el servidor MySQL configurado en .env esté disponible.'
    };
  }
  if (['ER_BAD_DB_ERROR', 'ER_NO_SUCH_TABLE'].includes(error.code)) {
    return {
      status: 503,
      code: 'DATABASE_CONFIGURATION',
      error:
        'La base de datos de InventIC no está instalada o está incompleta. Revisa DB_NAME en .env y la instalación de esta computadora. Consulta README.md antes de modificar una base existente.'
    };
  }
  return {
    status: error.status || 400,
    error: error.sqlState
      ? 'No se pudo guardar: revisa datos duplicados, longitudes y registros relacionados.'
      : error.message
  };
}

module.exports = publicError;
