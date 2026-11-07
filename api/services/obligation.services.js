const pool = require('../config/db');
const { clearExpenseCache } = require('./expense-cache');
const { invalid, moneyInCents, paymentFields } = require('./payment-data');

async function getSummary(userId, redis) {
  const result = await pool.query(
    `
    SELECT
      COALESCE(SUM(total_amount), 0) AS total_debt,
      COALESCE(SUM(paid_amount), 0) AS total_paid
    FROM obligations
    WHERE user_id = $1
      AND status IN ('ACTIVE', 'PAID')
    `,
    [userId]
  );

  const next = await pool.query(
    `
    SELECT
      obligation_id,
      obligation_name,
      installment_id,
      installment_number,
      due_date,
      amount,
      pending_amount,
      status,
      days_until_due
    FROM v_upcoming_obligations
    WHERE user_id = $1
    ORDER BY due_date ASC
    LIMIT 1
    `,
    [userId]
  );

  return {
    total_debt: Number(result.rows[0].total_debt),
    total_paid: Number(result.rows[0].total_paid),
    next_due: next.rows[0] || null
  };
}

async function getObligations(userId) {
  const result = await pool.query(
    `
    SELECT
      o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', i.id,
            'number', i.number,
            'due_date', i.due_date,
            'amount', i.amount,
            'paid_amount', i.paid_amount,
            'status', i.status,
            'paid_at', i.paid_at,
            'transaction_id', i.transaction_id
          )
          ORDER BY i.number
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS installments
    FROM obligations o
    LEFT JOIN obligation_installments i
      ON i.obligation_id = o.id
    WHERE o.user_id = $1
    GROUP BY o.id
    ORDER BY o.created_at DESC
    `,
    [userId]
  );

  return result.rows;
}

async function getObligation(userId, obligationId) {
  const result = await pool.query(
    `
    SELECT
      o.*,
      COALESCE(
        json_agg(
          json_build_object(
            'id', i.id,
            'number', i.number,
            'due_date', i.due_date,
            'amount', i.amount,
            'paid_amount', i.paid_amount,
            'status', i.status,
            'paid_at', i.paid_at,
            'transaction_id', i.transaction_id
          )
          ORDER BY i.number
        ) FILTER (WHERE i.id IS NOT NULL),
        '[]'
      ) AS installments
    FROM obligations o
    LEFT JOIN obligation_installments i
      ON i.obligation_id = o.id
    WHERE o.id = $1
      AND o.user_id = $2
    GROUP BY o.id
    `,
    [obligationId, userId]
  );

  if (result.rowCount === 0) {
    throw new Error('Obligación no encontrada.');
  }

  return result.rows[0];
}

async function createObligation(userId, data) {
  const totalCents = moneyInCents(data.total_amount);
  const count = Number(data.installments_count ?? 1);
  if (!Number.isInteger(count) || count < 1 || count > 32767 || count > totalCents) {
    throw invalid('El número de cuotas debe ser entero y cada cuota debe ser de al menos S/ 0.01.');
  }
  const start = String(data.start_date || '');
  const parsedStart = new Date(`${start}T00:00:00Z`);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !Number.isFinite(parsedStart.getTime()) || parsedStart.toISOString().slice(0, 10) !== start) {
    throw invalid('Ingresa una fecha de inicio válida.');
  }
  if (data.due_day != null && (!Number.isInteger(Number(data.due_day)) || Number(data.due_day) < 1 || Number(data.due_day) > 31)) {
    throw invalid('El día de vencimiento debe estar entre 1 y 31.');
  }
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const {
      category_id,
      name,
      type = 'OTHER',
      creditor,
      total_amount,
      installments_count = 1,
      interest_rate,
      start_date,
      due_day,
      notes
    } = data;

    const obligationResult = await client.query(
      `
      INSERT INTO obligations (
        user_id,
        category_id,
        name,
        type,
        creditor,
        total_amount,
        installments_count,
        interest_rate,
        start_date,
        due_day,
        notes
      )
      VALUES (
        $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11
      )
      RETURNING *
      `,
      [
        userId,
        category_id || null,
        name,
        type,
        creditor || null,
        total_amount,
        installments_count,
        interest_rate || null,
        start_date,
        due_day || null,
        notes || null
      ]
    );

    const obligation = obligationResult.rows[0];

    const baseCents = Math.floor(totalCents / count);

    for (let i = 1; i <= installments_count; i++) {
      const dueDate = new Date(parsedStart);
      dueDate.setUTCDate(1);
      dueDate.setUTCMonth(dueDate.getUTCMonth() + i - 1);
      const lastDay = new Date(Date.UTC(dueDate.getUTCFullYear(), dueDate.getUTCMonth() + 1, 0)).getUTCDate();
      dueDate.setUTCDate(Math.min(Number(due_day) || parsedStart.getUTCDate(), lastDay));
      const installmentCents = baseCents + (i <= totalCents % count ? 1 : 0);

      await client.query(
        `
        INSERT INTO obligation_installments (
          obligation_id,
          number,
          due_date,
          amount
        )
        VALUES ($1,$2,$3,$4)
        `,
        [
          obligation.id,
          i,
          dueDate.toISOString().slice(0, 10),
          (installmentCents / 100).toFixed(2)
        ]
      );
    }

    await client.query('COMMIT');

    return obligation;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

