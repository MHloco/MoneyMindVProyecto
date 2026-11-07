const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const pool = require('../config/db');

// ============================================================
// UTILIDADES
// ============================================================

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function deriveNameFromEmail(email) {
  const localPart = email.split('@')[0];

  const words = localPart
    .split(/[.\_-]+/)
    .filter(Boolean)
    .map((word) => word.replace(/\d+$/, ''))
    .filter(Boolean)
    .map(
      (word) =>
        word.charAt(0).toUpperCase() +
        word.slice(1).toLowerCase()
    );

  return words.length
    ? words.join(' ')
    : localPart;
}

function signToken(user) {
  if (!process.env.JWT_ACCESS_SECRET) {
    throw new Error(
      'JWT_ACCESS_SECRET no está configurado.'
    );
  }

  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
    },
    process.env.JWT_ACCESS_SECRET,
    {
      expiresIn:
        process.env.JWT_ACCESS_EXPIRES || '15m',
    }
  );
}

function formatUser(user) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.full_name,
    currency: user.currency,
    timezone: user.timezone,
    locale: user.locale,
    role: user.role || 'USER',
  };
}

// ============================================================
// REGISTER
// ============================================================

async function registerUser(email, password) {
  email = normalizeEmail(email);

  const existingUser = await pool.query(
    `
      SELECT id
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  if (existingUser.rowCount > 0) {
    const error = new Error(
      'Ya existe una cuenta con ese correo.'
    );

    error.status = 409;

    throw error;
  }

  const fullName = deriveNameFromEmail(email);

  const saltRounds =
    Number(process.env.BCRYPT_SALT_ROUNDS) || 10;

  const passwordHash = await bcrypt.hash(
    password,
    saltRounds
  );

  const result = await pool.query(
    `
      INSERT INTO users (
        email,
        password_hash,
        full_name,
        role
      )
      VALUES ($1, $2, $3, 'USER')
      RETURNING
        id,
        email,
        full_name,
        currency,
        timezone,
        locale
    `,
    [
      email,
      passwordHash,
      fullName,
    ]
  );

  const user = result.rows[0];

  const token = signToken(user);

  return {
    user: formatUser(user),
    token,
  };
}

// ============================================================
// LOGIN
// ============================================================

async function loginUser(email, password, adminOnly = false) {
  email = normalizeEmail(email);

  const result = await pool.query(
    `
      SELECT
        id,
        email,
        password_hash,
        full_name,
        currency,
        timezone,
        locale,
        is_active,
        role,
        deleted_at
      FROM users
      WHERE email = $1
      LIMIT 1
    `,
    [email]
  );

  if (result.rowCount === 0) {
    const error = new Error(
      'Correo o contraseña incorrectos.'
    );

    error.status = 401;

    throw error;
  }

  const user = result.rows[0];

  if (
    !user.is_active ||
    user.deleted_at
  ) {
    const error = new Error(
      'Esta cuenta no está disponible.'
    );

    error.status = 403;

    throw error;
  }

  const validPassword =
    await bcrypt.compare(
      password,
      user.password_hash
    );

  if (!validPassword) {
    const error = new Error(
      'Correo o contraseña incorrectos.'
    );

    error.status = 401;

    throw error;
  }

  if (adminOnly && user.role !== 'SUPERUSER') {
    throw Object.assign(new Error('Acceso exclusivo para superusuarios.'), { status: 403 });
  }

  await pool.query(
    `
      UPDATE users
      SET last_login_at = now()
      WHERE id = $1
    `,
    [user.id]
  );

  const token = signToken(user);

  return {
    user: formatUser(user),
    token,
  };
}

async function logoutUser() {
  return { message: 'Sesión cerrada exitosamente.' };
}

// ============================================================
// EXPORTS
// ============================================================

module.exports = {
  registerUser,
  loginUser,
  logoutUser,
};
