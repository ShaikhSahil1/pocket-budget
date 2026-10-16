import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function setup() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, disabled: false, textContent: '', append() {}, setAttribute() {}, reset() { for (const el of elements.values()) { el.checked = false; el.value = ''; } }, showModal() { this.open = true; }, close() { this.open = false; }, click() {} });
    return elements.get(id);
  };
  const data = { balances: { '2026-09': 90, '2026-10': 100, '2026-11': 110 }, expenses: [ { id: 'a', date: '2026-09-30' }, { id: 'b', date: '2026-10-01' }, { id: 'c', date: '2026-10-31' }, { id: 'd', date: '2026-11-01' } ], currency: 'INR', leaves: { allowances: { '2026-10': { casual: 2, medical: 1, compoff: 1 } }, entries: [ { id: 'l1', date: '2026-10-12' }, { id: 'l2', date: '2026-11-12' } ] } };
  const ctx = { $, data, pocketStorageKey: 'account-A', tab: 'Overview', Date, Object, JSON, Error, render() {}, toast() {}, persist() { ctx.saved = JSON.stringify(ctx.data); return true; }, document: { createElement: () => { const el = $('created-' + elements.size); Object.defineProperty(el, 'id', { set: id => elements.set(id, el) }); return el; }, querySelector: () => $('actions'), body: { append() {}, classList: { contains: () => false } } } };
  vm.createContext(ctx); vm.runInContext(fs.readFileSync('month-tools.js', 'utf8'), ctx);
  const open = () => { $('month').value = '2026-10'; $('clear-month').onclick(); $('month').value = '2026-10'; };
  const submit = () => { $('clear-month-confirm').value = '2026-10'; $('clear-month-form').onsubmit({ preventDefault() {} }); };
  return { ctx, $, open, submit };
}

test('budget clearing removes only selected-month expenses and balance, across all categories', () => {
  const { ctx } = setup(), original = JSON.stringify(ctx.data);
  const next = ctx.clearPocketMonth(ctx.data, '2026-10', { budget: true });
  assert.deepEqual(Array.from(next.expenses, e => e.id), ['a', 'd']);
  assert.equal(next.balances['2026-10'], undefined);
  assert.equal(next.balances['2026-09'], 90); assert.equal(next.balances['2026-11'], 110);
  assert.equal(JSON.stringify(next.leaves), JSON.stringify(ctx.data.leaves));
  assert.equal(JSON.stringify(ctx.data), original);
});
test('leave clearing preserves all allowances and every other month', () => {
  const { ctx } = setup(); const next = ctx.clearPocketMonth(ctx.data, '2026-10', { leaves: true });
  assert.deepEqual(Array.from(next.leaves.entries, e => e.id), ['l2']);
  assert.equal(JSON.stringify(next.leaves.allowances), JSON.stringify(ctx.data.leaves.allowances));
  assert.equal(JSON.stringify(next.balances), JSON.stringify(ctx.data.balances));
  assert.equal(JSON.stringify(next.expenses), JSON.stringify(ctx.data.expenses));
});
test('combined deletion, legacy data and invalid month handling', () => {
  const { ctx } = setup(); const next = ctx.clearPocketMonth(ctx.data, '2026-10', { budget: true, leaves: true });
  assert.equal(next.expenses.length, 2); assert.equal(next.leaves.entries.length, 1);
  assert.throws(() => ctx.clearPocketMonth(ctx.data, '2026-13', { budget: true }));
  assert.throws(() => ctx.clearPocketMonth(ctx.data, '2026-10', {}));
  delete ctx.data.leaves; assert.doesNotThrow(() => ctx.clearPocketMonth(ctx.data, '2026-10', { leaves: true }));
});
test('opening and cancelling never changes data; exact month is required', () => {
  const { ctx, $, open } = setup(); const original = JSON.stringify(ctx.data); open();
  $('clear-month-confirm').value = '2026-09'; $('clear-month-form').onsubmit({ preventDefault() {} });
  assert.equal(JSON.stringify(ctx.data), original); assert.equal(ctx.saved, undefined);
  $('clear-month-cancel').onclick(); assert.equal(JSON.stringify(ctx.data), original);
});
test('confirmed deletion persists and local save failure restores the previous data', () => {
  const { ctx, open, submit } = setup(); open(); submit();
  assert.equal(ctx.data.expenses.length, 2); assert.ok(ctx.saved);
  const failed = setup(), original = JSON.stringify(failed.ctx.data); failed.ctx.persist = () => false;
  failed.open(); failed.submit(); assert.equal(JSON.stringify(failed.ctx.data), original);
});
test('changing month, account or data invalidates confirmation', () => {
  for (const change of [app => app.$('month').value = '2026-11', app => app.ctx.pocketStorageKey = 'account-B', app => app.ctx.data.expenses.push({ date: '2026-10-02' })]) {
    const app = setup(); app.open(); change(app); const before = JSON.stringify(app.ctx.data); app.submit();
    assert.equal(JSON.stringify(app.ctx.data), before); assert.equal(app.ctx.saved, undefined);
  }
});
