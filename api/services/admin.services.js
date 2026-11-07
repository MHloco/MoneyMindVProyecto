const pool = require('../config/db');
const bcrypt = require('bcrypt');

async function createSuperuser(actorId, body) {
  const invalid = message => Object.assign(new Error(message), { status: 400 });
  if (!body || typeof body !== 'object' || Array.isArray(body)
    || Object.keys(body).some(key => !['fullName', 'email', 'password'].includes(key))) {
    throw invalid('Datos de superusuario inválidos.');
  }
  const { fullName, email, password } = body;
  if (typeof fullName !== 'string' || !fullName.trim() || fullName.trim().length > 120)
    throw invalid('Ingresa un nombre de hasta 120 caracteres.');
  if (typeof email !== 'string' || email.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim()))
    throw invalid('Ingresa un correo electrónico válido.');
  if (typeof password !== 'string' || password.length < 12 || Buffer.byteLength(password, 'utf8') > 72 || !password.trim())
    throw invalid('La contraseña debe tener al menos 12 caracteres y no superar 72 bytes.');
  const hash = await bcrypt.hash(password, 12);
  try {
    // Recheck authorization at the write, including revocation during password hashing.
    const result = await pool.query(`INSERT INTO users (email, password_hash, full_name, role)
      SELECT $1, $2, $3, 'SUPERUSER' FROM users
      WHERE id = $4 AND role = 'SUPERUSER' AND is_active = TRUE AND deleted_at IS NULL
      RETURNING id, email, full_name, role`, [email.trim().toLowerCase(), hash, fullName.trim(), actorId]);
    if (!result.rowCount) throw Object.assign(new Error('Tu cuenta ya no tiene permisos de superusuario.'), { status: 403 });
    return { user: result.rows[0] };
  } catch (error) {
    if (error.code === '23505') throw Object.assign(new Error('Ya existe una cuenta con ese correo. No se modificó su rol ni su contraseña.'), { status: 409 });
    throw error;
  }
}

async function summary() {
  const { rows } = await pool.query(`SELECT
    count(*) FILTER (WHERE deleted_at IS NULL)::int AS total,
    count(*) FILTER (WHERE is_active AND deleted_at IS NULL)::int AS active,
    count(*) FILTER (WHERE NOT is_active AND deleted_at IS NULL)::int AS inactive,
    count(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS deleted,
    count(*) FILTER (WHERE role = 'SUPERUSER' AND deleted_at IS NULL)::int AS superusers,
    count(*) FILTER (WHERE email_verified_at IS NOT NULL AND deleted_at IS NULL)::int AS verified,
    count(*) FILTER (WHERE created_at >= now() - interval '30 days' AND deleted_at IS NULL)::int AS new_users,
    count(*) FILTER (WHERE last_login_at >= now() - interval '30 days' AND deleted_at IS NULL)::int AS recent_logins
    FROM users`);
  return rows[0];
}

async function users(query = {}) {
  const page = Number(query.page ?? 1);
  const search = query.search ?? '';
  const status = query.status ?? 'all';
  const role = query.role ?? 'all';
  if (!Number.isSafeInteger(page) || page < 1 || page > 1000000
    || typeof search !== 'string' || search.length > 120
    || !['all', 'active', 'inactive', 'deleted'].includes(status)
    || !['all', 'USER', 'SUPERUSER'].includes(role)) {
    throw Object.assign(new Error('Filtros de usuarios inválidos.'), { status: 400 });
  }
  // Treat wildcard characters as literal search text; all values are bound parameters.
  const pattern = '%' + search.trim().replace(/[\\%_]/g, '\\$&') + '%';
  const conditions = `WHERE (u.email::text ILIKE $1 OR u.full_name ILIKE $1)
    AND ($2 = 'all' OR ($2 = 'active' AND u.is_active AND u.deleted_at IS NULL)
      OR ($2 = 'inactive' AND NOT u.is_active AND u.deleted_at IS NULL)
      OR ($2 = 'deleted' AND u.deleted_at IS NOT NULL))
    AND ($3 = 'all' OR u.role = $3)`;
  const params = [pattern, status, role];
  const count = await pool.query(`SELECT count(*)::int AS total FROM users u ${conditions}`, params);
  const result = await pool.query(`SELECT u.id, u.email, u.full_name, u.currency, u.timezone,
    u.locale, u.role, u.is_active, u.email_verified_at, u.last_login_at, u.created_at, u.deleted_at
    FROM users u ${conditions} ORDER BY u.created_at DESC, u.id DESC LIMIT 20 OFFSET $4`,
  [...params, (page - 1) * 20]);
  return { users: result.rows, total: count.rows[0].total, page, pageSize: 20 };
}

module.exports = { summary, users, createSuperuser };
