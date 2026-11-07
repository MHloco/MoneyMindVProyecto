const { test, mock, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const provider = require('./gemini.services');
const config = require('../config/gemini');

// Unit tests must never load a real credential from the development .env file.
beforeEach(context => {
  context.mock.method(config, 'getGeminiConfig', () => ({
    apiKey: process.env.GEMINI_API_KEY?.trim() || '',
    model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.5-flash-lite',
  }));
});

test('Gemini request scopes history, maps roles and parses text without thoughts', async () => {
  const previous = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'test-only-not-a-real-key';
  process.env.GEMINI_MODEL = 'gemini-test-model';
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-test-model:generateContent');
    assert.equal(options.headers['x-goog-api-key'], 'test-only-not-a-real-key');
    assert.equal(options.headers.Authorization, undefined);
    const body = JSON.parse(options.body);
    assert.equal(body.previous_response_id, undefined);
    assert.equal(body.tools, undefined);
    assert.equal(body.cachedContent, undefined);
    assert.match(body.systemInstruction.parts[0].text, /cuenta autenticada/);
    assert.equal(body.contents[1].role, 'model');
    assert.equal(body.contents[2].parts[0].text, 'Mi pregunta');
    assert.match(body.contents[0].parts[0].text, /own-data/);
    assert.equal(body.contents[0].parts[1].text, 'Pregunta anterior');
    assert.equal(body.contents[0].role, 'user');
    assert.equal(body.generationConfig.maxOutputTokens, 4096);
    return { ok: true, json: async () => ({ modelVersion: 'test-model',
      usageMetadata: { promptTokenCount: 12, candidatesTokenCount: 8, thoughtsTokenCount: 3 }, candidates: [
        { finishReason: 'STOP', content: { role: 'model', parts: [
          { thought: true, text: 'Private thought' }, { text: 'Primero' }, { text: 'Segundo' },
        ] } },
      ] }) };
  });
  try {
    const result = await provider.generateReply({ context: { marker: 'own-data' },
      history: [{ role: 'USER', content: 'Pregunta anterior' }, { role: 'ASSISTANT', content: 'Respuesta anterior' }], message: 'Mi pregunta' });
    assert.equal(result.content, 'Primero\nSegundo');
    assert.equal(result.tokensInput + result.tokensOutput, 23);
    assert.equal(result.model, 'test-model');
  } finally {
    fetchMock.mock.restore();
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = previousModel;
  }
});

test('first turn combines context and question and defaults to the configured Gemini model', async () => {
  const previous = process.env.GEMINI_API_KEY;
  const previousModel = process.env.GEMINI_MODEL;
  process.env.GEMINI_API_KEY = 'test-only';
  delete process.env.GEMINI_MODEL;
  const fetchMock = mock.method(globalThis, 'fetch', async (url, options) => {
    assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent');
    const { contents } = JSON.parse(options.body);
    assert.equal(contents.length, 1);
    assert.equal(contents[0].role, 'user');
    assert.match(contents[0].parts[0].text, /first-context/);
    assert.equal(contents[0].parts[1].text, 'Hola');
    return { ok: true, json: async () => ({ candidates: [{ finishReason: 'STOP', content: { parts: [{ text: 'Hola' }] } }] }) };
  });
  try {
    const result = await provider.generateReply({ context: { marker: 'first-context' }, history: [], message: 'Hola' });
    assert.equal(result.content, 'Hola');
    assert.equal(result.model, 'gemini-3.5-flash-lite');
    assert.equal(result.tokensInput + result.tokensOutput, 0);
  } finally {
    fetchMock.mock.restore();
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
    if (previousModel === undefined) delete process.env.GEMINI_MODEL; else process.env.GEMINI_MODEL = previousModel;
  }
});

test('missing key makes no network request and provider errors are sanitized', async () => {
  const previous = process.env.GEMINI_API_KEY;
  const fetchMock = mock.method(globalThis, 'fetch', async () => ({ ok: false, status: 401,
    json: async () => ({ error: { message: 'secret-key-and-private-data' } }) }));
  const input = { context: {}, history: [], message: 'Hola' };
  try {
    delete process.env.GEMINI_API_KEY;
    await assert.rejects(provider.generateReply(input), { status: 503 });
    assert.equal(fetchMock.mock.callCount(), 0);
    process.env.GEMINI_API_KEY = 'test-only';
    await assert.rejects(provider.generateReply(input), error => error.status === 502 && !error.message.includes('secret'));
    fetchMock.mock.mockImplementation(async () => { throw Object.assign(new Error('timeout'), { name: 'TimeoutError' }); });
    await assert.rejects(provider.generateReply(input), { status: 504 });
    fetchMock.mock.mockImplementation(async () => ({ ok: false, status: 429 }));
    await assert.rejects(provider.generateReply(input), { status: 503 });
    fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ candidates: [] }) }));
    await assert.rejects(provider.generateReply(input), { status: 502 });
    for (const finishReason of ['MAX_TOKENS', 'SAFETY']) {
      fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ candidates: [
        { finishReason, content: { parts: [{ text: 'Incomplete or blocked content' }] } },
      ] }) }));
      await assert.rejects(provider.generateReply(input), { status: 502 });
    }
    fetchMock.mock.mockImplementation(async () => ({ ok: true, json: async () => ({ promptFeedback: { blockReason: 'SAFETY' } }) }));
    await assert.rejects(provider.generateReply(input), { status: 502 });
  } finally {
    fetchMock.mock.restore();
    if (previous === undefined) delete process.env.GEMINI_API_KEY; else process.env.GEMINI_API_KEY = previous;
  }
});
