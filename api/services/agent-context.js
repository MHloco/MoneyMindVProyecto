// Fixed, read-only tools. Identity is supplied by the JWT-validated service, never by the model.
const AGENTS = ['habits', 'anomalies', 'budgets', 'projection', 'recommendations'];
async function getAgentContext(db, userId, user, agent = 'all') {
  if (agent !== 'all' && !AGENTS.includes(agent)) throw new Error('Unknown agent');
  const all = agent === 'all' || agent === 'recommendations';
  const needs = name => all || agent === name;
  const params = [userId, user.today];
  const context = { today: user.today, currency: user.currency, truncated: [] };
  async function collect(name, limit, sql) {
    const result = await db.query(sql, params);
    context[name] = result.rows.slice(0, limit);
    if (result.rows.length > limit) context.truncated.push(name);
  }
  if (needs('habits') || needs('projection')) {
    await collect('totals', 100, `SELECT t.currency,
      COALESCE(SUM(CASE WHEN t.type='INCOME' THEN t.amount ELSE -t.amount END)
        FILTER (WHERE t.transaction_date <= $2::date),0) AS recorded_balance,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type='INCOME' AND t.transaction_date BETWEEN date_trunc('month',$2::date) AND $2::date),0) AS month_income,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type='EXPENSE' AND t.transaction_date BETWEEN date_trunc('month',$2::date) AND $2::date),0) AS month_expense,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type='EXPENSE' AND t.recurring_id IS NULL
        AND NOT EXISTS (SELECT 1 FROM obligation_installments i JOIN obligations o ON o.id=i.obligation_id
          WHERE i.transaction_id=t.id AND o.user_id=$1)
        AND t.transaction_date BETWEEN date_trunc('month',$2::date) AND $2::date),0) AS variable_expense,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type='INCOME' AND t.transaction_date > $2::date),0) AS scheduled_income,
      COALESCE(SUM(t.amount) FILTER (WHERE t.type='EXPENSE' AND t.transaction_date > $2::date),0) AS scheduled_expense
      FROM transactions t WHERE t.user_id=$1 AND t.deleted_at IS NULL
        AND t.transaction_date < date_trunc('month',$2::date) + INTERVAL '1 month'
      GROUP BY t.currency ORDER BY t.currency LIMIT 101`);
  }
  if (needs('habits')) {
    await collect('spending', 500, `SELECT COALESCE(c.name,'Sin categoría') AS category,t.currency,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_date >= date_trunc('month',$2::date)),0) AS current_amount,
      COALESCE(SUM(t.amount) FILTER (WHERE t.transaction_date < date_trunc('month',$2::date)
        AND EXTRACT(DAY FROM t.transaction_date) <= EXTRACT(DAY FROM $2::date)),0) AS previous_amount,
      COUNT(*) FILTER (WHERE t.transaction_date >= date_trunc('month',$2::date))::int AS movements
      FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
        AND (c.user_id=$1 OR (c.user_id IS NULL AND c.is_system=TRUE))
      WHERE t.user_id=$1 AND t.deleted_at IS NULL AND t.type='EXPENSE'
        AND t.transaction_date BETWEEN date_trunc('month',$2::date)-INTERVAL '1 month' AND $2::date
      GROUP BY c.id,c.name,t.currency ORDER BY current_amount DESC,category,t.currency LIMIT 501`);
  }
  if (needs('anomalies')) {
    await collect('expenses', 200, `SELECT t.id,COALESCE(c.name,'Sin categoría') AS category,t.currency,t.amount,
      t.transaction_date::text, b.baseline_count,b.baseline_mean,b.baseline_stddev
      FROM transactions t LEFT JOIN categories c ON c.id=t.category_id
        AND (c.user_id=$1 OR (c.user_id IS NULL AND c.is_system=TRUE))
      CROSS JOIN LATERAL (SELECT COUNT(*)::int AS baseline_count,COALESCE(AVG(h.amount),0) AS baseline_mean,
        COALESCE(STDDEV_POP(h.amount),0) AS baseline_stddev FROM transactions h
        WHERE h.user_id=$1 AND h.deleted_at IS NULL AND h.type='EXPENSE' AND h.currency=t.currency
          AND h.category_id IS NOT DISTINCT FROM t.category_id
          AND h.transaction_date >= t.transaction_date-90 AND h.transaction_date < t.transaction_date) b
      WHERE t.user_id=$1 AND t.deleted_at IS NULL AND t.type='EXPENSE'
        AND t.transaction_date BETWEEN $2::date-29 AND $2::date
      ORDER BY t.transaction_date DESC,t.id LIMIT 201`);
  }
  if (needs('budgets')) {
    const preference = (await db.query("SELECT threshold FROM alert_preferences WHERE user_id=$1 AND type='BUDGET_THRESHOLD'", [userId])).rows[0];
    if (preference?.threshold != null) {
      const threshold = Number(preference.threshold);
      context.budget_threshold = Math.min(100, Math.max(0, threshold <= 1 ? threshold * 100 : threshold));
    }
    await collect('budgets', 200, `SELECT b.id,b.name,b.currency,b.amount,b.period_start::text,b.period_end::text,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id=$1 AND t.currency=b.currency
        AND t.type='EXPENSE' AND t.deleted_at IS NULL AND (b.category_id IS NULL OR b.category_id=t.category_id)
        AND t.transaction_date BETWEEN b.period_start AND $2::date),0) AS spent
      FROM budgets b WHERE b.user_id=$1 AND b.is_active=TRUE AND $2::date BETWEEN b.period_start AND b.period_end
      ORDER BY b.period_end,b.id LIMIT 201`);
  }
  if (needs('projection')) {
    await collect('installments', 500, `SELECT i.id,o.name,o.currency,i.due_date::text,i.amount-i.paid_amount AS pending_amount
      FROM obligation_installments i JOIN obligations o ON o.id=i.obligation_id
      WHERE o.user_id=$1 AND o.status='ACTIVE' AND i.paid_amount<i.amount
        AND i.due_date <= GREATEST((date_trunc('month',$2::date)+INTERVAL '1 month'-INTERVAL '1 day')::date,
          $2::date+COALESCE((SELECT GREATEST(0,days_before)::int FROM alert_preferences WHERE user_id=$1 AND type='OBLIGATION_DUE'),3))
      ORDER BY i.due_date,i.id LIMIT 501`);
    await collect('recurring', 200, `SELECT r.id,r.type,r.currency,r.amount,r.frequency,r.interval_count,r.day_of_month,
      r.start_date::text,r.end_date::text,r.next_occurrence_date::text,
      COALESCE((SELECT json_agg(DISTINCT t.transaction_date::text) FROM transactions t
        WHERE t.user_id=$1 AND t.recurring_id=r.id AND t.deleted_at IS NULL
          AND t.transaction_date BETWEEN $2::date AND (date_trunc('month',$2::date)+INTERVAL '1 month'-INTERVAL '1 day')::date),'[]') AS recorded_dates
      FROM recurring_transactions r WHERE r.user_id=$1 AND r.is_active=TRUE
        AND (r.end_date IS NULL OR r.end_date >= $2::date)
        AND r.next_occurrence_date < date_trunc('month',$2::date)+INTERVAL '1 month'
      ORDER BY r.next_occurrence_date,r.id LIMIT 201`);
  }
  return context;
}
module.exports = { getAgentContext, AGENTS };
