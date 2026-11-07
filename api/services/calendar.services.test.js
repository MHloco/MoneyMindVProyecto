const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { types } = require('pg');
const pool = require('../config/db');
const calendarService = require('./calendar.services');

for (const dateValue of [types.getTypeParser(1082)('2026-10-01'), '2026-10-01']) {
  test(`deleting a reminder invalidates its cached month (${typeof dateValue})`, async () => {
    const event = { id: 'reminder-1', event_date: dateValue };
    const query = mock.method(pool, 'query', async () => ({ rowCount: 1, rows: [event] }));
    const cache = new Map([['calendar:user:user-1:2026-10', JSON.stringify([event])]]);
    const redis = {
      get: async key => cache.get(key),
      del: async key => cache.delete(key),
      set: async (key, value) => cache.set(key, value)
    };

    try {
      await calendarService.deleteEvent('user-1', event.id, redis);
      assert.deepEqual(query.mock.calls[0].arguments[1], ['reminder-1', 'user-1']);
      assert.equal(cache.has('calendar:user:user-1:2026-10'), false);

      query.mock.mockImplementation(async () => ({ rowCount: 0, rows: [] }));
      assert.deepEqual(await calendarService.getEvents('user-1', 10, 2026, redis), []);
    } finally {
      query.mock.restore();
    }
  });
}

test('a missing or other-user reminder returns 404 without invalidating the cache', async () => {
  const query = mock.method(pool, 'query', async () => ({ rowCount: 0, rows: [] }));
  const redis = { del: mock.fn() };

  try {
    await assert.rejects(calendarService.deleteEvent('user-1', 'missing', redis), { status: 404 });
    assert.match(query.mock.calls[0].arguments[0], /AND user_id = \$2/);
    assert.equal(redis.del.mock.callCount(), 0);
  } finally {
    query.mock.restore();
  }
});
