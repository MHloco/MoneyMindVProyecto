const pool = require('../config/db');
const aiService = require('./ai-service.client');
const fail = require('./assistant-error');
const { getFinancialContext } = require('./assistant-context');
const { AGENTS } = require('./agent-context');
const { saveAgentAlerts } = require('./agent-alerts');

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function validateId(value) {
  if (typeof value !== 'string' || !UUID.test(value)) throw fail(400, 'Identificador de conversación inválido.');
}

async function getUser(db, userId) {
  if (typeof userId !== 'string' || !UUID.test(userId)) throw fail(401, 'Inicia sesión nuevamente.');
  const result = await db.query(`SELECT currency, timezone,
    to_char(now() AT TIME ZONE timezone, 'YYYY-MM-DD') AS today
    FROM users WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL`, [userId]);
  if (!result.rows.length) throw fail(401, 'La sesión ya no está disponible. Inicia sesión nuevamente.');
  return result.rows[0];
}

async function getConversation(db, userId, id) {
  validateId(id);
  const result = await db.query(`SELECT id, title, created_at, updated_at FROM ai_conversations
    WHERE id = $1 AND user_id = $2 AND is_archived = FALSE`, [id, userId]);
  if (!result.rows.length) throw fail(404, 'Conversación no encontrada.');
  return result.rows[0];
}

async function getMessages(db, userId, id, limit) {
  const result = await db.query(`SELECT m.id, m.role, m.content, m.created_at, m.tool_calls
    FROM ai_messages m JOIN ai_conversations c ON c.id = m.conversation_id
    WHERE c.id = $1 AND c.user_id = $2 AND c.is_archived = FALSE
      AND m.role IN ('USER', 'ASSISTANT')
    ORDER BY m.created_at DESC, m.id DESC LIMIT $3`, [id, userId, limit]);
  return result.rows.reverse();
}

async function getUsage(db, userId, today) {
  const result = await db.query(`SELECT
    COALESCE((SELECT p.max_ai_queries FROM subscriptions s JOIN plans p ON p.id = s.plan_id
      WHERE s.user_id = $1 AND s.status = 'ACTIVE' AND p.is_active = TRUE
        AND $2::date >= s.current_period_start AND $2::date < s.current_period_end
      ORDER BY s.created_at DESC LIMIT 1),
      (SELECT max_ai_queries FROM plans WHERE code = 'FREE' AND is_active = TRUE), 20) AS query_limit,
    COALESCE((SELECT queries_count FROM ai_usage WHERE user_id = $1
      AND period_month = date_trunc('month', $2::date)::date), 0) AS used`, [userId, today]);
  const { query_limit, used } = result.rows[0];
  return { used: Number(used), limit: Number(query_limit), month: today.slice(0, 7) };
}

