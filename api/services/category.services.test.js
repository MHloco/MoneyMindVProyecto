const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const pool = require('../config/db');
const service = require('./category.services');
const controller = require('../controllers/category.controller');

const category = {
  id: 'category-1', user_id: 'user-1', parent_id: 'system-parent',
  name: 'Comidas', type: 'EXPENSE', is_system: false, is_active: true
};

function makeRedis(entries = []) {
  const cache = new Map(entries);
  return {
    cache,
    get: async key => cache.get(key),
    set: async (key, value) => cache.set(key, value),
    del: async key => cache.delete(key)
  };
}

for (const action of ['create', 'update', 'delete']) {
  test(`${action} immediately refreshes the personal categories used by budgets`, async () => {
    const before = action === 'create' ? [] : [category];
    const after = action === 'delete' ? [] : [{ ...category, name: 'Nuevo nombre' }];
    const redis = makeRedis([
      ['categories:user-only:user-1:EXPENSE', JSON.stringify(before)],
      ['categories:user:user-2:EXPENSE', '[]'],
      ['categories:user:user-1:INCOME', '[]']
    ]);
    const results = [before];
    if (action === 'update') results.push([category]);
    results.push(action === 'delete' ? [category] : after, after);
    const query = mock.method(pool, 'query', async () => {
      const rows = results.shift();
      assert.ok(rows, 'unexpected database query');
      return { rowCount: rows.length, rows };
    });

    try {
      assert.deepEqual(await service.getUserCategories('user-1', 'EXPENSE', redis), before);
      if (action === 'create') {
        await service.createCategory('user-1', { name: 'Nuevo nombre', type: 'EXPENSE' }, redis);
      } else if (action === 'update') {
        await service.updateCategory('user-1', category.id, { name: 'Nuevo nombre' }, redis);
      } else {
        await service.deleteCategory('user-1', category.id, redis);
      }
      assert.equal(redis.cache.has('categories:user:user-1:EXPENSE'), false);
      assert.deepEqual(await service.getUserCategories('user-1', 'EXPENSE', redis), after);
      assert.deepEqual(query.mock.calls[0].arguments[1], ['EXPENSE', 'user-1']);
      assert.equal(redis.cache.has('categories:user:user-2:EXPENSE'), true);
      assert.equal(redis.cache.has('categories:user:user-1:INCOME'), true);
      assert.equal(results.length, 0);
    } finally {
      query.mock.restore();
    }
  });
}

test('personal categories include owned subcategories and exclude system and other-user categories', async () => {
  const redis = makeRedis([
    ['categories:user:user-1:EXPENSE', JSON.stringify([
      category,
      { ...category, id: 'system-parent', user_id: null, is_system: true },
      { ...category, id: 'other', user_id: 'user-2' }
    ])]
  ]);
  assert.deepEqual(await service.getUserCategories('user-1', 'EXPENSE', redis), [category]);
});

test('the controller uses the authenticated user, ignoring a supplied user_id', async () => {
  const getCategories = mock.method(service, 'getUserCategories', async () => [category]);
  const log = mock.method(console, 'log', () => {});
  const req = { user: { id: 'user-1' }, query: { type: 'EXPENSE', user_id: 'user-2' }, redis: {} };
  const res = { json: mock.fn() };
  const next = mock.fn();
  try {
    await controller.getUserCategories(req, res, next);
    assert.deepEqual(getCategories.mock.calls[0].arguments, ['user-1', 'EXPENSE', req.redis]);
    assert.deepEqual(res.json.mock.calls[0].arguments, [{ categories: [category] }]);
    assert.equal(next.mock.callCount(), 0);
  } finally {
    getCategories.mock.restore();
    log.mock.restore();
  }
});
