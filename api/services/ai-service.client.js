const fs = require('node:fs');
const path = require('node:path');
const dotenv = require('dotenv');
const fail = require('./assistant-error');
const { getAgentContext, AGENTS } = require('./agent-context');

function configuration() {
  let file = {};
  if (process.env.NODE_ENV !== 'production') {
    try { file = dotenv.parse(fs.readFileSync(path.join(__dirname, '../.env'))); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return { token: file.AI_SERVICE_TOKEN ?? process.env.AI_SERVICE_TOKEN ?? '',
    url: (file.AI_SERVICE_URL ?? process.env.AI_SERVICE_URL ?? 'http://127.0.0.1:8000').replace(/\/$/, '') };
}
function isConfigured() { return configuration().token.length >= 32; }
async function request(endpoint, body, timeout = 55000) {
  const { token, url } = configuration();
  if (token.length < 32) throw fail(503, 'Configura la conexión privada con ai-service.');
  let response;
  try {
    response = await fetch(url + endpoint, { method: body ? 'POST' : 'GET',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(timeout), ...(body ? { body: JSON.stringify(body) } : {}) });
  } catch (error) {
    throw fail(error.name === 'TimeoutError' ? 504 : 503,
      'No se pudo conectar con los agentes. Comprueba que ai-service esté iniciado.');
  }
  if (!response.ok) {
    throw fail(response.status === 422 ? 422 : response.status === 504 ? 504 : 503,
      response.status === 422 ? 'Los agentes no pudieron analizar las fechas o valores recibidos.'
        : 'El servicio de agentes o su proveedor de IA no está disponible. Revisa su configuración.');
  }
  let result;
  try { result = await response.json(); } catch { throw fail(502, 'Respuesta inválida del servicio de agentes.'); }
  if (body && (typeof result.content !== 'string' || !result.content.trim() || result.content.length > 100000
    || typeof result.model !== 'string' || !['tokensInput','tokensOutput','latencyMs'].every(k => Number.isSafeInteger(result[k]) && result[k] >= 0))) {
    throw fail(502, 'Respuesta inválida del servicio de agentes.');
  }
  return result;
}
async function availability() {
  if (!isConfigured()) return { chat: false, analysis: false };
  try { return await request('/v1/status', undefined, 2000); }
  catch { return { chat: false, analysis: false }; }
}
module.exports = {
  isConfigured, availability, buildContext: getAgentContext,
  async generateReply({ context, history, message }) {
    return request('/v1/chat', { context, message, history: history.map(({ role, content }) => ({ role,
      content: content.length > 12000 ? content.slice(0, 12000) + '\n[Mensaje anterior abreviado por longitud.]' : content })) });
  },
  async analyze({ context, agent }) {
    const report = await request('/v1/analyze', { context, agents: agent === 'all' ? AGENTS : [agent] });
    return { ...report, analysis: report };
  },
};
