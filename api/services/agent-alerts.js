// Persist only known, structured findings; the LLM's prose can never create an alert.
async function saveAgentAlerts(db, userId, analysis) {
  if (!analysis?.results?.length || analysis.results.some(r => r.limitations?.some(x => x.startsWith('Análisis parcial:')))) return 0;
  const preferences = (await db.query('SELECT type,is_enabled,threshold,days_before,channels FROM alert_preferences WHERE user_id=$1', [userId])).rows;
  const allowed = new Set(['OBLIGATION_DUE','BUDGET_THRESHOLD','BUDGET_EXCEEDED','UNUSUAL_SPENDING','LOW_PROJECTED_BALANCE']);
  let inserted = 0;
  for (const report of analysis.results) {
    for (const finding of report.findings || []) {
      if (!allowed.has(finding.type) || !['rule','analysis'].includes(finding.origin)) continue;
      const preference = preferences.find(p => p.type === finding.type);
      if (preference && (!preference.is_enabled || !preference.channels?.includes('IN_APP'))) continue;
      if (finding.type === 'OBLIGATION_DUE' && finding.evidence.days_until_due > (preference?.days_before ?? 3)) continue;
      if (finding.type === 'BUDGET_THRESHOLD' && preference?.threshold != null) {
        const threshold = Number(preference.threshold);
        if (Number(finding.evidence.used_percent) < (threshold <= 1 ? threshold * 100 : threshold)) continue;
      }
      const metadata = { producer: 'moneymind-agents-v1', agent_key: finding.key,
        agent: report.agent, origin: finding.origin, currency: finding.currency,
        as_of: analysis.as_of, evidence: finding.evidence };
      // The service already holds the per-account transaction lock. This guards idempotency
      // even before the optional unique index has been applied.
      const result = await db.query(`INSERT INTO alerts
        (user_id,type,severity,title,message,metadata,related_entity_id,related_entity_type)
        SELECT $1,$2,$3,$4,$5,$6::jsonb,$7,$8 WHERE NOT EXISTS (
          SELECT 1 FROM alerts WHERE user_id=$1 AND metadata->>'producer'='moneymind-agents-v1'
            AND metadata->>'agent_key'=$9) ON CONFLICT DO NOTHING`,
      [userId, finding.type, finding.severity, finding.title.slice(0, 150), finding.message,
        JSON.stringify(metadata), finding.entity_id,
        finding.entity_id ? ({ budgets: 'budget', anomalies: 'transaction', projection: 'obligation_installment' }[report.agent] || null) : null,
        finding.key]);
      inserted += result.rowCount;
    }
  }
  return inserted;
}
module.exports = { saveAgentAlerts };
