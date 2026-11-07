// Payments create expenses too, so they must invalidate the same user caches.
async function clearExpenseCache(userId, redis) {
  if (!redis) return;
  for (const prefix of ['expenses', 'expense-distribution']) {
    for await (const batch of redis.scanIterator({ MATCH: `${prefix}:user:${userId}:*`, COUNT: 100 })) {
      const keys = Array.isArray(batch) ? batch : [batch];
      if (keys.length) await redis.del(keys);
    }
  }
}

module.exports = { clearExpenseCache };
