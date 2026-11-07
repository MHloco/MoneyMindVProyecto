const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const pool = require('../config/db');
const service = require('./admin.services');
const authService = require('./auth.services');

test('admin endpoints reject missing JWT, normal users, revoked roles and disabled/deleted accounts', async () => {
  const previous = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = 'admin-unit-test-secret';
  const app = express();
  app.use('/api/admin', require('../routes/admin.routes'));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/admin`;
  let allowed = false;
  const db = mock.method(pool, 'query', async (sql, params) => {
    assert.match(sql, /role = 'SUPERUSER' AND is_active = TRUE AND deleted_at IS NULL/);
    assert.deepEqual(params, ['00000000-0000-4000-8000-000000000001']);
    return { rowCount: allowed ? 1 : 0, rows: allowed ? [{ id: params[0], email: 'admin@example.invalid', full_name: 'Admin' }] : [] };
  });
  const stats = mock.method(service, 'summary', async () => ({ total: 3 }));
  const users = mock.method(service, 'users', async () => ({ users: [] }));
  const create = mock.method(service, 'createSuperuser', async actor => ({ actor }));
  // Even a signed role claim is insufficient without the current database permission.
  const token = jwt.sign({ sub: '00000000-0000-4000-8000-000000000001', role: 'SUPERUSER' }, process.env.JWT_ACCESS_SECRET);
  const headers = { Authorization: `Bearer ${token}` };
  try {
    for (const endpoint of ['/session', '/summary', '/users']) {
      assert.equal((await fetch(base + endpoint)).status, 401);
      assert.equal((await fetch(base + endpoint, { headers })).status, 403);
    }
    assert.equal(stats.mock.callCount() + users.mock.callCount(), 0);
    assert.equal((await fetch(base + '/superusers', { method: 'POST' })).status, 401);
    assert.equal((await fetch(base + '/superusers', { method: 'POST', headers })).status, 403);
    assert.equal(create.mock.callCount(), 0);
    allowed = true;
    const created = await fetch(base + '/superusers', { method: 'POST', headers });
    assert.equal(created.status, 201);
    assert.equal((await created.json()).actor, '00000000-0000-4000-8000-000000000001');
    const response = await fetch(base + '/summary', { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.deepEqual(await response.json(), { total: 3 });
    allowed = false;
    assert.equal((await fetch(base + '/summary', { headers })).status, 403);
    db.mock.mockImplementation(async () => { throw new Error('private database details'); });
    const failed = await fetch(base + '/summary', { headers });
    assert.equal(failed.status, 503);
    assert.doesNotMatch(await failed.text(), /private database/);
  } finally {
    mock.restoreAll(); await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = previous;
  }
});

test('admin login checks the password and current role; normal login returns its role', async () => {
  const previous = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = 'admin-login-test-secret';
  const account = { id: 'test-user', email: 'user@example.invalid', full_name: 'Test', role: 'USER',
    is_active: true, deleted_at: null, password_hash: await bcrypt.hash('test-password', 4) };
  const db = mock.method(pool, 'query', async () => ({ rowCount: 1, rows: [account] }));
  try {
    await assert.rejects(authService.loginUser(account.email, 'wrong', true), { status: 401 });
    await assert.rejects(authService.loginUser(account.email, 'test-password', true), { status: 403 });
    assert.equal((await authService.loginUser(account.email, 'test-password')).user.role, 'USER');
    account.role = 'SUPERUSER';
    const result = await authService.loginUser(account.email, 'test-password', true);
    assert.equal(result.user.role, 'SUPERUSER');
    assert.equal(result.user.password_hash, undefined);
    account.is_active = false;
    await assert.rejects(authService.loginUser(account.email, 'test-password', true), { status: 403 });
    account.is_active = true; account.deleted_at = new Date();
    await assert.rejects(authService.loginUser(account.email, 'test-password', true), { status: 403 });
  } finally {
    db.mock.restore();
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = previous;
  }
});

test('user listing validates filters and binds search, role, status and pagination', async () => {
  const calls = [];
  const db = mock.method(pool, 'query', async (sql, params) => {
    calls.push({ sql, params });
    return { rows: sql.includes('count(*)') ? [{ total: 0 }] : [] };
  });
  try {
    for (const query of [{ page: 0 }, { page: '1.5' }, { page: 1000001 }, { search: ['bad'] },
      { search: 'x'.repeat(121) }, { status: 'injected' }, { role: 'ADMIN' }]) {
      await assert.rejects(service.users(query), { status: 400 });
    }
    assert.equal(calls.length, 0);
    const result = await service.users({ page: '2', search: "x%' OR true --", role: 'USER', status: 'active' });
    assert.equal(result.page, 2);
    assert.equal(calls[1].params[3], 20);
    assert.equal(calls[0].params[0], "%x\\%' OR true --%");
    assert.doesNotMatch(calls[1].sql, /password_hash|SELECT \*|OR true/);
  } finally { db.mock.restore(); }
});

test('public registration rejects role injection and admin-only login is selected by the route', async () => {
  const app = express(); app.use(express.json()); app.use('/auth', require('../routes/auth.routes'));
  const server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/auth`;
  const register = mock.method(authService, 'registerUser', async (...args) => ({ args }));
  const login = mock.method(authService, 'loginUser', async (...args) => ({ args }));
  const body = JSON.stringify({ email: 'test@example.invalid', password: 'test-password', role: 'SUPERUSER', adminLogin: true });
  const options = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body };
  try {
    const registration = await fetch(base + '/register', options);
    assert.equal(registration.status, 400);
    assert.equal(register.mock.callCount(), 0);
    const normal = await fetch(base + '/register', { ...options,
      body: JSON.stringify({ email: 'test@example.invalid', password: 'test-password' }) });
    assert.deepEqual((await normal.json()).args, ['test@example.invalid', 'test-password']);
    assert.equal((await (await fetch(base + '/login', options)).json()).args[2], false);
    assert.equal((await (await fetch(base + '/admin/login', options)).json()).args[2], true);
    for (let i = 0; i < 8; i++) assert.equal((await fetch(base + '/admin/login', options)).status, 200);
    assert.equal((await fetch(base + '/admin/login', options)).status, 429);
    assert.equal((await fetch(base + '/login', options)).status, 429);
  } finally { register.mock.restore(); login.mock.restore(); await new Promise(resolve => server.close(resolve)); }
});

