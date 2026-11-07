const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');

// RUN_DB_TESTS=1 node --env-file=.env --test services/*.test.js
// All writes remain inside a rolled-back transaction.
test('income and installment payments work with the actual PostgreSQL schema', {
  skip: process.env.RUN_DB_TESTS !== '1'
}, async () => {
  require('dotenv').config({ quiet: true });
  const pool = require('../config/db');
  const obligations = require('./obligation.services');
  const incomes = require('./income.services');
  const client = await pool.connect();
  const query = client.query.bind(client);
  const connectMock = mock.method(pool, 'connect', async () => ({
    query: (sql, params) => query({
      BEGIN: 'SAVEPOINT service_call',
      COMMIT: 'RELEASE SAVEPOINT service_call',
      ROLLBACK: 'ROLLBACK TO SAVEPOINT service_call'
    }[sql] || sql, params),
    release() {}
  }));
  const queryMock = mock.method(pool, 'query', query);
  try {
    await query('BEGIN');
    const user = (await query('SELECT id FROM users LIMIT 1')).rows[0];
    assert.ok(user, 'A local test database with at least one user is required');
    const obligation = await obligations.createObligation(user.id, {
      name: 'Payment regression (rolled back)', total_amount: 100,
      installments_count: 3, start_date: '2026-01-31', due_day: 31
    });
    const installments = (await query('SELECT *, due_date::text AS date_text FROM obligation_installments WHERE obligation_id=$1 ORDER BY number', [obligation.id])).rows;
    assert.deepEqual(installments.map(i => i.amount), ['33.34', '33.33', '33.33']);
    assert.deepEqual(installments.map(i => i.date_text), ['2026-01-31', '2026-02-28', '2026-03-31']);
    for (const amount of [0, -1, 34, 'NaN', 0.001, null, true, {}]) {
      await assert.rejects(obligations.payInstallment(user.id, installments[0].id, { amount }), { status: 400 });
    }
    await assert.rejects(obligations.payInstallment(randomUUID(), installments[0].id, { amount: 1 }), { status: 404 });
    const invalidated = [];
    const paymentCache = {
      async *scanIterator({ MATCH }) { yield [MATCH.replace('*', 'cached')]; },
      async del(keys) { invalidated.push(...keys); }
    };
    const partial = await obligations.payInstallment(user.id, installments[0].id, { amount: 0.01, payment_method: 'YAPE', notes: 'Operación de prueba' }, paymentCache);
    assert.equal(partial.status, 'PARTIAL');
    assert.deepEqual(invalidated, [`expenses:user:${user.id}:cached`, `expense-distribution:user:${user.id}:cached`]);
    const transaction = (await query('SELECT payment_method, notes FROM transactions WHERE id=$1', [partial.transaction_id])).rows[0];
    assert.equal(transaction.payment_method, 'WALLET');
    assert.match(transaction.notes, /Yape/);
    const full = await obligations.payInstallment(user.id, installments[0].id, { amount: 33.33, payment_method: 'BANK_TRANSFER' });
    assert.equal(full.status, 'PAID');
    assert.equal(full.paid_amount, 33.34);
    await assert.rejects(obligations.payInstallment(user.id, installments[0].id, { amount: 1 }), { status: 409 });
    await obligations.payInstallment(user.id, installments[1].id, { payment_method: 'PLIN' });
    await obligations.payInstallment(user.id, installments[2].id, { payment_method: 'CASH' });
    const paid = (await query('SELECT status, paid_amount FROM obligations WHERE id=$1', [obligation.id])).rows[0];
    assert.deepEqual(paid, { status: 'PAID', paid_amount: '100.00' });
    for (const method of ['CASH', 'CREDIT_CARD', 'DEBIT_CARD', 'BANK_TRANSFER', 'TRANSFER', 'YAPE', 'PLIN', 'WALLET', 'OTHER']) {
      const data = { amount: 1.25, transaction_date: '2026-10-03', payment_method: method, source: 'Regression (rolled back)' };
      const income = await incomes.createIncome(user.id, data);
      const updated = await incomes.updateIncome(user.id, income.id, { ...data, amount: 2.50 });
      assert.equal(updated.amount, '2.50');
      await incomes.deleteIncome(user.id, income.id);
    }
    await assert.rejects(incomes.createIncome(user.id, { amount: -1 }), { status: 400 });

    const dashboardService = require('./dashboard.services');
    const before = await dashboardService.getDashboardData(user.id);
    const currency = before.user.currency;
    await query(`INSERT INTO transactions (user_id, type, amount, currency, description, transaction_date)
      VALUES ($1, 'INCOME', 25, $2, 'Dashboard regression', CURRENT_DATE),
        ($1, 'EXPENSE', 10, $2, 'Dashboard regression', CURRENT_DATE),
        ($1, 'INCOME', 900, $2, 'Future excluded', CURRENT_DATE + 1),
        ($1, 'INCOME', 500, $3, 'Other currency excluded', CURRENT_DATE)`,
    [user.id, currency, currency === 'PEN' ? 'USD' : 'PEN']);
    const after = await dashboardService.getDashboardData(user.id);
    assert.equal(after.financial.flujoMensual.length, 12);
    assert.equal(after.financial.ingresos - before.financial.ingresos, 25);
    assert.equal(after.financial.gastos - before.financial.gastos, 10);
    assert.equal(after.financial.balanceTotal - before.financial.balanceTotal, 15);
    assert.equal(after.financial.flujoMensual.at(-1).ingresos - before.financial.flujoMensual.at(-1).ingresos, 25);
    assert.equal(after.financial.flujoMensual.at(-1).gastos - before.financial.flujoMensual.at(-1).gastos, 10);
    assert.ok(after.financial.movimientos.every(movement => ['INCOME', 'EXPENSE'].includes(movement.tipo)));
    await assert.rejects(dashboardService.getDashboardData(randomUUID()), { status: 404 });

    const subscriptions = require('./subscription.services');
    const cache = new Map();
    const redis = {
      get: async key => cache.get(key),
      setEx: async (key, ttl, value) => cache.set(key, value),
      del: async key => cache.delete(key)
    };
    const plans = await subscriptions.getPlans(redis);
    assert.ok(plans.some(plan => plan.code === 'FREE'));
    assert.ok(plans.some(plan => plan.code === 'PRO'));
    // A fresh user exercises the no-subscription screen and activation path.
    const testUser = (await query(`INSERT INTO users (email, password_hash, full_name)
      VALUES ($1, 'test-only-no-login', 'Subscription regression') RETURNING id`,
    [`regression-${randomUUID()}@example.invalid`])).rows[0];
    assert.equal(await subscriptions.getSubscription(testUser.id, redis), null);
    const activated = await subscriptions.changePlan(testUser.id, 'FREE', redis);
    assert.equal(activated.plan_code, 'FREE');
    const changed = await subscriptions.changePlan(testUser.id, 'PRO', redis);
    assert.equal(changed.plan_code, 'PRO');
    assert.equal(changed.status, 'ACTIVE');
    await subscriptions.cancelSubscription(testUser.id, redis);
    assert.ok((await subscriptions.getSubscription(testUser.id, redis)).cancelled_at);
    await subscriptions.reactivateSubscription(testUser.id, redis);
    assert.equal((await subscriptions.getSubscription(testUser.id, redis)).cancelled_at, null);

    await query(`INSERT INTO transactions (user_id, type, amount, currency, description, transaction_date)
      SELECT $1, 'EXPENSE', 2, 'PEN', 'Interactive dashboard', '2024-02-29'::date FROM generate_series(1, 21)`, [testUser.id]);
    await query(`INSERT INTO transactions (user_id, type, amount, currency, description, transaction_date)
      VALUES ($1, 'INCOME', 100, 'PEN', 'Monthly income', '2024-02-01'),
        ($1, 'EXPENSE', 900, 'PEN', 'Outside month', '2024-03-01'),
        ($1, 'EXPENSE', 500, 'USD', 'Other currency', '2024-02-01')`, [testUser.id]);
    const historical = await dashboardService.getDashboardData(testUser.id, { month: '2024-02', type: 'EXPENSE', category: 'uncategorized', page: 2 });
    assert.equal(historical.period.end, '2024-02-29');
    assert.equal(historical.financial.gastos, 42);
    assert.equal(historical.financial.ingresos, 100);
    assert.equal(historical.financial.balanceTotal, 58);
    assert.equal(historical.financial.gastosCategorias[0].total, 42);
    assert.equal(historical.financial.flujoMensual.at(-1).gastos, 42);
    assert.deepEqual(historical.financial.pagination, { page: 2, total: 21, totalPages: 3 });
    assert.equal(historical.financial.movimientos.length, 10);
    assert.ok(historical.financial.movimientos.every(m => m.tipo === 'EXPENSE' && m.monto === -2));
    const lastPage = await dashboardService.getDashboardData(testUser.id, { month: '2024-02', type: 'EXPENSE', page: 99 });
    assert.equal(lastPage.financial.pagination.page, 3);
    assert.equal(lastPage.financial.movimientos.length, 1);
    const empty = await dashboardService.getDashboardData(testUser.id, { month: '2024-01' });
    assert.equal(empty.financial.pagination.total, 0);
    assert.equal(empty.financial.flujoMensual.length, 12);
    assert.equal(empty.financial.balanceTotal, 0);
  } finally {
    await query('ROLLBACK');
    connectMock.mock.restore();
    queryMock.mock.restore();
    client.release();
    await pool.end();
  }
});
