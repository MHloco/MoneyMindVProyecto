// Every private query is scoped to the verified JWT subject, including joined records.
async function getFinancialContext(db, userId, user) {
  const params = [userId, user.today];
  const totals = await db.query(`SELECT currency,
    COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME'
      AND transaction_date >= date_trunc('month', $2::date)), 0) AS month_income,
    COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE'
      AND transaction_date >= date_trunc('month', $2::date)), 0) AS month_expense,
    COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END), 0) AS recorded_balance
    FROM transactions WHERE user_id = $1 AND deleted_at IS NULL AND transaction_date <= $2::date
    GROUP BY currency ORDER BY currency`, params);
  const recent = await db.query(`SELECT t.type, t.amount, t.currency,
    t.description, t.transaction_date::text, c.name AS category
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      AND (c.user_id = $1 OR (c.user_id IS NULL AND c.is_system = TRUE))
    WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.transaction_date <= $2::date
    ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC LIMIT 30`, params);
  const categories = await db.query(`SELECT COALESCE(c.name, 'Sin categoría') AS category,
    t.currency, SUM(t.amount) AS amount
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
      AND (c.user_id = $1 OR (c.user_id IS NULL AND c.is_system = TRUE))
    WHERE t.user_id = $1 AND t.deleted_at IS NULL AND t.type = 'EXPENSE'
      AND t.transaction_date BETWEEN date_trunc('month', $2::date)::date AND $2::date
    GROUP BY c.name, t.currency ORDER BY amount DESC LIMIT 20`, params);
  const budgets = await db.query(`SELECT b.name, b.amount, b.currency,
    b.period_start::text, b.period_end::text,
    COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = $1
      AND t.user_id = b.user_id AND t.currency = b.currency AND t.type = 'EXPENSE'
      AND t.deleted_at IS NULL AND (b.category_id IS NULL OR t.category_id = b.category_id)
      AND t.transaction_date BETWEEN b.period_start AND LEAST(b.period_end, $2::date)), 0) AS spent
    FROM budgets b WHERE b.user_id = $1 AND b.is_active = TRUE
      AND $2::date BETWEEN b.period_start AND b.period_end
    ORDER BY b.period_end, b.id LIMIT 20`, params);
  const obligations = await db.query(`SELECT name, total_amount, paid_amount, currency,
    total_amount - paid_amount AS pending_amount FROM obligations
    WHERE user_id = $1 AND status = 'ACTIVE' ORDER BY created_at DESC, id DESC LIMIT 20`, [userId]);
  const installments = await db.query(`SELECT o.name, o.currency, i.number,
    i.due_date::text, i.amount - i.paid_amount AS pending_amount
    FROM obligation_installments i JOIN obligations o ON o.id = i.obligation_id
    WHERE o.user_id = $1 AND o.status = 'ACTIVE' AND i.paid_amount < i.amount
    ORDER BY i.due_date, i.number, i.id LIMIT 20`, [userId]);
  const recurring = await db.query(`SELECT type, description, amount, currency,
    frequency, interval_count, next_occurrence_date::text FROM recurring_transactions
    WHERE user_id = $1 AND is_active = TRUE
    ORDER BY next_occurrence_date, id LIMIT 20`, [userId]);
  return {
    today: user.today, currency: user.currency, timezone: user.timezone,
    period: 'Mes calendario actual hasta hoy; saldo registrado histórico hasta hoy.',
    limits: { recentTransactions: 30, expenseCategories: 20, budgets: 20, obligations: 20, installments: 20, recurring: 20 },
    totalsByCurrency: totals.rows, recentTransactions: recent.rows,
    monthExpenseCategories: categories.rows, activeBudgets: budgets.rows,
    activeObligations: obligations.rows, pendingInstallments: installments.rows,
    recurringTransactions: recurring.rows,
  };
}

module.exports = { getFinancialContext };
