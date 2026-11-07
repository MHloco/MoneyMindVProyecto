function dashboardFilters(options, today) {
  const invalid = message => { throw Object.assign(new Error(message), { status: 400 }); };
  const month = options.month === undefined || options.month === '' ? today.slice(0, 7) : options.month;
  if (typeof month !== 'string' || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month) || month < '1900-01' || month > today.slice(0, 7)) {
    invalid('Selecciona un mes válido, entre enero de 1900 y el mes actual.');
  }
  const type = options.type || '';
  if (!['', 'INCOME', 'EXPENSE'].includes(type)) invalid('Tipo de movimiento inválido.');
  const category = options.category || '';
  if (typeof category !== 'string' || (category && category !== 'uncategorized' && !/^[\da-f]{8}-(?:[\da-f]{4}-){3}[\da-f]{12}$/i.test(category))) {
    invalid('Categoría inválida.');
  }
  const page = options.page === undefined ? 1 : Number(options.page);
  if (!Number.isSafeInteger(page) || page < 1) invalid('Página inválida.');
  const [year, monthNumber] = month.split('-').map(Number);
  const lastDay = new Date(Date.UTC(year, monthNumber, 0)).toISOString().slice(0, 10);
  return { month, start: `${month}-01`, end: lastDay < today ? lastDay : today, type, category, page };
}

module.exports = { dashboardFilters };
