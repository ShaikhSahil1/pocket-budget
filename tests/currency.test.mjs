import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
function setup() {
  const elements = new Map();
  const $ = id => {
    if (!elements.has(id)) elements.set(id, { value: '', append() {}, replaceChildren() {}, setAttribute() {}, showModal() {}, close() {} });
    return elements.get(id);
  };
  const c = { $, data: { currency: 'INR' }, pocketStorageKey: 'A', render() {}, toast() {}, document: { createElement: () => $('created-' + elements.size), body: { append() {}, classList: { contains: () => false } } }, persist() { c.saved = JSON.stringify(c.data); return true; } };
  vm.createContext(c);
  vm.runInContext(fs.readFileSync('currency-support.js', 'utf8'), c);
  vm.runInContext(fs.readFileSync('currency-settings.js', 'utf8'), c);
  const choose = code => { $('currency').value = code; $('currency').onchange(); };
  return { c, $, choose };
}
test('supports currencies beyond original four and rejects unknown codes', () => {
  const { c } = setup();
  for (const code of ['INR', 'USD', 'JPY', 'AED', 'AUD', 'CAD', 'CHF', 'SGD', 'ZAR']) assert.equal(c.isPocketCurrency(code), true);
  assert.equal(c.isPocketCurrency('INVALID'), false); assert.equal(c.isPocketCurrency('ZZZ'), false);
  assert.equal(c.currentPocketCurrency(), 'INR');
});
test('cancel keeps INR; temporary currency changes neither saved data nor other accounts', () => {
  const { c, $, choose } = setup();
  choose('JPY'); $('currency-cancel').onclick(); assert.equal(c.currentPocketCurrency(), 'INR');
  choose('JPY'); $('currency-temporary').onclick(); assert.equal(c.currentPocketCurrency(), 'JPY');
  assert.equal(c.data.currency, 'INR'); assert.equal(c.saved, undefined);
  c.pocketStorageKey = 'B'; assert.equal(c.currentPocketCurrency(), 'INR');
});
test('permanent currency persists; failed storage restores previous preference', () => {
  const { c, $, choose } = setup(); choose('AED'); $('currency-save').onclick();
  assert.equal(JSON.parse(c.saved).currency, 'AED'); assert.equal(c.currentPocketCurrency(), 'AED');
  c.persist = () => false; choose('JPY'); $('currency-save').onclick(); assert.equal(c.data.currency, 'AED');
});
test('account switch invalidates an open currency prompt', () => {
  const { c, $, choose } = setup(); choose('JPY'); c.pocketStorageKey = 'B'; $('currency-save').onclick();
  assert.equal(c.saved, undefined); assert.equal(c.data.currency, 'INR');
});
