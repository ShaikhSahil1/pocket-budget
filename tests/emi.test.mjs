import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('emi.js', 'utf8').split('(() => {')[0];
const context = vm.createContext({ Date, Number, Error, Set, Array });
vm.runInContext(source, context);

const plan = (changes = {}) => ({ id: 'emi-1', name: 'Home loan', amount: 12500, startDate: '2026-10-15', endDate: '2027-03-15', mode: 'auto', manualMonths: [], notes: '', ...changes });

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
  assert.doesNotThrow(() => context.validatePocketEmis(undefined));
  assert.throws(() => context.validatePocketEmis([plan({ endDate: '2026-01-01' })]));
  assert.throws(() => context.validatePocketEmis([plan({ amount: 0 })]));
});
