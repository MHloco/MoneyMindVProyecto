const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const pool = require('../config/db');
const service = require('./admin.services');
const requireAdmin = require('../middleware/admin.middleware');
const bcrypt = require('bcrypt');
const authService = require('./auth.services');

test('PostgreSQL: default roles, metrics, literal search, pagination and immediate role revocation', {
  skip: process.env.RUN_DB_TESTS !== '1',
}, async () => {
  const client = await pool.connect();
  const db = mock.method(pool, 'query', client.query.bind(client));
  const marker = randomUUID();
  const ids = [];
  try {
    await client.query('BEGIN');
    const before = await service.summary();
    for (let index = 0; index < 22; index++) {
      const inserted = await client.query(`INSERT INTO users (email,password_hash,full_name)
        VALUES ($1,'not-a-password',$2) RETURNING id,role`, [`${marker}-${index}@example.invalid`, marker + (index === 0 ? ' %_' : '')]);
      assert.equal(inserted.rows[0].role, 'USER'); ids.push(inserted.rows[0].id);
    }
    await client.query("UPDATE users SET role='SUPERUSER', last_login_at=now(), email_verified_at=now() WHERE id=$1", [ids[0]]);
    await client.query('UPDATE users SET is_active=false WHERE id=$1', [ids[1]]);
    await client.query('UPDATE users SET deleted_at=now() WHERE id=$1', [ids[2]]);
    const after = await service.summary();
    assert.equal(after.total - before.total, 21); assert.equal(after.active - before.active, 20);
    assert.equal(after.inactive - before.inactive, 1); assert.equal(after.deleted - before.deleted, 1);
    assert.equal(after.superusers - before.superusers, 1); assert.equal(after.verified - before.verified, 1);
    assert.equal(after.recent_logins - before.recent_logins, 1);
    const first = await service.users({ search: marker });
    const second = await service.users({ search: marker, page: 2 });
    assert.equal(first.total, 22); assert.equal(first.users.length, 20); assert.equal(second.users.length, 2);
    assert.equal(new Set([...first.users, ...second.users].map(u => u.id)).size, 22);
    assert.equal((await service.users({ search: marker + ' %_' })).total, 1);
    assert.equal((await service.users({ search: marker, status: 'active' })).total, 20);
    assert.equal((await service.users({ search: marker, role: 'SUPERUSER' })).total, 1);
    assert.ok(first.users.every(u => !('password_hash' in u)));
    async function access() {
      let status = 200; let nextCalled = false;
      await requireAdmin({ user: { id: ids[0] } }, { set() {}, status(code) { status = code; return this; }, json() {} }, () => { nextCalled = true; });
      return { status, nextCalled };
    }
    assert.deepEqual(await access(), { status: 200, nextCalled: true });
    // Real creation, duplicates and public registration stay inside this rolled-back transaction.
    const body = { fullName: 'Created administrator', email: `${marker}-admin@example.invalid`, password: 'long-test-password' };
    const created = await service.createSuperuser(ids[0], body);
    assert.equal(created.user.role, 'SUPERUSER');
    const stored = (await client.query('SELECT password_hash FROM users WHERE id=$1', [created.user.id])).rows[0];
    assert.ok(await bcrypt.compare(body.password, stored.password_hash));
    await client.query('SAVEPOINT duplicate_account');
    await assert.rejects(service.createSuperuser(ids[0], { ...body, email: body.email.toUpperCase() }), { status: 409 });
    await client.query('ROLLBACK TO SAVEPOINT duplicate_account');
    await assert.rejects(service.createSuperuser(ids[3], { ...body, email: `${marker}-denied@example.invalid` }), { status: 403 });
    const previousSecret = process.env.JWT_ACCESS_SECRET;
    process.env.JWT_ACCESS_SECRET = 'registration-test-secret';
    try {
      const registered = await authService.registerUser(`${marker}-public@example.invalid`, 'public-password');
      assert.equal(registered.user.role, 'USER');
      const row = (await client.query('SELECT role FROM users WHERE id=$1', [registered.user.id])).rows[0];
      assert.equal(row.role, 'USER');
    } finally {
      if (previousSecret === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = previousSecret;
    }
    await client.query("UPDATE users SET role='USER' WHERE id=$1", [ids[0]]);
    assert.deepEqual(await access(), { status: 403, nextCalled: false });
    await client.query("UPDATE users SET role='SUPERUSER', is_active=false WHERE id=$1", [ids[0]]);
    assert.equal((await access()).status, 403);
    await client.query('UPDATE users SET is_active=true, deleted_at=now() WHERE id=$1', [ids[0]]);
    assert.equal((await access()).status, 403);
  } finally {
    await client.query('ROLLBACK'); db.mock.restore(); client.release(); await pool.end();
  }
});
