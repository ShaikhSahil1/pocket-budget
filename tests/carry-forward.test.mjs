import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({});
vm.runInContext(fs.readFileSync('carry-forward.js', 'utf8'), context);
const totals = context.pocketMonthTotals;
const source = () => ({ balances: {}, expenses: [], currency: 'INR' });
test('unused money accumulates through skipped months and year boundaries', () => {
  const data = source(); data.balances = { '2026-11': 1000, '2026-12': 500 };
  data.expenses = [{ date: '2026-11-01', amount: 200 }, { date: '2026-12-01', amount: 100 }];
  assert.equal(totals(data, '2026-12').carried, 800);
  assert.equal(totals(data, '2026-12').starting, 1300);
  assert.equal(totals(data, '2027-02').available, 1200);
  assert.equal(totals(data, '2026-10').available, 0);
});
test('negative and zero balances do not carry; received refunds count once', () => {
  const data = source(); data.balances = { '2026-10': 100, '2026-11': 50 };
  data.expenses = [{ date: '2026-10-01', amount: 150 }];
  assert.equal(totals(data, '2026-10').available, -50);
  assert.equal(totals(data, '2026-11').starting, 50);
  data.expenses[0].refundable = true; data.expenses[0].received = true;
  assert.equal(totals(data, '2026-11').starting, 150);
  data.expenses[0].received = false;
  assert.equal(totals(data, '2026-11').starting, 50);
});
test('only casual recurs; medical and comp-off credits apply once and carry independently', () => {
  const data = source(); data.leaves = { allowances: { '2026-10': { casual: 2, medical: 1, compoff: 1 } }, entries: [ { date: '2026-10-01', type: 'casual', days: 0.5 }, { date: '2026-10-02', type: 'medical', days: 1 }, { date: '2026-10-03', type: 'compoff', days: 1 } ] };
  const november = totals(data, '2026-11');
  assert.equal(november.leaveTotal.casual, 3.5); assert.equal(november.leaveTotal.medical, 0); assert.equal(november.leaveTotal.compoff, 0);
  assert.equal(totals(data, '2026-12').leaveTotal.casual, 5.5);
  data.leaves.allowances['2026-12'] = { casual: 1, medical: 0, compoff: 0 };
  assert.equal(totals(data, '2026-12').leaveTotal.casual, 4.5);
  assert.equal(totals(data, '2026-09').leaveTotal.casual, 0);
});
test('negative leave is not carried; old backups without comp-off remain valid', () => {
  const data = source(); data.leaves = { allowances: { '2026-12': { casual: 1, medical: 0 } }, entries: [{ date: '2026-12-01', type: 'casual', days: 2 }] };
  assert.equal(totals(data, '2026-12').leaveRemaining.casual, -1);
  assert.equal(totals(data, '2027-01').leaveTotal.casual, 1);
  assert.equal(totals(data, '2027-01').leaveTotal.compoff, 0);
});
test('history changes recalculate without mutating or duplicating stored records', () => {
  const data = source(); data.balances['2026-10'] = 0.3;
  data.expenses = [{ date: '2026-10-01', amount: 0.1 }, { date: '2026-10-02', amount: 0.2 }];
  const before = JSON.stringify(data);
  assert.equal(totals(data, '2026-11').carried, 0);
  assert.equal(JSON.stringify(data), before);
  data.expenses.pop(); assert.equal(totals(data, '2026-11').carried, 0.2);
  assert.equal(totals(data, '2026-11').carried, 0.2);
});

test('manual medical and comp-off credits carry without growing in skipped months', () => {
  const data = source(); data.leaves = { allowances: { '2026-10': { casual: 1, medical: 5, compoff: 2 }, '2026-12': { casual: 1, medical: 3, compoff: 1 } }, entries: [{date:'2026-10-20',type:'compoff',days:1}] };
  assert.equal(totals(data,'2026-11').leaveTotal.medical,5);
  assert.equal(totals(data,'2026-11').leaveTotal.compoff,1);
  assert.equal(totals(data,'2027-02').leaveTotal.medical,8);
  assert.equal(totals(data,'2027-02').leaveTotal.compoff,2);
  assert.equal(totals(data,'2027-02').leaveTotal.casual,5);
  assert.equal(totals(data,'2027-02').allowance.medical,0);
  assert.equal(totals(data,'2027-02').allowance.compoff,0);
});
