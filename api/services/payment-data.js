const METHODS = new Set(['CASH', 'DEBIT_CARD', 'CREDIT_CARD', 'TRANSFER', 'WALLET', 'OTHER']);

function invalid(message) {
  return Object.assign(new Error(message), { status: 400 });
}

function moneyInCents(value) {
  if (!['number', 'string'].includes(typeof value) || String(value).trim() === '') {
    throw invalid('Ingresa un monto válido mayor que cero, con hasta dos decimales.');
  }
  const amount = Number(value);
  const cents = Math.round(amount * 100);
  if (!Number.isSafeInteger(cents) || cents <= 0 || Math.abs(amount * 100 - cents) > 0.00001) {
    throw invalid('Ingresa un monto válido mayor que cero, con hasta dos decimales.');
  }
  return cents;
}

// The database represents transfers as TRANSFER and digital wallets as WALLET.
function paymentFields(method, notes) {
  const aliases = { BANK_TRANSFER: 'TRANSFER', YAPE: 'WALLET', PLIN: 'WALLET' };
  const paymentMethod = Object.hasOwn(aliases, method) ? aliases[method] : method;
  if (!METHODS.has(paymentMethod)) throw invalid('Método de pago inválido.');
  const wallet = method === 'YAPE' ? 'Yape' : method === 'PLIN' ? 'Plin' : null;
  return {
    paymentMethod,
    notes: wallet ? [`Pago con ${wallet}.`, notes].filter(Boolean).join('\n') : notes || null
  };
}

module.exports = { invalid, moneyInCents, paymentFields };
