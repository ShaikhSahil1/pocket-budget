import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('upi-payment.js', 'utf8').split('(() => {')[0];
const context = vm.createContext({ URL, URLSearchParams, Number, String, Error, RegExp, Array });
vm.runInContext(source, context);

test('validates UPI IDs and rejects malformed recipients', () => {
  assert.equal(context.pocketValidUpiId('cafe.corner@okaxis'), true);
  assert.equal(context.pocketValidUpiId('not-a-upi-id'), false);
  assert.equal(context.pocketValidUpiId('x@y'), false);
});

test('reads recipient, amount and note from a UPI QR payload', () => {
  const parsed = context.pocketParseUpiPayment('upi://pay?pa=cafe%40okaxis&pn=Corner%20Cafe&am=500.25&cu=INR&tn=Breakfast');
  assert.equal(parsed.upiId, 'cafe@okaxis');
  assert.equal(parsed.payeeName, 'Corner Cafe');
  assert.equal(parsed.amount, 500.25);
  assert.equal(parsed.note, 'Breakfast');
  assert.equal(parsed.currency, 'INR');
  assert.equal(context.pocketParseUpiPayment('https://example.com/qr'), null);
});

test('builds iOS Google Pay and standard UPI links with encoded values', () => {
  const draft = { upiId: 'cafe@okaxis', payeeName: 'Corner Cafe', amount: 500, note: 'Tea & snacks', reference: 'MP123' };
  const googlePay = context.pocketBuildUpiPaymentUrl(draft, 'gpay');
  const generic = context.pocketBuildUpiPaymentUrl(draft);
  assert.ok(googlePay.startsWith('gpay://upi/pay?'));
  assert.ok(generic.startsWith('upi://pay?'));
  const params = new URL(googlePay).searchParams;
  assert.equal(params.get('pa'), 'cafe@okaxis');
  assert.equal(params.get('am'), '500.00');
  assert.equal(params.get('cu'), 'INR');
  assert.equal(params.get('tn'), 'Tea & snacks');
  assert.throws(() => context.pocketBuildUpiPaymentUrl({ ...draft, upiId: 'wrong' }));
});

test('creates an edited, explicitly user-confirmed expense record', () => {
  const expense = context.pocketUpiExpense({ upiId: 'cafe@okaxis' }, { id: 'expense-1', name: 'Breakfast', amount: '475.50', date: '2026-10-18', category: 'Personal Buying', details: 'Amount changed in payment app' });
  assert.equal(expense.amount, 475.5);
  assert.match(expense.details, /User-confirmed UPI payment/);
  assert.match(expense.details, /not bank-verified/);
  assert.match(expense.details, /cafe@okaxis/);
  assert.equal(expense.refundable, false);
  assert.throws(() => context.pocketUpiExpense({}, { id: 'bad', name: '', amount: 0, date: 'bad', category: 'Other', details: '' }));
});
