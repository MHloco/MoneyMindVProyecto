const pool = require('../config/db');

async function getCategories(userId, type, redis) {
  const cacheKey = `categories:user:${userId}:${type}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const result = await pool.query(`
    SELECT
      id,
      user_id,
      parent_id,
      name,
      type,
      color,
      icon,
      is_system,
      is_active,
      created_at,
      updated_at
    FROM categories
    WHERE type = $1
      AND is_active = TRUE
      AND (
        is_system = TRUE
        OR user_id = $2
      )
    ORDER BY
      is_system DESC,
      parent_id NULLS FIRST,
      name ASC
  `, [type, userId]);

  const categories = result.rows;

  await redis.set(
    cacheKey,
    JSON.stringify(categories),
    { EX: 60 }
  );

  return categories;
}

async function getUserCategories(userId, type, redis) {
  // Reuse the cache invalidated by every category mutation.
  const categories = await getCategories(userId, type, redis);

  return categories.filter(category =>
    category.user_id === userId && !category.is_system
  );
}

async function createCategory(userId, data, redis) {
  const {
    name,
    type,
    color,
    icon,
    parent_id
  } = data;

  if (!['INCOME', 'EXPENSE'].includes(type)) {
    const error = new Error('Tipo de categoría inválido.');
    error.status = 400;
    throw error;
  }

  if (parent_id) {
    const parent = await pool.query(`
      SELECT id
      FROM categories
      WHERE id = $1
        AND (
          user_id = $2
          OR is_system = TRUE
        )
        AND type = $3
        AND is_active = TRUE
    `, [parent_id, userId, type]);

    if (parent.rowCount === 0) {
      const error = new Error('La categoría padre no es válida.');
      error.status = 400;
      throw error;
    }
  }

  const result = await pool.query(`
    INSERT INTO categories (
      user_id,
      parent_id,
      name,
      type,
      color,
      icon,
      is_system
    )
    VALUES ($1, $2, $3, $4, $5, $6, FALSE)
    RETURNING
      id,
      user_id,
      parent_id,
      name,
      type,
      color,
      icon,
      is_system,
      is_active,
      created_at,
      updated_at
  `, [
    userId,
    parent_id || null,
    name,
    type,
    color || '#607D8B',
    icon || 'category'
  ]);

  await redis.del(`categories:user:${userId}:${type}`);

  return result.rows[0];
}

async function updateCategory(userId, categoryId, data, redis) {
  const {
    name,
    color,
    icon,
    parent_id
  } = data;

  const categoryResult = await pool.query(`
    SELECT
      id,
      type,
      is_system
    FROM categories
    WHERE id = $1
      AND user_id = $2
  `, [categoryId, userId]);

  if (categoryResult.rowCount === 0) {
    const error = new Error('Categoría no encontrada.');
    error.status = 404;
    throw error;
  }

  const category = categoryResult.rows[0];

  if (category.is_system) {
    const error = new Error(
      'Las categorías del sistema no pueden modificarse.'
    );
    error.status = 403;
    throw error;
  }

  if (parent_id) {
    if (parent_id === categoryId) {
      const error = new Error(
        'Una categoría no puede ser su propia categoría padre.'
      );
      error.status = 400;
      throw error;
    }

    const parent = await pool.query(`
      SELECT id
      FROM categories
      WHERE id = $1
        AND (
          user_id = $2
          OR is_system = TRUE
        )
        AND type = $3
        AND is_active = TRUE
    `, [parent_id, userId, category.type]);

    if (parent.rowCount === 0) {
      const error = new Error('La categoría padre no es válida.');
      error.status = 400;
      throw error;
    }
  }

  const result = await pool.query(`
    UPDATE categories
    SET
      name = COALESCE($1, name),
      color = COALESCE($2, color),
      icon = COALESCE($3, icon),
      parent_id = $4,
      updated_at = now()
    WHERE id = $5
      AND user_id = $6
    RETURNING
      id,
      user_id,
      parent_id,
      name,
      type,
      color,
      icon,
      is_system,
      is_active,
      created_at,
      updated_at
  `, [
    name,
    color,
    icon,
    parent_id || null,
    categoryId,
    userId
  ]);

  await redis.del(
    `categories:user:${userId}:${category.type}`
  );

  return result.rows[0];
}

async function deleteCategory(userId, categoryId, redis) {
  const result = await pool.query(`
    DELETE FROM categories
    WHERE id = $1
      AND user_id = $2
      AND is_system = FALSE
    RETURNING id, type
  `, [categoryId, userId]);

  if (result.rowCount === 0) {
    const error = new Error(
      'Categoría no encontrada o no puede eliminarse.'
    );
    error.status = 404;
    throw error;
  }

  await redis.del(
    `categories:user:${userId}:${result.rows[0].type}`
  );

  return result.rows[0];
}

module.exports = {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  getUserCategories
};
