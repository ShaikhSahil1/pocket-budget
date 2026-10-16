import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { webcrypto } from 'node:crypto';

function setup() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { value: '', checked: false, hidden: false, parentElement: {}, append() {}, setAttribute() {}, showModal() { this.open = true; }, close() { this.open = false; } });
    return elements.get(id);
  };
  const c = { $, data: { balances: {}, expenses: [], currency: 'INR' }, pocketStorageKey: 'A', crypto: webcrypto, cats: [], isPocketCurrency: code => code === 'INR', validateLeaves() {}, esc: text => String(text).replaceAll('<', '&lt;'), render() {}, toast() {}, confirm: () => true, document: { createElement: () => $('created-' + elements.size), body: { append() {}, classList: { contains: () => false } } } };
  c.persist = () => { c.saved = JSON.stringify(c.data); c.render(); return true; };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync('backup-validation.js', 'utf8'), c);
  vm.runInContext(fs.readFileSync('travel-planner.js', 'utf8'), c);
  const submit = id => $(id).onsubmit({ preventDefault() {} });
  const action = (name, kind, item) => $('plan-detail').onclick({ target: { closest: () => ({ dataset: { action: name, kind, item } }) } });
  const plan = () => { $('plan-add').onclick(); $('plan-title').value = 'Goa trip'; $('plan-notes').value = 'Train details'; submit('plan-form'); };
  const item = (kind, text) => { action('add-item', kind); $('plan-item-text').value = text; submit('plan-item-form'); };
  return { c, $, submit, action, plan, item };
}
test('planner notes and both checklists persist and survive a full backup round-trip', () => {
  const app = setup(); app.plan(); app.item('packing', 'Passport'); app.item('tasks', 'Book hotel');
  const restored = app.c.validatePocketBackup(JSON.parse(app.c.saved));
  assert.equal(restored.travelPlans[0].title, 'Goa trip'); assert.equal(restored.travelPlans[0].notes, 'Train details');
  assert.equal(restored.travelPlans[0].packing[0].text, 'Passport'); assert.equal(restored.travelPlans[0].tasks[0].text, 'Book hotel');
  assert.equal(restored.travelPlans[0].packing[0].done, false);
});
test('complete, edit and delete items independently without losing their status', () => {
  const app = setup(); app.plan(); app.item('packing', 'Passport'); app.item('tasks', 'Book hotel');
  const id = app.c.data.travelPlans[0].packing[0].id;
  app.$('plan-detail').onchange({ target: { dataset: { kind: 'packing', item: id }, checked: true } });
  assert.equal(app.c.data.travelPlans[0].packing[0].done, true);
  app.action('edit-item', 'packing', id); app.$('plan-item-text').value = 'Passport and visa'; app.submit('plan-item-form');
  assert.equal(app.c.data.travelPlans[0].packing[0].done, true);
  app.action('delete-item', 'packing', id);
  assert.equal(app.c.data.travelPlans[0].packing.length, 0); assert.equal(app.c.data.travelPlans[0].tasks.length, 1);
});
test('delete plan asks first; cancellation leaves data untouched', () => {
  const app = setup(); app.plan(); app.item('tasks', 'Book hotel');
  app.c.confirm = () => false; app.action('delete-plan'); assert.equal(app.c.data.travelPlans.length, 1);
  app.c.confirm = () => true; app.action('delete-plan'); assert.equal(app.c.data.travelPlans.length, 0);
});
test('failed storage restores planner data; account switches reject stale forms', () => {
  const app = setup(); app.plan(); const before = JSON.stringify(app.c.data); app.c.persist = () => false;
  app.item('packing', 'Phone'); assert.equal(JSON.stringify(app.c.data), before);
  app.action('edit-plan'); app.c.pocketStorageKey = 'B'; app.$('plan-title').value = 'Another user'; app.submit('plan-form');
  assert.equal(JSON.stringify(app.c.data), before);
});
test('legacy backups work and malformed plans or duplicate IDs are rejected', () => {
  const app = setup(); assert.doesNotThrow(() => app.c.validatePocketBackup(app.c.data));
  app.plan(); app.item('tasks', 'Book hotel');
  const bad = JSON.parse(app.c.saved); bad.travelPlans[0].tasks[0].done = 'yes';
  assert.throws(() => app.c.validatePocketBackup(bad));
  const duplicate = JSON.parse(app.c.saved); duplicate.travelPlans.push(duplicate.travelPlans[0]);
  assert.throws(() => app.c.validatePocketBackup(duplicate));
});