function createAssistantService(db = pool, provider = aiService) {
  return {
    async list(userId) {
      const user = await getUser(db, userId);
      const conversations = await db.query(`SELECT id, title, created_at, updated_at
        FROM ai_conversations WHERE user_id = $1 AND is_archived = FALSE
        ORDER BY updated_at DESC, id DESC LIMIT 50`, [userId]);
      const availability = provider.availability ? await provider.availability() : { chat: provider.isConfigured(), analysis: false };
      return { conversations: conversations.rows, usage: await getUsage(db, userId, user.today),
        available: availability.chat, agentsAvailable: availability.analysis };
    },

    async detail(userId, id) {
      await getUser(db, userId);
      const conversation = await getConversation(db, userId, id);
      const messages = await getMessages(db, userId, id, 101);
      return { conversation, messages: messages.slice(-100), hasEarlierMessages: messages.length > 100 };
    },

    async analyze(userId, body) {
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => key !== 'agent')
        || (body.agent !== undefined && body.agent !== 'all' && !AGENTS.includes(body.agent))) {
        throw fail(400, 'Selecciona un agente válido; no envíes datos financieros ni IDs de usuario.');
      }
      return this.send(userId, { message: `Análisis financiero: ${body.agent || 'all'}` },
        { analysisOnly: true, agent: body.agent || 'all' });
    },

    async send(userId, body, { analysisOnly = false, agent = 'all' } = {}) {
      if (!body || typeof body !== 'object' || Array.isArray(body)
        || Object.keys(body).some(key => !['message', 'conversationId'].includes(key))) {
        throw fail(400, 'Envía únicamente el mensaje y, opcionalmente, la conversación.');
      }
      if (typeof body.message !== 'string' || !body.message.trim() || body.message.length > 4000) {
        throw fail(400, 'El mensaje debe tener entre 1 y 4000 caracteres.');
      }
      if (body.conversationId !== undefined) validateId(body.conversationId);
      const message = body.message.trim();
      const client = await db.connect();
      try {
        await client.query('BEGIN');
        const user = await getUser(client, userId);
        // Cross-process lock: only one generation per account, across all its conversations.
        const lock = await client.query('SELECT pg_try_advisory_xact_lock(71431, hashtext($1)) AS acquired', [userId]);
        if (!lock.rows[0].acquired) throw fail(409, 'Ya hay una respuesta en proceso. Espera un momento.');
        let conversation = body.conversationId
          ? await getConversation(client, userId, body.conversationId) : null;
        if (!provider.isConfigured()) throw fail(503, 'El asistente aún no está configurado. Contacta al administrador.');
        const usage = await getUsage(client, userId, user.today);
        if (usage.limit >= 0 && usage.used >= usage.limit) {
          throw fail(429, 'Alcanzaste el límite mensual de consultas de tu plan.');
        }
        // Bound even unlimited plans to 10 successful generations per minute per account.
        const recent = await client.query(`SELECT COUNT(*)::int AS count FROM ai_messages m
          JOIN ai_conversations c ON c.id = m.conversation_id WHERE c.user_id = $1
          AND m.role = 'ASSISTANT' AND m.created_at > now() - interval '1 minute'`, [userId]);
        if (recent.rows[0].count >= 10) throw fail(429, 'Has enviado muchas consultas. Espera un minuto.');
        const history = conversation ? await getMessages(client, userId, conversation.id, 20) : [];
        const context = await (provider.buildContext || getFinancialContext)(client, userId, user, agent);
        const reply = analysisOnly
          ? await provider.analyze({ context, agent })
          : await provider.generateReply({ context, history, message });
        if (!conversation) {
          const created = await client.query(`INSERT INTO ai_conversations (user_id, title, agent)
            VALUES ($1, $2, 'ADVISOR') RETURNING id, title, created_at, updated_at`,
          [userId, message.replace(/\s+/g, ' ').slice(0, 160)]);
          conversation = created.rows[0];
        }
        // clock_timestamp avoids equal timestamps for the two messages in one transaction.
        const sent = await client.query(`INSERT INTO ai_messages (conversation_id, role, content, created_at)
          SELECT id, 'USER', $3, clock_timestamp() FROM ai_conversations
          WHERE id = $1 AND user_id = $2 RETURNING id, role, content, created_at`,
        [conversation.id, userId, message]);
        const received = await client.query(`INSERT INTO ai_messages
          (conversation_id, role, content, model, tokens_input, tokens_output, latency_ms, tool_calls, created_at)
          SELECT id, 'ASSISTANT', $3, $4, $5, $6, $7, $8::jsonb, clock_timestamp() FROM ai_conversations
          WHERE id = $1 AND user_id = $2 RETURNING id, role, content, created_at`,
        [conversation.id, userId, reply.content, reply.model, reply.tokensInput, reply.tokensOutput, reply.latencyMs,
          JSON.stringify(reply.analysis ? [reply.analysis] : [])]);
        const updated = await client.query(`UPDATE ai_conversations SET updated_at = clock_timestamp()
          WHERE id = $1 AND user_id = $2 RETURNING id, title, created_at, updated_at`, [conversation.id, userId]);
        await client.query(`INSERT INTO ai_usage (user_id, period_month, queries_count, tokens_total)
          VALUES ($1, date_trunc('month', $2::date)::date, 1, $3)
          ON CONFLICT (user_id, period_month) DO UPDATE SET queries_count = ai_usage.queries_count + 1,
          tokens_total = ai_usage.tokens_total + EXCLUDED.tokens_total, updated_at = now()`,
        [userId, user.today, reply.tokensInput + reply.tokensOutput]);
        const alertsCreated = reply.analysis ? await saveAgentAlerts(client, userId, reply.analysis) : 0;
        await client.query('COMMIT');
        return { conversation: updated.rows[0], messages: [sent.rows[0], received.rows[0]],
          usage: { ...usage, used: usage.used + 1 }, ...(reply.analysis ? { analysis: reply.analysis, alertsCreated } : {}) };
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally {
        client.release();
      }
    },
  };
}

module.exports = { ...createAssistantService(), createAssistantService };
