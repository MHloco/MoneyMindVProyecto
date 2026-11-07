require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const fs = require('node:fs');
const path = require('node:path');
const pool = require('../config/db');
pool.query(fs.readFileSync(path.join(__dirname, '../migrations/20261006_admin_role.sql'), 'utf8'))
  .then(() => console.log('Migración de roles aplicada. Las cuentas existentes conservan el rol USER.'))
  .catch(() => { console.error('No se pudo aplicar la migración de roles. Revisa la conexión y los permisos de PostgreSQL.'); process.exitCode = 1; })
  .finally(() => pool.end());
