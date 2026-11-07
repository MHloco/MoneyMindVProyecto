const pool = require('../config/db');
const { moneyInCents, paymentFields, invalid } = require('./payment-data');

function validateIncome(data) {
  moneyInCents(data.amount);
  const date = String(data.transaction_date || '');
  const parsed = new Date(`${date}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    throw invalid('Ingresa una fecha válida.');
  }
  return paymentFields(data.payment_method, data.notes);
}

async function getIncomes(userId, filters, redis) {
  const {
    startDate,
    endDate,
    source,
    page = 1,
    limit = 10
  } = filters;

  const conditions = ['i.user_id = $1'];
  const params = [userId];

  if (startDate) {
    params.push(startDate);
    conditions.push(`i.transaction_date >= $${params.length}`);
  }

  if (endDate) {
    params.push(endDate);
    conditions.push(`i.transaction_date <= $${params.length}`);
  }

  if (source) {
    params.push(`%${source}%`);
    conditions.push(`i.source ILIKE $${params.length}`);
  }

  const whereSql = conditions.join(' AND ');
  const offset = (Number(page) - 1) * Number(limit);

  const countResult = await pool.query(
    `
    SELECT COUNT(*) AS total
    FROM v_incomes i
    WHERE ${whereSql}
    `,
    params
  );

  const dataParams = [...params, Number(limit), offset];

  const result = await pool.query(
    `
    SELECT
      i.id,
      i.user_id,
      i.category_id,
      i.amount,
      i.currency,
      i.description,
      i.notes,
      i.transaction_date,
      i.payment_method,
      i.source,
      i.tags,
      i.created_at,
      i.updated_at,
      c.name AS category_name,
      c.color AS category_color,
      c.icon AS category_icon
    FROM v_incomes i
    LEFT JOIN categories c ON c.id = i.category_id
    WHERE ${whereSql}
    ORDER BY i.transaction_date DESC, i.created_at DESC
    LIMIT $${dataParams.length - 1}
    OFFSET $${dataParams.length}
    `,
    dataParams
  );

  return {
    data: result.rows,
    pagination: {
      page: Number(page),
      limit: Number(limit),
      total: Number(countResult.rows[0].total),
      totalPages: Math.ceil(
        Number(countResult.rows[0].total) / Number(limit)
      )
    }
  };
}

async function createIncome(userId, data, redis) {
  const fields = validateIncome(data);
  const {
    amount,
    transaction_date,
    category_id,
    source,
    payment_method,
    notes
  } = data;

  if (category_id) {
    const category = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1
        AND type = 'INCOME'
        AND (user_id IS NULL OR user_id = $2)
        AND is_active = TRUE
      `,
      [category_id, userId]
    );

    if (category.rowCount === 0) {
      throw new Error('Categoría de ingreso inválida.');
    }
  }

  const result = await pool.query(
    `
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
      source
    )
    VALUES (
      $1,
      $2,
      'INCOME',
      $3,
      'PEN',
      $4,
      $5,
      $6,
      $7,
      $8
    )
    RETURNING *
    `,
    [
      userId,
      category_id || null,
      amount,
      source || 'Ingreso',
      fields.notes,
      transaction_date,
      fields.paymentMethod,
      source || null
    ]
  );

  return result.rows[0];
}

async function updateIncome(userId, incomeId, data, redis) {
  const fields = validateIncome(data);
  const {
    amount,
    transaction_date,
    category_id,
    source,
    payment_method,
    notes
  } = data;

  if (category_id) {
    const category = await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1
        AND type = 'INCOME'
        AND (user_id IS NULL OR user_id = $2)
        AND is_active = TRUE
      `,
      [category_id, userId]
    );

    if (category.rowCount === 0) {
      throw new Error('Categoría de ingreso inválida.');
    }
  }

  const result = await pool.query(
    `
    UPDATE transactions
    SET
      amount = $1,
      transaction_date = $2,
      category_id = $3,
      payment_method = $4,
      source = $5,
      description = $6,
      notes = $7,
      updated_at = now()
    WHERE id = $8
      AND user_id = $9
      AND type = 'INCOME'
      AND deleted_at IS NULL
    RETURNING *
    `,
    [
      amount,
      transaction_date,
      category_id || null,
      fields.paymentMethod,
      source || null,
      source || 'Ingreso',
      fields.notes,
      incomeId,
      userId
    ]
  );

  if (result.rowCount === 0) {
    throw new Error('Ingreso no encontrado.');
  }

  return result.rows[0];
}

async function deleteIncome(userId, incomeId, redis) {
  const result = await pool.query(
    `
    UPDATE transactions
    SET deleted_at = now()
    WHERE id = $1
      AND user_id = $2
      AND type = 'INCOME'
      AND deleted_at IS NULL
    RETURNING id
    `,
    [incomeId, userId]
  );

  if (result.rowCount === 0) {
    throw new Error('Ingreso no encontrado.');
  }

  return result.rows[0];
}

async function getIncomeMetrics(userId, redis) {
  const result = await pool.query(
    `
    SELECT
      COALESCE(SUM(
        CASE
          WHEN transaction_date >= date_trunc('month', CURRENT_DATE)
           AND transaction_date < date_trunc('month', CURRENT_DATE) + INTERVAL '1 month'
          THEN amount
          ELSE 0
        END
      ), 0) AS current_month,

      COALESCE(SUM(
        CASE
          WHEN transaction_date >= date_trunc('month', CURRENT_DATE - INTERVAL '1 month')
           AND transaction_date < date_trunc('month', CURRENT_DATE)
          THEN amount
          ELSE 0
        END
      ), 0) AS previous_month

    FROM v_incomes
    WHERE user_id = $1
      AND transaction_date >= date_trunc(
        'month',
        CURRENT_DATE - INTERVAL '1 month'
      )
    `,
    [userId]
  );

  return result.rows[0];
}

module.exports = {
  getIncomes,
  createIncome,
  updateIncome,
  deleteIncome,
  getIncomeMetrics
};
