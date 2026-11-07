const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createAssistantService } = require('./assistant.services');
const provider = require('./ai-service.client');
const { getAgentContext } = require('./agent-context');

test('Node -> FastAPI -> agents -> PostgreSQL: account isolation, persisted reports, deduplicated alerts and rollback', {
  skip: process.env.RUN_AI_TESTS !== '1', timeout: 30000,
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();
  const query = client.query.bind(client);
  const db = { query, connect: async () => ({ release() {}, query: (sql, params) => query({
    BEGIN: 'SAVEPOINT agent_call', COMMIT: 'RELEASE SAVEPOINT agent_call', ROLLBACK: 'ROLLBACK TO SAVEPOINT agent_call',
  }[sql] || sql, params) }) };
  const service = createAssistantService(db, provider);
  try {
    await query('BEGIN');
    const a = randomUUID(), b = randomUUID();
    for (const id of [a, b]) await query(`INSERT INTO users (id,email,password_hash,full_name)
      VALUES ($1,$2,'test-only-no-login','Agent test')`, [id, `${id}@example.invalid`]);
    const today = (await query("SELECT to_char(now() AT TIME ZONE 'America/Lima','YYYY-MM-DD') AS today")).rows[0].today;
    await query(`INSERT INTO transactions (user_id,type,amount,description,transaction_date)
      VALUES ($1,'INCOME',1000,'A income',$3),($1,'EXPENSE',200,'A high expense',$3),
        ($2,'EXPENSE',99999,'PRIVATE_B',$3)`, [a, b, today]);
    await query(`INSERT INTO transactions (user_id,type,amount,description,transaction_date)
      SELECT $1,'EXPENSE',10,'Historical baseline',$2::date-n FROM generate_series(6,10) AS n`, [a, today]);
    await query(`INSERT INTO transactions (user_id,type,amount,currency,description,transaction_date,deleted_at)
      VALUES ($1,'INCOME',25,'USD','Other currency',$2,NULL),($1,'EXPENSE',9999,'PEN','Deleted',$2,now())`, [a, today]);
    await query(`INSERT INTO budgets (user_id,name,amount,period_start,period_end)
      VALUES ($1,'A budget',100,date_trunc('month',$2::date),$2::date+30)`, [a, today]);
    const obligation = (await query(`INSERT INTO obligations (user_id,name,total_amount,start_date)
      VALUES ($1,'A obligation',50,$2) RETURNING id`, [a, today])).rows[0];
    await query(`INSERT INTO obligation_installments (obligation_id,number,due_date,amount)
      VALUES ($1,1,$2,50)`, [obligation.id, today]);
    await query(`INSERT INTO recurring_transactions (user_id,type,description,amount,start_date,next_occurrence_date,frequency,end_date)
      VALUES ($1,'EXPENSE','A recurring',10,$2,$2::date+1,'DAILY',$2::date+2)`, [a, today]);
    const context = await getAgentContext(db, a, { today, currency: 'PEN' });
    assert.doesNotMatch(JSON.stringify(context), /PRIVATE_B|99999|9999/);
    assert.equal(context.totals.find(t => t.currency === 'PEN').recorded_balance, '750.00');
    assert.equal(context.totals.find(t => t.currency === 'USD').recorded_balance, '25.00');
    const limited = await getAgentContext(db, a, { today, currency: 'PEN' }, 'budgets');
    assert.equal(limited.expenses, undefined);
    assert.equal(limited.totals, undefined);

    const first = await service.analyze(a, { agent: 'all' });
    assert.equal(first.analysis.results.length, 5);
    assert.equal(first.usage.used, 1);
    assert.ok(first.alertsCreated >= 3);
    assert.equal(first.analysis.results.find(r => r.agent === 'anomalies').findings.length, 1);
    const stored = await service.detail(a, first.conversation.id);
    assert.equal(stored.messages[1].tool_calls[0].results.length, 5);
    const alerts = (await query("SELECT id,metadata FROM alerts WHERE user_id=$1 AND metadata->>'producer'='moneymind-agents-v1'", [a])).rows;
    assert.ok(alerts.some(a => a.metadata.origin === 'rule'));
    assert.ok(alerts.some(a => a.metadata.origin === 'analysis'));
    await query("UPDATE alerts SET status='READ',read_at=now() WHERE id=$1", [alerts[0].id]);
    const second = await service.analyze(a, { agent: 'all' });
    assert.equal(second.alertsCreated, 0);
    assert.equal((await query('SELECT status FROM alerts WHERE id=$1', [alerts[0].id])).rows[0].status, 'READ');
    await assert.rejects(service.analyze(a, { agent: 'sql' }), { status: 400 });
    await assert.rejects(service.analyze(a, { user_id: b }), { status: 400 });
    await assert.rejects(service.detail(b, first.conversation.id), { status: 404 });
    assert.equal((await query('SELECT COUNT(*)::int AS count FROM alerts WHERE user_id=$1', [b])).rows[0].count, 0);

    const failing = createAssistantService(db, { ...provider, analyze: async () => { throw Object.assign(new Error('Unavailable'), { status: 503 }); } });
    await assert.rejects(failing.analyze(a, { agent: 'all' }), { status: 503 });
    assert.equal((await service.list(a)).usage.used, 2);
    assert.equal((await service.list(a)).conversations.length, 2);

    // Disabled preferences suppress deterministic alert inserts for a different account.
    await query(`INSERT INTO budgets (user_id,name,amount,period_start,period_end)
      VALUES ($1,'B budget',1,$2,$2::date+30)`, [b, today]);
    await query(`INSERT INTO alert_preferences (user_id,type,is_enabled) VALUES ($1,'BUDGET_EXCEEDED',false)`, [b]);
    assert.equal((await service.analyze(b, { agent: 'budgets' })).alertsCreated, 0);
    await query('UPDATE users SET is_active=false WHERE id=$1', [a]);
    await assert.rejects(service.analyze(a, { agent: 'all' }), { status: 401 });
  } finally {
    await query('ROLLBACK'); client.release(); await pool.end();
  }
});
