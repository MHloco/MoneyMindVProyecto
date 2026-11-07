const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

test('dashboard loads the selected calendar month and recent alerts for the authenticated user', {
  skip: process.env.RUN_DB_TESTS !== '1'
}, async () => {
  const pool = require('../config/db');
  const { getDashboardData } = require('./dashboard.services');
  const client = await pool.connect();
  const query = client.query.bind(client);
  const queryMock = mock.method(pool, 'query', query);
  try {
    await query('BEGIN');
    const users = (await query(`INSERT INTO users (email, password_hash, full_name)
      VALUES ($1, 'test-only-no-login', 'Dashboard regression'),
        ($2, 'test-only-no-login', 'Other user') RETURNING id`,
    [`dashboard-${randomUUID()}@example.invalid`, `dashboard-${randomUUID()}@example.invalid`])).rows;
    const [user, other] = users;
    await query(`INSERT INTO calendar_events (user_id, title, event_date)
      SELECT $1, 'Historical reminder', '2024-02-01'::date + n FROM generate_series(0, 5) AS n`, [user.id]);
    await query(`INSERT INTO calendar_events (user_id, title, event_date) VALUES
      ($1, 'Leap day', '2024-02-29'), ($1, 'Next month', '2024-03-01'),
      ($1, 'Previous month', '2024-01-31'), ($2, 'Other user', '2024-02-10')`, [user.id, other.id]);
    const alerts = (await query(`INSERT INTO alerts (user_id, type, title, message, status) VALUES
      ($1, 'OBLIGATION_DUE', 'Pending', 'Pending alert', 'PENDING'),
      ($1, 'OBLIGATION_DUE', 'Read', 'Read alert', 'READ'),
      ($1, 'OBLIGATION_DUE', 'Dismissed', 'Dismissed alert', 'DISMISSED'),
      ($2, 'OBLIGATION_DUE', 'Other user', 'Private alert', 'PENDING') RETURNING id, title`,
    [user.id, other.id])).rows;

    const dashboard = await getDashboardData(user.id, { month: '2024-02' });
    assert.equal(dashboard.financial.eventos.length, 7, 'past events and more than five reminders must load');
    assert.equal(dashboard.financial.eventos.at(-1).event_date, '2024-02-29');
    assert.ok(dashboard.financial.eventos.every(event => event.event_date.startsWith('2024-02')));
    assert.deepEqual(dashboard.financial.alertas.map(alert => alert.title).sort(), ['Pending', 'Read']);

    const pendingId = alerts.find(alert => alert.title === 'Pending').id;
    await query("UPDATE alerts SET status = 'READ', read_at = now() WHERE id = $1", [pendingId]);
    const refreshed = await getDashboardData(user.id, { month: '2024-03' });
    assert.deepEqual(refreshed.financial.eventos.map(event => event.title), ['Next month']);
    assert.equal(refreshed.financial.alertas.find(alert => alert.id === pendingId).status, 'READ');
    assert.ok(refreshed.financial.alertas.find(alert => alert.id === pendingId).read_at);
    const empty = await getDashboardData(user.id, { month: '2024-04' });
    assert.deepEqual(empty.financial.eventos, []);
  } finally {
    await query('ROLLBACK');
    queryMock.mock.restore();
    client.release();
    await pool.end();
  }
});
