const pool = require('../config/db');


// ============================================================
// LISTAR PRESUPUESTOS
// ============================================================

async function getBudgets(userId, redis) {

  const cacheKey = `budgets:user:${userId}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }


  const result = await pool.query(
    `
    SELECT
      b.id,
      b.category_id,
      c.name AS category_name,
      c.color AS category_color,
      c.icon AS category_icon,
      b.name,
      b.amount,
      b.currency,
      b.period_type,
      b.period_start,
      b.period_end,
      b.alert_threshold,
      b.rollover,
      b.is_active,
      b.created_at,

      COALESCE(
        (
          SELECT SUM(t.amount)
          FROM transactions t
          WHERE t.user_id = b.user_id
            AND t.category_id = b.category_id
            AND t.type = 'EXPENSE'
            AND t.transaction_date
                BETWEEN b.period_start AND b.period_end
            AND t.deleted_at IS NULL
        ),
        0
      ) AS spent

    FROM budgets b

    LEFT JOIN categories c
      ON c.id = b.category_id

    WHERE b.user_id = $1
      AND b.is_active = TRUE

    ORDER BY b.period_start DESC, b.created_at DESC
    `,
    [userId]
  );


  const budgets = result.rows.map((budget) => {

    const amount = Number(budget.amount);
    const spent = Number(budget.spent);

    const remaining =
      amount - spent;

    const percentage =
      amount > 0
        ? (spent / amount) * 100
        : 0;

    let status = 'NORMAL';

    if (spent >= amount) {
      status = 'EXCEEDED';
    } else if (
      spent >=
      amount * Number(budget.alert_threshold)
    ) {
      status = 'WARNING';
    }


    return {
      id: budget.id,
      categoryId: budget.category_id,
      categoryName: budget.category_name,
      categoryColor: budget.category_color,
      categoryIcon: budget.category_icon,

      name: budget.name,

      amount,
      spent,
      remaining,

      percentage: Number(
        percentage.toFixed(2)
      ),

      currency: budget.currency,

      periodType: budget.period_type,
      periodStart: budget.period_start,
      periodEnd: budget.period_end,

      alertThreshold:
        Number(budget.alert_threshold),

      rollover: budget.rollover,
      isActive: budget.is_active,

      status,

      createdAt: budget.created_at
    };
  });


  await redis.set(
    cacheKey,
    JSON.stringify(budgets),
    {
      EX: 60
    }
  );


  return budgets;
}


// ============================================================
// CREAR PRESUPUESTO
// ============================================================

async function createBudget(
  userId,
  data,
  redis
) {

  const {
    categoryId,
    name,
    amount,
    currency = 'PEN',
    periodType = 'MONTHLY',
    periodStart,
    periodEnd,
    alertThreshold = 0.80,
    rollover = false
  } = data;


  const categoryResult =
    await pool.query(
      `
      SELECT id
      FROM categories
      WHERE id = $1
        AND (
          user_id = $2
          OR is_system = TRUE
        )
        AND is_active = TRUE
      `,
      [
        categoryId,
        userId
      ]
    );


  if (categoryResult.rowCount === 0) {

    const error = new Error(
      'La categoría no existe o no pertenece al usuario.'
    );

    error.status = 400;

    throw error;
  }


  let result;
  try {
    result = await pool.query(
      `
      INSERT INTO budgets (
        user_id,
        category_id,
        name,
        amount,
        currency,
        period_type,
        period_start,
        period_end,
        alert_threshold,
        rollover
      )
      VALUES (
        $1, $2, $3, $4, $5,
        $6, $7, $8, $9, $10
      )
      RETURNING *
      `,
      [
        userId,
        categoryId,
        name,
        amount,
        currency,
        periodType,
        periodStart,
        periodEnd,
        alertThreshold,
        rollover
      ]
    );
  } catch (error) {
    if (error.code === '23P01' && error.constraint === 'excl_budget_overlap') {
      const conflict = new Error(
        'Ya tienes un presupuesto activo para esta categoría en esas fechas. Elige otra categoría o un período que no se cruce con el existente.'
      );
      conflict.status = 409;
      throw conflict;
    }
    throw error;
  }


  await redis.del(
    `budgets:user:${userId}`
  );


  return result.rows[0];
}


// ============================================================
// ELIMINAR / DESACTIVAR
// ============================================================

async function deleteBudget(
  userId,
  budgetId,
  redis
) {

  const result =
    await pool.query(
      `
      UPDATE budgets
      SET is_active = FALSE
      WHERE id = $1
        AND user_id = $2
      RETURNING id
      `,
      [
        budgetId,
        userId
      ]
    );


  if (result.rowCount === 0) {

    const error = new Error(
      'Presupuesto no encontrado.'
    );

    error.status = 404;

    throw error;
  }


  await redis.del(
    `budgets:user:${userId}`
  );


  return {
    id: budgetId
  };
}


module.exports = {
  getBudgets,
  createBudget,
  deleteBudget
};
