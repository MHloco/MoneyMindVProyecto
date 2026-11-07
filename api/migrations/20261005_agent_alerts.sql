-- Existing ai_conversations, ai_messages.tool_calls and ai_usage store analyses and usage.
-- No new financial tables or destructive changes are necessary.
BEGIN;
CREATE UNIQUE INDEX IF NOT EXISTS alerts_agent_key_unique
  ON alerts (user_id, (metadata->>'agent_key'))
  WHERE metadata->>'producer' = 'moneymind-agents-v1';
COMMIT;
