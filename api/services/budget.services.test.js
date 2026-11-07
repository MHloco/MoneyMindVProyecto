const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const service = require('./budget.services');

test('overlapping budgets return an actionable 409 without exposing PostgreSQL details', async () => {
  let invalidated = false;
  const query = mock.method(pool, 'query', async sql => {
    if (sql.includes('FROM categories')) return { rowCount: 1, rows: [{ id: 'category' }] };
    throw Object.assign(new Error('private database detail'), {
      code: '23P01', constraint: 'excl_budget_overlap',
    });
  });
  try {
    await assert.rejects(service.createBudget('user', { categoryId: 'category' }, {
      del: async () => { invalidated = true; },
    }), error => {
      assert.equal(error.status, 409);
      assert.match(error.message, /presupuesto activo/);
      assert.doesNotMatch(error.message, /excl_budget_overlap|private database/);
      return true;
    });
    assert.equal(invalidated, false);
  } finally {
    query.mock.restore();
  }
});

test('a valid budget is saved and invalidates only its account cache', async () => {
  const created = { id: 'new-budget' };
  const invalidated = [];
  const query = mock.method(pool, 'query', async sql => sql.includes('FROM categories')
    ? { rowCount: 1, rows: [{ id: 'category' }] }
    : { rowCount: 1, rows: [created] });
  try {
    assert.deepEqual(await service.createBudget('user', { categoryId: 'category' }, {
      del: async key => invalidated.push(key),
    }), created);
    assert.deepEqual(invalidated, ['budgets:user:user']);
  } finally {
    query.mock.restore();
  }
});
