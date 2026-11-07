const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { getGeminiConfig } = require('../config/gemini');

test('development reloads edited Gemini configuration and clears removed credentials', () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'moneymind-gemini-'));
  const file = path.join(directory, '.env');
  try {
    const env = { GEMINI_API_KEY: 'old-startup-key', GEMINI_MODEL: 'old-model' };
    fs.writeFileSync(file, 'GEMINI_API_KEY=\nGEMINI_MODEL=first-model\n');
    assert.equal(getGeminiConfig(env, file).apiKey, '');
    fs.writeFileSync(file, 'GEMINI_API_KEY=new-test-key\nGEMINI_MODEL=new-model\n');
    assert.deepEqual(getGeminiConfig(env, file), { apiKey: 'new-test-key', model: 'new-model' });
    assert.equal(env.GEMINI_API_KEY, 'old-startup-key', 'Does not mutate unrelated process configuration');
    fs.writeFileSync(file, 'GEMINI_API_KEY=\nGEMINI_MODEL=\n');
    assert.deepEqual(getGeminiConfig(env, file), { apiKey: '', model: 'gemini-3.5-flash-lite' });
  } finally {
    fs.unlinkSync(file);
    fs.rmdirSync(directory);
  }
});

test('production uses deployment environment and missing local files support environment-only configuration', () => {
  const missing = path.join(os.tmpdir(), 'moneymind-missing-' + require('node:crypto').randomUUID(), '.env');
  for (const NODE_ENV of ['production', 'development']) {
    assert.deepEqual(getGeminiConfig({ NODE_ENV, GEMINI_API_KEY: ' injected-key ', GEMINI_MODEL: ' injected-model ' }, missing),
      { apiKey: 'injected-key', model: 'injected-model' });
  }
});
