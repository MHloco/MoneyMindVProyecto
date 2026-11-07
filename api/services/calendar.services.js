const pool = require('../config/db');

async function getEvents(userId, month, year, redis) {
  const cacheKey = `calendar:user:${userId}:${year}-${month}`;

  const cached = await redis.get(cacheKey);

  if (cached) {
    return JSON.parse(cached);
  }

  const result = await pool.query(`
    SELECT
      id,
      title,
      description,
      event_date,
      color,
      created_at,
      updated_at
    FROM calendar_events
    WHERE user_id = $1
      AND EXTRACT(MONTH FROM event_date) = $2
      AND EXTRACT(YEAR FROM event_date) = $3
    ORDER BY event_date ASC, created_at ASC
  `, [userId, month, year]);

  const events = result.rows;

  await redis.set(
    cacheKey,
    JSON.stringify(events),
    { EX: 60 }
  );

  return events;
}

async function createEvent(userId, data, redis) {
  const {
    title,
    description,
    event_date,
    color
  } = data;

  const result = await pool.query(`
    INSERT INTO calendar_events (
      user_id,
      title,
      description,
      event_date,
      color
    )
    VALUES ($1, $2, $3, $4, $5)
    RETURNING
      id,
      title,
      description,
      event_date,
      color,
      created_at,
      updated_at
  `, [
    userId,
    title,
    description || null,
    event_date,
    color || '#3b82f6'
  ]);

  const event = result.rows[0];

  const date = new Date(`${event_date}T00:00:00`);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  await redis.del(`calendar:user:${userId}:${year}-${month}`);

  return event;
}

async function deleteEvent(userId, eventId, redis) {
  const result = await pool.query(`
    DELETE FROM calendar_events
    WHERE id = $1
      AND user_id = $2
    RETURNING id, event_date
  `, [eventId, userId]);

  if (result.rowCount === 0) {
    const error = new Error('Recordatorio no encontrado.');
    error.status = 404;
    throw error;
  }

  const event = result.rows[0];

  const date = event.event_date instanceof Date
    ? event.event_date
    : new Date(`${event.event_date}T00:00:00`);
  const month = date.getMonth() + 1;
  const year = date.getFullYear();

  await redis.del(`calendar:user:${userId}:${year}-${month}`);

  return event;
}

module.exports = {
  getEvents,
  createEvent,
  deleteEvent
};
