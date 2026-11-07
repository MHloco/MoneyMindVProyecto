const pool = require('../config/db');

async function getAlerts(userId, redis) {

  // Read the source of truth: agents may insert alerts in another request/process.

  const result = await pool.query(
    `
    SELECT
      id,
      type,
      severity,
      status,
      title,
      message,
      related_entity_type,
      related_entity_id,
      metadata,
      scheduled_for,
      sent_at,
      read_at,
      created_at
    FROM alerts
    WHERE user_id = $1
    ORDER BY created_at DESC
    `,
    [userId]
  );

  const alerts = result.rows;

  return alerts;
}


async function markAlertAsRead(
  userId,
  alertId,
  redis
) {

  const result = await pool.query(
    `
    UPDATE alerts
    SET
      status = 'READ',
      read_at = now()
    WHERE id = $1
      AND user_id = $2
    RETURNING
      id,
      type,
      severity,
      status,
      title,
      message,
      read_at
    `,
    [
      alertId,
      userId
    ]
  );


  if (result.rowCount === 0) {

    const error = new Error(
      'Alerta no encontrada.'
    );

    error.status = 404;

    throw error;
  }


  await redis.del(
    `alerts:user:${userId}`
  );


  return result.rows[0];
}


module.exports = {
  getAlerts,
  markAlertAsRead
};
