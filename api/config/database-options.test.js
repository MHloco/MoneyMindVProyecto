const { test } = require('node:test');
const assert = require('node:assert/strict');
const { databaseOptions } = require('./database-options');

test('TLS verifies the server certificate and local PostgreSQL can opt out', () => {
  assert.equal(databaseOptions({ DB_SSL: 'true' }).ssl.rejectUnauthorized, true);
  assert.equal(databaseOptions({ DB_SSL: 'false' }).ssl, false);
});

test('URL parameters cannot silently disable certificate verification', () => {
  assert.throws(() => databaseOptions({ DATABASE_URL: 'postgres://user:pass@db/test?sslmode=no-verify', DB_SSL: 'true' }), /Configura TLS/);
});
