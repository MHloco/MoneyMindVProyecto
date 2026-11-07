const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const applicationPool = require('../config/db');
const service = require('./budget.services');

test('PostgreSQL rejects overlapping active budgets and accepts separate periods or categories', {
  skip: process.env.RUN_DB_TESTS !== '1',
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();
  const query = mock.method(applicationPool, 'query', client.query.bind(client));
  const redis = { del: async () => {} };
  try {
    await client.query('BEGIN');
    const user = randomUUID();
    await client.query(`INSERT INTO users (id,email,password_hash,full_name)
      VALUES ($1,$2,'test-only-no-login','Budget test')`, [user, `${user}@example.invalid`]);
    const categories = (await client.query(`INSERT INTO categories (user_id,name,type)
      VALUES ($1,'Ahorro de prueba','EXPENSE'),($1,'Mascota de prueba','EXPENSE') RETURNING id`, [user])).rows;
    const data = { categoryId: categories[0].id, name: 'Existing', amount: 800,
      periodStart: '2026-10-01', periodEnd: '2026-12-12' };
    const existing = await service.createBudget(user, data, redis);
    for (const [start, end] of [['2026-10-11', '2026-10-31'], ['2026-12-12', '2026-12-31']]) {
      await client.query('SAVEPOINT overlap');
      await assert.rejects(service.createBudget(user, { ...data, name: 'Overlapping',
        periodStart: start, periodEnd: end }, redis), { status: 409 });
      await client.query('ROLLBACK TO SAVEPOINT overlap');
    }
    assert.ok((await service.createBudget(user, { ...data,
      periodStart: '2026-12-13', periodEnd: '2026-12-31' }, redis)).id);
    assert.ok((await service.createBudget(user, { ...data, categoryId: categories[1].id }, redis)).id);
    await service.deleteBudget(user, existing.id, redis);
    assert.ok((await service.createBudget(user, data, redis)).id);
  } finally {
    query.mock.restore();
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
  }
});
