const pool = require('../config/db');

// Check the current database role on every request, including revoked accounts.
module.exports = async function requireAdmin(req, res, next) {
  res.set('Cache-Control', 'no-store');
  try {
    const result = await pool.query(
      `SELECT id, email, full_name FROM users
       WHERE id = $1 AND role = 'SUPERUSER' AND is_active = TRUE AND deleted_at IS NULL`,
      [req.user.id]);
    if (!result.rowCount) return res.status(403).json({ message: 'Acceso exclusivo para superusuarios.' });
    req.admin = result.rows[0];
    next();
  } catch {
    res.status(503).json({ message: 'No se pudo verificar el acceso de administrador.' });
  }
};
