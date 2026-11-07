const { test } = require('node:test');
const assert = require('node:assert/strict');
const { dashboardFilters } = require('./dashboard-filters');

test('dashboard month bounds include leap days and exclude future dates', () => {
  assert.equal(dashboardFilters({ month: '2024-02' }, '2026-10-04').end, '2024-02-29');
  assert.equal(dashboardFilters({}, '2026-10-04').end, '2026-10-04');
  assert.equal(dashboardFilters({ month: '2026-09' }, '2026-10-04').start, '2026-09-01');
});
test('dashboard rejects invalid filters before issuing financial queries', () => {
  for (const options of [{ month: '2026-13' }, { month: '2026-11' }, { month: ['2026-10'] },
    { month: '10000-01' }, { type: 'OTHER' }, { category: "' OR 1=1" }, { page: -1 }, { page: 'NaN' }]) {
    assert.throws(() => dashboardFilters(options, '2026-10-04'), { status: 400 });
  }
});