async function payInstallment(userId, installmentId, paymentData, redis) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const installmentResult = await client.query(
      `
      SELECT
        i.*,
        o.user_id,
        o.name AS obligation_name,
        o.category_id,
        o.currency
      FROM obligation_installments i
      JOIN obligations o
        ON o.id = i.obligation_id
      WHERE i.id = $1
        AND o.user_id = $2
      FOR UPDATE
      `,
      [installmentId, userId]
    );

    if (installmentResult.rowCount === 0) {
      throw Object.assign(new Error('Cuota no encontrada.'), { status: 404 });
    }

    const installment = installmentResult.rows[0];

    if (installment.status === 'PAID') {
      throw Object.assign(new Error('Esta cuota ya está pagada.'), { status: 409 });
    }

    const remainingCents = Math.round(Number(installment.amount) * 100) - Math.round(Number(installment.paid_amount) * 100);
    const paymentCents = moneyInCents(paymentData?.amount === undefined ? remainingCents / 100 : paymentData.amount);
    if (paymentCents > remainingCents) throw invalid('El pago no puede superar el saldo pendiente de la cuota.');
    const paymentAmount = paymentCents / 100;
    const fields = paymentFields(paymentData?.payment_method || 'CASH', paymentData?.notes);

    const transactionResult = await client.query(
      `
      INSERT INTO transactions (
        user_id,
        category_id,
        type,
        amount,
        currency,
        description,
        notes,
        transaction_date,
        payment_method,
        source
      )
      VALUES (
        $1,
        $2,
        'EXPENSE',
        $3,
        $4,
        $5,
        $6,
        CURRENT_DATE,
        $7,
        $8
      )
      RETURNING id
      `,
      [
        userId,
        installment.category_id,
        paymentAmount,
        installment.currency,
        `Pago cuota ${installment.number} - ${installment.obligation_name}`,
        fields.notes,
        fields.paymentMethod,
        installment.obligation_name
      ]
    );

    const transactionId = transactionResult.rows[0].id;

    const newPaidAmount =
      (Math.round(Number(installment.paid_amount) * 100) + paymentCents) / 100;

    const newStatus =
      newPaidAmount >= Number(installment.amount)
        ? 'PAID'
        : 'PARTIAL';

    await client.query(
      `
      UPDATE obligation_installments
      SET
        paid_amount = $1,
        status = $2::installment_status,
        transaction_id = $3,
        paid_at = CASE
          WHEN $2::installment_status = 'PAID'::installment_status THEN now()
          ELSE paid_at
        END,
        updated_at = now()
      WHERE id = $4
      `,
      [
        newPaidAmount,
        newStatus,
        transactionId,
        installmentId
      ]
    );

    await client.query(
      `
      UPDATE obligations
      SET
        paid_amount = (
          SELECT COALESCE(SUM(paid_amount), 0)
          FROM obligation_installments
          WHERE obligation_id = $1
        ),
        status = CASE
          WHEN (
            SELECT COALESCE(SUM(paid_amount), 0)
            FROM obligation_installments
            WHERE obligation_id = $1
          ) >= total_amount
          THEN 'PAID'::obligation_status
          ELSE 'ACTIVE'::obligation_status
        END,
        updated_at = now()
      WHERE id = $1
        AND user_id = $2
      `,
      [installment.obligation_id, userId]
    );

    await client.query('COMMIT');

    // A cache outage must not report a committed payment as failed and invite a second payment.
    try {
      await clearExpenseCache(userId, redis);
    } catch {
      console.warn('Pago registrado; no se pudo invalidar la caché de gastos.');
    }

    return {
      installment_id: installmentId,
      transaction_id: transactionId,
      paid_amount: newPaidAmount,
      status: newStatus
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getSummary,
  getObligations,
  getObligation,
  createObligation,
  payInstallment
};
