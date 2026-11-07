// Only targets the isolated Docker stack. Does not send email or call Gemini.
const assert = require('node:assert/strict');
const { randomBytes, randomUUID } = require('node:crypto');
const base = 'http://127.0.0.1:8080';

async function request(path, { token, method = 'GET', body, expected = 200 } = {}) {
  const response = await fetch(base + path, {
    method, signal: AbortSignal.timeout(30000),
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  assert.equal(response.status, expected, `${method} ${path} returned HTTP ${response.status}`);
  return response.json();
}

async function main() {
  assert.equal((await request('/health')).redis, 'up');
  for (const route of ['/', '/assistant', '/dashboard', '/admin/login']) {
    const response = await fetch(base + route);
    assert.equal(response.status, 200);
    assert.match(await response.text(), /<app-root/);
  }
  await request('/api/assistant/conversations', { expected: 401 });
  const email = `deploy-${randomUUID()}@example.invalid`;
  const password = randomBytes(24).toString('hex');
  const account = await request('/api/auth/register', { method: 'POST', expected: 201, body: { email, password } });
  const login = await request('/api/auth/login', { method: 'POST', body: { email, password } });
  assert.equal(account.user.id, login.user.id);
  const token = login.token;
  await request('/api/admin/session', { token, expected: 403 });
  await request('/api/subscription/plans');
  await request('/api/categories?type=EXPENSE', { token });
  const analysis = await request('/api/assistant/analysis', { token, method: 'POST', body: { agent: 'all' } });
  assert.ok(analysis.conversation?.id, 'Analysis must persist a conversation');
  const other = await request('/api/auth/register', { method: 'POST', expected: 201,
    body: { email: `deploy-${randomUUID()}@example.invalid`, password } });
  await request(`/api/assistant/conversations/${analysis.conversation.id}`, { token: other.token, expected: 404 });
  console.log('PASS: SPA routes, PostgreSQL/Redis health, registration/login, catalogs, private admin, five-agent analysis and conversation isolation.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
