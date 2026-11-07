const pool = require('../config/db');

async function getSubscription(userId, redis) {
  const cacheKey = `subscription:user:${userId}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const result = await pool.query(
    `
    SELECT
      s.id,
      s.user_id,
      s.plan_id,
      s.status,
      s.started_at,
      s.current_period_start,
      s.current_period_end,
      s.cancelled_at,
      p.code AS plan_code,
      p.name AS plan_name,
      p.description AS plan_description,
      p.price,
      p.currency,
      p.billing_period,
      p.max_budgets,
      p.max_obligations,
      p.max_ai_queries,
      p.features
    FROM subscriptions s
    INNER JOIN plans p ON p.id = s.plan_id
    WHERE s.user_id = $1
    ORDER BY s.created_at DESC
    LIMIT 1
    `,
    [userId]
  );

  const subscription = result.rows[0] || null;

  await redis.setEx(
    cacheKey,
    60,
    JSON.stringify(subscription)
  );

  return subscription;
}

async function getPlans(redis) {
  const cacheKey = 'subscription:plans';

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const result = await pool.query(
    `
    SELECT
      id,
      code,
      name,
      description,
      price,
      currency,
      billing_period,
      max_budgets,
      max_obligations,
      max_ai_queries,
      features
    FROM plans
    WHERE is_active = TRUE
      AND code IN ('FREE', 'PRO')
    ORDER BY price ASC
    `
  );

  await redis.setEx(
    cacheKey,
    300,
    JSON.stringify(result.rows)
  );

  return result.rows;
}

async function changePlan(userId, planCode, redis) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');
    await client.query('SELECT id FROM users WHERE id = $1 FOR UPDATE', [userId]);

    const planResult = await client.query(
      `
      SELECT
        id,
        code,
        name,
        price,
        currency,
        billing_period
      FROM plans
      WHERE code = $1
        AND is_active = TRUE
      `,
      [planCode]
    );

    if (planResult.rowCount === 0) {
      throw new Error('Plan no encontrado.');
    }

    const plan = planResult.rows[0];

    const subscriptionResult = await client.query(
      `
      SELECT id
      FROM subscriptions
      WHERE user_id = $1
      ORDER BY created_at DESC
      LIMIT 1
      FOR UPDATE
      `,
      [userId]
    );

    if (subscriptionResult.rowCount === 0) {
      await client.query(`INSERT INTO subscriptions
        (user_id, plan_id, status, started_at, current_period_start, current_period_end)
        VALUES ($1, $2, 'ACTIVE', now(), now(), now() + $3::interval)`,
      [userId, plan.id, plan.billing_period === 'YEARLY' ? '1 year' : '1 month']);
      await client.query('COMMIT');
      await redis.del(`subscription:user:${userId}`);
      return getSubscription(userId, redis);
    }

    const subscriptionId = subscriptionResult.rows[0].id;

    const currentPlanResult = await client.query(
      `
      SELECT plan_id
      FROM subscriptions
      WHERE id = $1
      `,
      [subscriptionId]
    );

    if (currentPlanResult.rows[0].plan_id === plan.id) {
      throw new Error('El usuario ya tiene este plan.');
    }

    await client.query(
      `
      UPDATE subscriptions
      SET
        plan_id = $1,
        status = 'ACTIVE',
        cancelled_at = NULL,
        updated_at = now()
      WHERE id = $2
        AND user_id = $3
      `,
      [plan.id, subscriptionId, userId]
    );

    await client.query('COMMIT');

    await redis.del(`subscription:user:${userId}`);

    return getSubscription(userId, redis);
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function cancelSubscription(userId, redis) {
  const result = await pool.query(
    `
    UPDATE subscriptions
    SET
      cancelled_at = now(),
      updated_at = now()
    WHERE user_id = $1
      AND status IN ('ACTIVE', 'TRIALING')
      AND cancelled_at IS NULL
    RETURNING *
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new Error('No existe una suscripción activa para cancelar.');
  }

  await redis.del(`subscription:user:${userId}`);

  return result.rows[0];
}

async function reactivateSubscription(userId, redis) {
  const result = await pool.query(
    `
    UPDATE subscriptions
    SET
      cancelled_at = NULL,
      updated_at = now()
    WHERE user_id = $1
      AND status IN ('ACTIVE', 'TRIALING')
      AND cancelled_at IS NOT NULL
    RETURNING *
    `,
    [userId]
  );

  if (result.rowCount === 0) {
    throw new Error('No existe una suscripción cancelada para reactivar.');
  }

  await redis.del(`subscription:user:${userId}`);

  return result.rows[0];
}

module.exports = {
  getSubscription,
  getPlans,
  changePlan,
  cancelSubscription,
  reactivateSubscription
};
