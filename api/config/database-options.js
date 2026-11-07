const fs = require('node:fs');

function databaseOptions(env = process.env) {
  // URL SSL parameters override pg's ssl object; keep TLS configuration explicit.
  if (env.DATABASE_URL) {
    const url = new URL(env.DATABASE_URL);
    for (const key of ['sslmode', 'sslcert', 'sslkey', 'sslrootcert']) {
      if (url.searchParams.has(key)) {
        throw new Error('Configura TLS con DB_SSL y DB_SSL_CA_FILE, sin parámetros SSL en DATABASE_URL.');
      }
    }
  }
  return {
    connectionString: env.DATABASE_URL,
    connectionTimeoutMillis: 10000,
    ssl: env.DB_SSL === 'true' ? {
      rejectUnauthorized: true,
      ...(env.DB_SSL_CA_FILE ? { ca: fs.readFileSync(env.DB_SSL_CA_FILE, 'utf8') } : {}),
    } : false,
  };
}

module.exports = { databaseOptions };
