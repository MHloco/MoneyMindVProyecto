const { test } = require('node:test');
const assert = require('node:assert/strict');
const { clearExpenseCache } = require('./expense-cache');

test('expense changes invalidate lists and graphs only for their owner', async () => {
  const cache = new Set([
    'expenses:user:owner:page-1',
    'expense-distribution:user:owner:2026-10',
    'expense-distribution:user:other:2026-10'
  ]);
  const redis = {
    async *scanIterator({ MATCH }) {
      yield [...cache].filter(key => key.startsWith(MATCH.slice(0, -1)));
      yield [];
    },
    async del(keys) { keys.forEach(key => cache.delete(key)); }
  };
  await clearExpenseCache('owner', redis);
  assert.deepEqual([...cache], ['expense-distribution:user:other:2026-10']);
});
