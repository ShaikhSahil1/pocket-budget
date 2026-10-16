// Derive balances from saved records rather than copying totals into future months.
// Editing history therefore recalculates carry-forward without duplicating it.
function pocketMonthTotals(source, selectedMonth) {
  const validMonth = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  if (!validMonth(selectedMonth)) throw Error('Choose a valid month.');
  const types = ['casual', 'medical', 'compoff'];
  const zero = () => ({ casual: 0, medical: 0, compoff: 0 });
  const moneyRound = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const expenses = {}, leaves = {};
  const allowances = source.leaves?.allowances || {};
  for (const entry of source.expenses) {
    const month = entry.date.slice(0, 7);
    expenses[month] = moneyRound((expenses[month] || 0) + (entry.refundable && entry.received ? 0 : entry.amount));
  }
  for (const entry of source.leaves?.entries || []) {
    const month = entry.date.slice(0, 7);
    (leaves[month] ||= zero())[entry.type] += entry.days;
  }
  const months = [...Object.keys(source.balances), ...Object.keys(expenses), ...Object.keys(allowances), ...Object.keys(leaves)]
    .filter(month => validMonth(month) && month <= selectedMonth).sort();
  const index = month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  const monthName = number => String(Math.floor(number / 12)).padStart(4, '0') + '-' + String(number % 12 + 1).padStart(2, '0');
  let carried = 0, leaveCarried = zero(), allowance = zero(), result;
  for (let i = index(months[0] || selectedMonth); i <= index(selectedMonth); i++) {
    const month = monthName(i);
    if (allowances[month]) allowance = { ...zero(), ...allowances[month] };
    const base = source.balances[month] || 0;
    const starting = moneyRound(base + carried);
    const available = moneyRound(starting - (expenses[month] || 0));
    const leaveTotal = zero(), leaveRemaining = zero(), used = leaves[month] || zero();
    for (const type of types) {
      leaveTotal[type] = allowance[type] + leaveCarried[type];
      leaveRemaining[type] = leaveTotal[type] - used[type];
    }
    result = { base, carried, starting, available, allowance: { ...allowance }, leaveCarried: { ...leaveCarried }, leaveTotal, leaveRemaining };
    carried = Math.max(0, available);
    for (const type of types) leaveCarried[type] = Math.max(0, leaveRemaining[type]);
  }
  return result;
}
