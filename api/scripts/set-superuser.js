// Local operator command. No public endpoint can assign roles or create an admin.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env'), quiet: true });
const pool = require('../config/db');

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Uso: node api/scripts/set-superuser.js correo@ejemplo.com');
  }
  const result = await pool.query(`UPDATE users SET role = 'SUPERUSER', updated_at = now()
    WHERE email = $1 AND is_active = TRUE AND deleted_at IS NULL RETURNING id`, [email]);
  if (!result.rowCount) throw new Error('No existe una cuenta activa con ese correo. Regístrala primero.');
  console.log('Cuenta habilitada como superusuario. Ingresa en /admin/login con su contraseña habitual.');
}
main().catch(error => { console.error(error.code ? 'No se pudo actualizar el rol. Verifica la conexión y la migración.' : error.message); process.exitCode = 1; })
  .finally(() => pool.end());
