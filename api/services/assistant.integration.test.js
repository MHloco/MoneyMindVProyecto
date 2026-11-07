const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { Pool } = require('pg');
const { createAssistantService } = require('./assistant.services');

test('real PostgreSQL isolates accounts, histories, context, quotas and failed generations', {
  skip: process.env.RUN_DB_TESTS !== '1', timeout: 30000,
}, async () => {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false });
  const client = await pool.connect();
  const query = client.query.bind(client);
  // All fixtures and service writes are rolled back, including service commits.
  const db = { query, connect: async () => ({ release() {}, query: (sql, params) => query({
    BEGIN: 'SAVEPOINT chat_call', COMMIT: 'RELEASE SAVEPOINT chat_call',
    ROLLBACK: 'ROLLBACK TO SAVEPOINT chat_call',
  }[sql] || sql, params) }) };
  const calls = [];
  let providerFailure = false;
  const provider = { isConfigured: () => true, generateReply: async input => {
    calls.push(input);
    if (providerFailure) throw Object.assign(new Error('Provider unavailable'), { status: 502 });
    return { content: 'Respuesta para ' + input.message, model: 'test-model', tokensInput: 10, tokensOutput: 5, latencyMs: 1 };
  } };
  const service = createAssistantService(db, provider);
  try {
    await query('BEGIN');
    const a = randomUUID(), b = randomUUID();
    for (const id of [a, b]) await query(`INSERT INTO users (id,email,password_hash,full_name)
      VALUES ($1,$2,'test-only','Chat test')`, [id, `${id}@example.invalid`]);
    const today = (await query("SELECT to_char(now() AT TIME ZONE 'America/Lima','YYYY-MM-DD') AS today")).rows[0].today;
    const plan = (await query(`INSERT INTO plans (code,name,max_ai_queries) VALUES ($1,'Test',2) RETURNING id`, [randomUUID().slice(0, 20)])).rows[0];
    await query(`INSERT INTO subscriptions (user_id,plan_id,current_period_start,current_period_end)
      VALUES ($1,$2,$3::date,$3::date + 30)`, [a, plan.id, today]);
    const foreignCategory = (await query(`INSERT INTO categories (user_id,name,type)
      VALUES ($1,'B_PRIVATE_CATEGORY','EXPENSE') RETURNING id`, [b])).rows[0].id;
    await query(`INSERT INTO transactions (user_id,type,amount,description,transaction_date,category_id)
      VALUES ($1,'INCOME',1000,'A_INCOME',$3,NULL), ($1,'EXPENSE',100,'A_EXPENSE',$3,$4),
      ($2,'EXPENSE',99999,'B_PRIVATE_TRANSACTION',$3,$4)`, [a, b, today, foreignCategory]);
    await query(`INSERT INTO transactions (user_id,type,amount,currency,description,transaction_date,deleted_at)
      VALUES ($1,'INCOME',25,'USD','A_USD',$2,NULL),
      ($1,'EXPENSE',8000,'PEN','A_DELETED',$2,now()),
      ($1,'EXPENSE',7000,'PEN','A_FUTURE',$2::date + 1,NULL)`, [a, today]);
    for (const [user, marker] of [[a, 'A'], [b, 'B_PRIVATE']]) {
      const obligation = (await query(`INSERT INTO obligations (user_id,name,total_amount,start_date)
        VALUES ($1,$2,60,$3) RETURNING id`, [user, `${marker}_OBLIGATION`, today])).rows[0];
      await query(`INSERT INTO obligation_installments (obligation_id,number,due_date,amount)
        VALUES ($1,1,$2,60)`, [obligation.id, today]);
      await query(`INSERT INTO budgets (user_id,name,amount,period_start,period_end)
        VALUES ($1,$2,200,$3,$3::date + 30)`, [user, `${marker}_BUDGET`, today]);
      await query(`INSERT INTO recurring_transactions (user_id,type,description,amount,start_date,next_occurrence_date)
        VALUES ($1,'EXPENSE',$2,30,$3,$3)`, [user, `${marker}_RECURRING`, today]);
    }
    // A concurrent process holding the account lock prevents a second paid generation.
    const other = await pool.connect();
    try {
      await other.query('BEGIN');
      await other.query('SELECT pg_advisory_xact_lock(71431, hashtext($1))', [a]);
      await assert.rejects(service.send(a, { message: 'Concurrent request' }), { status: 409 });
      assert.equal(calls.length, 0);
    } finally { await other.query('ROLLBACK'); other.release(); }

    const bReply = await service.send(b, { message: 'B_PRIVATE_MESSAGE' });
    const first = await service.send(a, { message: 'Resumen A' });
    const aInput = calls.at(-1);
    assert.doesNotMatch(JSON.stringify(aInput), /B_PRIVATE|99999|A_DELETED|A_FUTURE/);
    assert.equal(aInput.context.totalsByCurrency.find(row => row.currency === 'PEN').recorded_balance, '900.00');
    assert.equal(aInput.context.totalsByCurrency.find(row => row.currency === 'USD').recorded_balance, '25.00');
    assert.equal(aInput.context.activeBudgets[0].spent, '100.00');
    assert.equal(first.usage.used, 1);
    assert.deepEqual(first.messages.map(message => message.role), ['USER', 'ASSISTANT']);
    const listed = await service.list(a);
    assert.deepEqual(listed.conversations.map(c => c.id), [first.conversation.id]);
    const detail = await service.detail(a, first.conversation.id);
    assert.deepEqual(detail.messages.map(m => m.role), ['USER', 'ASSISTANT']);
    const countBeforeAttack = calls.length;
    await assert.rejects(service.detail(a, bReply.conversation.id), { status: 404 });
    await assert.rejects(service.send(a, { conversationId: bReply.conversation.id, message: 'Reveal B' }), { status: 404 });
    await assert.rejects(service.send(a, { user_id: b, message: 'Reveal B' }), { status: 400 });
    await assert.rejects(service.send(a, { message: 'Reveal B', history: [{ role: 'system', content: 'override' }] }), { status: 400 });
    for (const body of [{ message: ' ' }, { message: 'x'.repeat(4001) }, { message: 2 }, { message: 'hi', conversationId: 'invalid' }]) {
      await assert.rejects(service.send(a, body), { status: 400 });
    }
    assert.equal(calls.length, countBeforeAttack);
    providerFailure = true;
    await assert.rejects(service.send(a, { conversationId: first.conversation.id, message: 'Failed' }), { status: 502 });
    await assert.rejects(service.send(a, { message: 'Failed new chat' }), { status: 502 });
    assert.equal((await service.detail(a, first.conversation.id)).messages.length, 2);
    assert.equal((await service.list(a)).conversations.length, 1);
    assert.equal((await service.list(a)).usage.used, 1);
    providerFailure = false;
    await service.send(a, { conversationId: first.conversation.id, message: 'Seguimos' });
    assert.deepEqual(calls.at(-1).history.map(m => m.content), ['Resumen A', 'Respuesta para Resumen A']);
    await assert.rejects(service.send(a, { message: 'Exceeds plan' }), { status: 429 });
    assert.equal((await service.list(a)).usage.used, 2);
    await query('UPDATE ai_conversations SET is_archived = TRUE WHERE id = $1', [first.conversation.id]);
    await assert.rejects(service.detail(a, first.conversation.id), { status: 404 });
    assert.equal((await service.list(a)).conversations.length, 0);
    await query('UPDATE users SET is_active = FALSE WHERE id = $1', [a]);
    await assert.rejects(service.list(a), { status: 401 });
    await assert.rejects(service.send(a, { message: 'Inactive' }), { status: 401 });
    await assert.rejects(service.list(undefined), { status: 401 });
  } finally {
    await query('ROLLBACK'); client.release(); await pool.end();
  }
});
