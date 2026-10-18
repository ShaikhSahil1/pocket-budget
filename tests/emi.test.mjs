import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('emi.js', 'utf8').split('(() => {')[0];
const context = vm.createContext({ Date, Number, Error, Set, Array });
vm.runInContext(source, context);

const plan = (changes = {}) => ({ id: 'emi-1', name: 'Home loan', amount: 12500, startDate: '2026-10-15', endDate: '2027-03-15', mode: 'auto', manualMonths: [], paidMonths: [], notes: '', ...changes });

test('automatic EMI is due for every month inside the date range', () => {
  assert.equal(context.pocketEmiDueInMonth(plan(), '2026-09'), false);
  assert.equal(context.pocketEmiDueInMonth(plan(), '2026-10'), true);
  assert.equal(context.pocketEmiDueInMonth(plan(), '2027-03'), true);
  assert.equal(context.pocketEmiDueInMonth(plan(), '2027-04'), false);
});

test('manual EMI is due only in months explicitly added by the user', () => {
  const emi = plan({ mode: 'manual', manualMonths: ['2026-11'] });
  assert.equal(context.pocketEmiDueInMonth(emi, '2026-10'), false);
  assert.equal(context.pocketEmiDueInMonth(emi, '2026-11'), true);
});

test('EMI validation accepts good records and rejects invalid date ranges', () => {
  assert.doesNotThrow(() => context.validatePocketEmis([plan()]));
  assert.doesNotThrow(() => context.validatePocketEmis([plan({ dueDay: 31, reminderEnabled: true })]));
  assert.doesNotThrow(() => context.validatePocketEmis(undefined));
  assert.throws(() => context.validatePocketEmis([plan({ endDate: '2026-01-01' })]));
  assert.throws(() => context.validatePocketEmis([plan({ amount: 0 })]));
  assert.throws(() => context.validatePocketEmis([plan({ dueDay: 32 })]));
  assert.throws(() => context.validatePocketEmis([plan({ reminderEnabled: 'yes' })]));
});

test('plan metrics explain installments, total, status and paid state', () => {
  const metrics = context.pocketEmiPlanMetrics(plan({ paidMonths: ['2026-11'] }), '2026-11');
  assert.equal(metrics.installments, 6);
  assert.equal(metrics.elapsed, 2);
  assert.equal(metrics.remaining, 4);
  assert.equal(metrics.total, 75000);
  assert.equal(metrics.status, 'active');
  assert.equal(metrics.paid, true);
  assert.equal(context.pocketEmiPlanMetrics(plan(), '2026-09').status, 'upcoming');
  assert.equal(context.pocketEmiPlanMetrics(plan(), '2027-04').status, 'completed');
});

test('old EMI records without paid months remain valid', () => {
  const legacy = plan(); delete legacy.paidMonths;
  assert.doesNotThrow(() => context.validatePocketEmis([legacy]));
  assert.throws(() => context.validatePocketEmis([plan({ paidMonths: ['wrong'] })]));
});

test('due EMI becomes a Personal Buying expense with a stable monthly ID', () => {
  const expense = context.pocketEmiExpenseForMonth(plan(), '2026-11');
  assert.equal(expense.id, 'emi:emi-1:2026-11');
  assert.equal(expense.name, 'Home loan EMI');
  assert.equal(expense.category, 'Personal Buying');
  assert.equal(expense.amount, 12500);
  assert.equal(expense.date, '2026-11-15');
  assert.equal(context.pocketEmiExpenseForMonth(plan(), '2027-04'), null);
});

test('selected monthly due day is used and clamps to the last day of short months', () => {
  const emi = plan({ dueDay: 31 });
  assert.equal(context.pocketEmiDueDateForMonth(emi, '2026-10'), '2026-10-31');
  assert.equal(context.pocketEmiDueDateForMonth(emi, '2027-02'), '2027-02-28');
  assert.equal(context.pocketEmiExpenseForMonth(emi, '2026-11').date, '2026-11-30');
});

test('due-date reminders include only enabled, unpaid EMIs scheduled that day', () => {
  const enabled = plan({ dueDay: 15, reminderEnabled: true });
  assert.equal(context.pocketEmisDueOnDate([enabled], '2026-11-15').length, 1);
  assert.equal(context.pocketEmisDueOnDate([enabled], '2026-11-14').length, 0);
  assert.equal(context.pocketEmisDueOnDate([plan({ dueDay: 15, reminderEnabled: false })], '2026-11-15').length, 0);
  assert.equal(context.pocketEmisDueOnDate([plan({ dueDay: 15, reminderEnabled: true, paidMonths: ['2026-11'] })], '2026-11-15').length, 0);
});