test('superuser creation validates input, hashes passwords and checks permission at the write', async () => {
  const body = { fullName: ' New Admin ', email: 'ADMIN@example.invalid ', password: 'long-test-password' };
  let params;
  const db = mock.method(pool, 'query', async (sql, values) => {
    assert.match(sql, /WHERE id = \$4 AND role = 'SUPERUSER' AND is_active = TRUE AND deleted_at IS NULL/);
    params = values;
    return { rowCount: 1, rows: [{ id: 'created', email: values[0], role: 'SUPERUSER' }] };
  });
  try {
    for (const invalid of [null, [], {}, { ...body, role: 'USER' }, { ...body, fullName: ' ' },
      { ...body, email: 'invalid' }, { ...body, password: 'short' }, { ...body, password: 'é'.repeat(37) }]) {
      await assert.rejects(service.createSuperuser('actor', invalid), { status: 400 });
    }
    assert.equal(db.mock.callCount(), 0);
    const created = await service.createSuperuser('actor', body);
    assert.deepEqual(params.filter((_, i) => i !== 1), ['admin@example.invalid', 'New Admin', 'actor']);
    assert.ok(await bcrypt.compare(body.password, params[1]));
    assert.equal(created.user.role, 'SUPERUSER');
    assert.doesNotMatch(JSON.stringify(created), /password/);
    db.mock.mockImplementation(async () => ({ rowCount: 0, rows: [] }));
    await assert.rejects(service.createSuperuser('revoked', body), { status: 403 });
    db.mock.mockImplementation(async () => { throw Object.assign(new Error('private SQL details'), { code: '23505' }); });
    await assert.rejects(service.createSuperuser('actor', body), { status: 409 });
  } finally { db.mock.restore(); }
});
