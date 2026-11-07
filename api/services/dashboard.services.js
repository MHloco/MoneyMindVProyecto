const pool = require('../config/db');
const { dashboardFilters } = require('./dashboard-filters');

async function getDashboardData(userId, options = {}) {
  const userResult = await pool.query(`SELECT id, email, full_name, currency, timezone, locale,
    period_start_day, to_char(CURRENT_DATE, 'YYYY-MM-DD') AS today
    FROM users WHERE id = $1 AND is_active = TRUE AND deleted_at IS NULL LIMIT 1`, [userId]);
  if (!userResult.rowCount) throw Object.assign(new Error('Usuario no encontrado.'), { status: 404 });
  const user = userResult.rows[0];
  const filters = dashboardFilters(options, user.today);
  const params = [userId, user.currency, filters.start, filters.end];
  const summaryResult = await pool.query(`SELECT
    COALESCE(SUM(amount) FILTER (WHERE type = 'INCOME' AND transaction_date >= $3::date), 0) AS ingresos,
    COALESCE(SUM(amount) FILTER (WHERE type = 'EXPENSE' AND transaction_date >= $3::date), 0) AS gastos,
    COALESCE(SUM(CASE WHEN type = 'INCOME' THEN amount ELSE -amount END), 0) AS balance_total
    FROM transactions WHERE user_id = $1 AND currency = $2 AND deleted_at IS NULL
    AND transaction_date <= $4::date`, params);
  const summary = summaryResult.rows[0];

  // Filter the complete history before pagination, always within the authenticated account.
  const conditions = ['t.user_id = $1', 't.currency = $2', 't.deleted_at IS NULL',
    't.transaction_date BETWEEN $3::date AND $4::date'];
  const movementParams = [...params];
  if (filters.type) {
    movementParams.push(filters.type);
    conditions.push(`t.type = $${movementParams.length}`);
  }
  if (filters.category === 'uncategorized') conditions.push('t.category_id IS NULL');
  else if (filters.category) {
    movementParams.push(filters.category);
    conditions.push(`t.category_id = $${movementParams.length}::uuid`);
  }
  const where = conditions.join(' AND ');
  const count = await pool.query(`SELECT COUNT(*) AS total FROM transactions t WHERE ${where}`, movementParams);
  const total = Number(count.rows[0].total);
  const totalPages = Math.max(1, Math.ceil(total / 10));
  const page = Math.min(filters.page, totalPages);
  const movementsResult = await pool.query(`SELECT t.id, t.transaction_date AS fecha,
    t.description AS descripcion, COALESCE(c.name, 'Sin categoría') AS categoria,
    t.type AS tipo, t.amount AS monto, t.currency AS moneda, t.payment_method AS metodo_pago
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    WHERE ${where} ORDER BY t.transaction_date DESC, t.created_at DESC, t.id DESC
    LIMIT 10 OFFSET $${movementParams.length + 1}`, [...movementParams, (page - 1) * 10]);
  const movimientos = movementsResult.rows.map(row => ({
    id: row.id, fecha: row.fecha, descripcion: row.descripcion, categoria: row.categoria,
    tipo: row.tipo, monto: (row.tipo === 'EXPENSE' ? -1 : 1) * Number(row.monto),
    moneda: row.moneda, metodoPago: row.metodo_pago
  }));

  // Category selection affects the detail table; charts retain the complete monthly totals.
  const categoriesResult = await pool.query(`SELECT t.category_id AS id,
    COALESCE(c.name, 'Sin categoría') AS category_name, COALESCE(c.color, '#c9a24b') AS category_color,
    SUM(t.amount) AS total, COUNT(*) AS movements
    FROM transactions t LEFT JOIN categories c ON c.id = t.category_id
    WHERE t.user_id = $1 AND t.currency = $2 AND t.type = 'EXPENSE' AND t.deleted_at IS NULL
    AND t.transaction_date BETWEEN $3::date AND $4::date
    GROUP BY t.category_id, c.name, c.color ORDER BY total DESC`, params);
  const totalCategories = categoriesResult.rows.reduce((sum, row) => sum + Number(row.total), 0);
  const gastosCategorias = categoriesResult.rows.map(row => ({
    id: row.id, nombre: row.category_name, color: row.category_color, total: Number(row.total),
    porcentaje: totalCategories ? Math.round(Number(row.total) / totalCategories * 100) : 0,
    movimientos: Number(row.movements)
  }));
  const cashflowResult = await pool.query(`SELECT to_char(m.month, 'YYYY-MM-DD') AS month,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'INCOME'), 0) AS total_income,
    COALESCE(SUM(t.amount) FILTER (WHERE t.type = 'EXPENSE'), 0) AS total_expense,
    COALESCE(SUM(CASE WHEN t.type = 'INCOME' THEN t.amount ELSE -t.amount END), 0) AS net_balance,
    COUNT(t.id) AS movements
    FROM generate_series($3::date - INTERVAL '11 months', $3::date, INTERVAL '1 month') AS m(month)
    LEFT JOIN transactions t ON t.user_id = $1 AND t.currency = $2 AND t.deleted_at IS NULL
      AND t.transaction_date <= $4::date AND t.transaction_date >= m.month
      AND t.transaction_date < m.month + INTERVAL '1 month'
    GROUP BY m.month ORDER BY m.month`, params);
  const flujoMensual = cashflowResult.rows.map(row => ({
    mes: row.month, ingresos: Number(row.total_income), gastos: Number(row.total_expense),
    balance: Number(row.net_balance), movimientos: Number(row.movements)
  }));

  // Budgets and alerts show the current situation; calendar events follow the selected month.
  const [budgetsResult, obligationsResult, alertsResult, eventsResult] = await Promise.all([
    pool.query(`SELECT b.id, b.name, b.amount, b.currency,
      COALESCE((SELECT SUM(t.amount) FROM transactions t WHERE t.user_id = b.user_id
        AND (b.category_id IS NULL OR t.category_id = b.category_id) AND t.currency = b.currency
        AND t.type = 'EXPENSE' AND t.deleted_at IS NULL AND t.transaction_date <= CURRENT_DATE
        AND t.transaction_date BETWEEN b.period_start AND b.period_end), 0) AS spent
      FROM budgets b WHERE b.user_id = $1 AND b.is_active = TRUE
      AND CURRENT_DATE BETWEEN b.period_start AND b.period_end ORDER BY b.name`, [userId]),
    pool.query(`SELECT i.id, o.name, i.number, i.due_date, i.amount - i.paid_amount AS pending_amount, o.currency
      FROM obligation_installments i JOIN obligations o ON o.id = i.obligation_id
      WHERE o.user_id = $1 AND o.status = 'ACTIVE' AND i.paid_amount < i.amount
      ORDER BY i.due_date, i.number LIMIT 5`, [userId]),
    pool.query(`SELECT id, title, message, severity, status, read_at FROM alerts WHERE user_id = $1
      AND status <> 'DISMISSED' ORDER BY created_at DESC, id DESC LIMIT 5`, [userId]),
    pool.query(`SELECT id, title, to_char(event_date, 'YYYY-MM-DD') AS event_date FROM calendar_events WHERE user_id = $1
      AND event_date >= $2::date AND event_date < $2::date + INTERVAL '1 month'
      ORDER BY event_date, created_at, id`, [userId, filters.start])
  ]);
  return {
    user: { id: user.id, email: user.email, fullName: user.full_name, currency: user.currency,
      timezone: user.timezone, locale: user.locale, periodStartDay: user.period_start_day },
    period: { today: user.today, month: filters.month, start: filters.start, end: filters.end },
    financial: {
      balanceTotal: Number(summary.balance_total), ingresos: Number(summary.ingresos), gastos: Number(summary.gastos),
      ahorro: Number(summary.ingresos) - Number(summary.gastos), movimientos,
      pagination: { page, total, totalPages }, metas: [], gastosCategorias, flujoMensual,
      obligaciones: obligationsResult.rows.map(row => ({ ...row, pending_amount: Number(row.pending_amount) })),
      presupuestos: budgetsResult.rows.map(row => ({ ...row, amount: Number(row.amount), spent: Number(row.spent) })),
      alertas: alertsResult.rows, eventos: eventsResult.rows
    }
  };
}
module.exports = { getDashboardData };
