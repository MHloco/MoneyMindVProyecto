const pool = require('../config/db');
const { clearExpenseCache } = require('./expense-cache');

async function getExpenses(userId, filters, redis) {
  const {
    startDate,
    endDate,
    categoryId,
    paymentMethod,
    search,
    page = 1,
    limit = 10
  } = filters;

  const offset = (page - 1) * limit;

  // Colección de filtros dinámicos adicionales
  const filterConditions = [];
  const params = [userId];
  let paramIndex = 2;

  if (startDate) {
    filterConditions.push(`e.transaction_date >= $${paramIndex}`);
    params.push(startDate);
    paramIndex++;
  }

  if (endDate) {
    filterConditions.push(`e.transaction_date <= $${paramIndex}`);
    params.push(endDate);
    paramIndex++;
  }

  if (categoryId) {
    filterConditions.push(`e.category_id = $${paramIndex}`);
    params.push(categoryId);
    paramIndex++;
  }

  if (paymentMethod) {
    filterConditions.push(`e.payment_method = $${paramIndex}`);
    params.push(paymentMethod);
    paramIndex++;
  }

  if (search) {
    filterConditions.push(`
      (
        e.description ILIKE $${paramIndex}
        OR e.notes ILIKE $${paramIndex}
        OR EXISTS (
          SELECT 1
          FROM unnest(e.tags) AS tag
          WHERE tag ILIKE $${paramIndex}
        )
      )
    `);
    params.push(`%${search}%`);
    paramIndex++;
  }

  // Si existen condiciones dinámicas adicionales, se formatean con 'AND' al inicio
  const filtersSql = filterConditions.length > 0 
    ? `AND ${filterConditions.join(' AND ')}` 
    : '';

  // 1. Conteo total basado en v_expenses
  const countResult = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM v_expenses e
    WHERE e.user_id = $1
    ${filtersSql}
    `,
    params
  );

  const total = Number(countResult.rows[0].total);

  // 2. Consulta de datos del listado paginado
  const result = await pool.query(
    `
    SELECT
        e.id,
        e.user_id,
        e.category_id,
        e.amount,
        e.currency,
        e.description,
        e.notes,
        e.transaction_date,
        e.payment_method,
        e.source,
        e.tags,
        e.created_at,
        e.updated_at,
        c.name AS category_name,
        c.color AS category_color,
        c.icon AS category_icon
    FROM v_expenses e
    LEFT JOIN categories c ON c.id = e.category_id
    WHERE e.user_id = $1
    ${filtersSql}
    ORDER BY e.transaction_date DESC, e.created_at DESC
    LIMIT $${params.length + 1}
    OFFSET $${params.length + 2}
    `,
    [...params, limit, offset]
  );

  return {
    expenses: result.rows,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  };
}


async function createExpense(userId, data, redis) {
  const {
    amount,
    transaction_date,
    category_id,
    payment_method,
    description,
    notes,
    tags
  } = data;

  const categoryResult = await pool.query(`
    SELECT id
    FROM categories
    WHERE id = $1
      AND type = 'EXPENSE'
      AND is_active = TRUE
      AND (
        is_system = TRUE
        OR user_id = $2
      )
  `, [category_id, userId]);

  if (categoryResult.rowCount === 0) {
    const error = new Error('La categoría de gasto no es válida.');
    error.status = 400;
    throw error;
  }

  const result = await pool.query(`
    INSERT INTO transactions (
      user_id,
      category_id,
      type,
      amount,
      currency,
      description,
      notes,
      transaction_date,
      payment_method,
      tags
    )
    VALUES (
      $1,
      $2,
      'EXPENSE',
      $3,
      'PEN',
      $4,
      $5,
      $6,
      $7,
      $8
    )
    RETURNING
      id,
      category_id,
      amount,
      currency,
      description,
      notes,
      transaction_date,
      payment_method,
      tags,
      created_at,
      updated_at
  `, [
    userId,
    category_id,
    amount,
    description,
    notes || null,
    transaction_date,
    payment_method,
    tags || []
  ]);

  await clearExpenseCache(userId, redis);

  return result.rows[0];
}


async function updateExpense(userId, expenseId, data, redis) {
  const {
    amount,
    transaction_date,
    category_id,
    payment_method,
    description,
    notes,
    tags
  } = data;

  const existing = await pool.query(`
    SELECT id
    FROM transactions
    WHERE id = $1
      AND user_id = $2
      AND type = 'EXPENSE'
      AND deleted_at IS NULL
  `, [expenseId, userId]);

  if (existing.rowCount === 0) {
    const error = new Error('Gasto no encontrado.');
    error.status = 404;
    throw error;
  }

  if (category_id) {
    const categoryResult = await pool.query(`
      SELECT id
      FROM categories
      WHERE id = $1
        AND type = 'EXPENSE'
        AND is_active = TRUE
        AND (
          is_system = TRUE
          OR user_id = $2
        )
    `, [category_id, userId]);

    if (categoryResult.rowCount === 0) {
      const error = new Error('La categoría de gasto no es válida.');
      error.status = 400;
      throw error;
    }
  }

  const result = await pool.query(`
    UPDATE transactions
    SET
      amount = COALESCE($1, amount),
      transaction_date = COALESCE($2, transaction_date),
      category_id = COALESCE($3, category_id),
      payment_method = COALESCE($4, payment_method),
      description = COALESCE($5, description),
      notes = COALESCE($6, notes),
      tags = COALESCE($7, tags),
      updated_at = now()
    WHERE id = $8
      AND user_id = $9
      AND type = 'EXPENSE'
      AND deleted_at IS NULL

    RETURNING
      id,
      category_id,
      amount,
      currency,
      description,
      notes,
      transaction_date,
      payment_method,
      tags,
      updated_at
  `, [
    amount,
    transaction_date,
    category_id,
    payment_method,
    description,
    notes,
    tags,
    expenseId,
    userId
  ]);

  await clearExpenseCache(userId, redis);

  return result.rows[0];
}


async function deleteExpense(userId, expenseId, redis) {
  const result = await pool.query(`
    UPDATE transactions
    SET
      deleted_at = now(),
      updated_at = now()
    WHERE id = $1
      AND user_id = $2
      AND type = 'EXPENSE'
      AND deleted_at IS NULL

    RETURNING id
  `, [expenseId, userId]);

  if (result.rowCount === 0) {
    const error = new Error('Gasto no encontrado.');
    error.status = 404;
    throw error;
  }

  await clearExpenseCache(userId, redis);

  return result.rows[0];
}


async function getExpenseDistribution(userId, month, redis) {
  const cacheKey = `expense-distribution:user:${userId}:${month}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const result = await pool.query(
    `
    SELECT
        category_id,
        category_name,
        category_color,
        total,
        movements
    FROM v_expense_distribution
    WHERE user_id = $1
      AND month = $2
    ORDER BY total DESC
    `,
    [userId, month]
  );

  await redis.setEx(
    cacheKey,
    60,
    JSON.stringify(result.rows)
  );

  return result.rows;
}


module.exports = {
  getExpenses,
  createExpense,
  updateExpense,
  deleteExpense,
  getExpenseDistribution
};
