import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('leaves.js', 'utf8').split('(() => {')[0];
const context = vm.createContext({ Date, Number, Error, Set, Array, localDate: date => date.toISOString().slice(0, 10) });
vm.runInContext(source, context);

const leaves = days => ({ allowances: {}, entries: [{ id: 'leave-1', type: 'casual', date: '2026-11-01', days, notes: '' }] });

test('leave records allow any positive number of days in half-day steps', () => {
  for (const days of [0.5, 1, 1.5, 3, 10, 30.5]) assert.doesNotThrow(() => context.validateLeaves(leaves(days)));
});

test('leave records still reject zero, negative and unsupported fractions', () => {
  for (const days of [0, -1, 1.25, Number.NaN]) assert.throws(() => context.validateLeaves(leaves(days)));
});
