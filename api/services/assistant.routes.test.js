const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const jwt = require('jsonwebtoken');
const service = require('./assistant.services');
const router = require('../routes/assistant.routes');

test('all chat endpoints require JWT and controllers use its verified subject', async () => {
  const previous = process.env.JWT_ACCESS_SECRET;
  process.env.JWT_ACCESS_SECRET = 'assistant-route-test-secret';
  const app = express();
  app.use(express.json());
  app.use('/api/assistant', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const url = `http://127.0.0.1:${server.address().port}/api/assistant`;
  const send = mock.method(service, 'send', async (userId, body) => ({ userId, body }));
  const list = mock.method(service, 'list', async userId => ({ userId }));
  const detail = mock.method(service, 'detail', async userId => ({ userId }));
  const analyze = mock.method(service, 'analyze', async userId => ({ userId }));
  try {
    for (const [path, method] of [['/conversations', 'GET'], ['/conversations/anything', 'GET'], ['/messages', 'POST'], ['/analysis', 'POST']]) {
      assert.equal((await fetch(url + path, { method })).status, 401);
      assert.equal((await fetch(url + path, { method, headers: { Authorization: 'Bearer invalid' } })).status, 401);
    }
    assert.equal(send.mock.callCount() + list.mock.callCount() + detail.mock.callCount(), 0);
    const token = jwt.sign({ sub: 'verified-account' }, process.env.JWT_ACCESS_SECRET, { expiresIn: '1m' });
    const response = await fetch(url + '/messages?user_id=other-account', { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: 'Hola' }) });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get('cache-control'), 'no-store');
    assert.equal((await response.json()).userId, 'verified-account');
    const analysis = await fetch(url + '/analysis?user_id=other-account', { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{"agent":"all"}' });
    assert.equal((await analysis.json()).userId, 'verified-account');
    send.mock.mockImplementation(async () => { throw new Error('SQL contains private data'); });
    const failed = await fetch(url + '/messages', { method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(failed.status, 500);
    assert.doesNotMatch(await failed.text(), /SQL|private data/);
    const expired = jwt.sign({ sub: 'verified-account' }, process.env.JWT_ACCESS_SECRET, { expiresIn: -1 });
    assert.equal((await fetch(url + '/conversations', { headers: { Authorization: `Bearer ${expired}` } })).status, 401);
  } finally {
    send.mock.restore(); list.mock.restore(); detail.mock.restore(); analyze.mock.restore();
    await new Promise(resolve => server.close(resolve));
    if (previous === undefined) delete process.env.JWT_ACCESS_SECRET; else process.env.JWT_ACCESS_SECRET = previous;
  }
});
