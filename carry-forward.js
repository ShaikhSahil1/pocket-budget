// Derive balances from saved records rather than copying totals into future months.
// Editing history therefore recalculates carry-forward without duplicating it.
function pocketMonthTotals(source, selectedMonth) {
  const validMonth = month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month);
  if (!validMonth(selectedMonth)) throw Error('Choose a valid month.');
  const types = ['casual', 'medical', 'compoff', 'festival'];
  const zero = () => ({ casual: 0, medical: 0, compoff: 0, festival: 0 });
  const moneyRound = value => Math.round((value + Number.EPSILON) * 100) / 100;
  const expenses = {}, leaves = {};
  const emis = source.emis || [];
  const allowances = source.leaves?.allowances || {};
  const leaveSettings = source.leaves?.settings;
  for (const entry of source.expenses) {
    const month = entry.date.slice(0, 7);
    expenses[month] = moneyRound((expenses[month] || 0) + (entry.refundable && entry.received ? 0 : entry.amount));
  }
  for (const entry of source.leaves?.entries || []) {
    const month = entry.date.slice(0, 7);
    (leaves[month] ||= zero())[entry.type] += entry.days;
  }
  const emiMonths = emis.flatMap(emi => emi.mode === 'auto' ? [emi.startDate?.slice(0, 7)] : emi.manualMonths || []);
  const months = [...Object.keys(source.balances), ...Object.keys(expenses), ...Object.keys(allowances), ...Object.keys(leaves), ...emiMonths]
    .filter(month => validMonth(month) && month <= selectedMonth).sort();
  const index = month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  const monthName = number => String(Math.floor(number / 12)).padStart(4, '0') + '-' + String(number % 12 + 1).padStart(2, '0');
  let carried = 0, leaveCarried = zero(), allowance = zero(), result;
  for (let i = index(months[0] || selectedMonth); i <= index(selectedMonth); i++) {
    const month = monthName(i);
    const legacyCasual = !leaveSettings && Object.keys(allowances).length;
    const casualAuto = leaveSettings?.casualMode === 'auto' || (!leaveSettings && !legacyCasual);
    const casualStart = leaveSettings?.casualAutoStart || month;
    allowance = {
      casual: casualAuto ? (month >= casualStart ? leaveSettings?.casualMonthly ?? 1.5 : 0) : (leaveSettings ? allowances[month]?.casual ?? 0 : allowances[month]?.casual ?? allowance.casual),
      medical: allowances[month]?.medical ?? 0,
      compoff: allowances[month]?.compoff ?? 0,
      festival: allowances[month]?.festival ?? 0,
    };
    const base = source.balances[month] || 0;
    const starting = moneyRound(base + carried);
    const emiSpent = moneyRound(emis.filter(emi => {
      const start = emi.startDate?.slice(0, 7), end = emi.endDate?.slice(0, 7);
      return month >= start && month <= end && (emi.mode === 'auto' || (emi.manualMonths || []).includes(month));
    }).reduce((sum, emi) => sum + (Number(emi.amount) || 0), 0));
    const available = moneyRound(starting - (expenses[month] || 0) - emiSpent);
    const leaveTotal = zero(), leaveRemaining = zero(), used = leaves[month] || zero();
    for (const type of types) {
      leaveTotal[type] = allowance[type] + leaveCarried[type];
      leaveRemaining[type] = leaveTotal[type] - used[type];
    }
    result = { base, carried, starting, available, emiSpent, allowance: { ...allowance }, leaveCarried: { ...leaveCarried }, leaveTotal, leaveRemaining };
    carried = Math.max(0, available);
    for (const type of types) leaveCarried[type] = Math.max(0, leaveRemaining[type]);
  }
  return result;
}
