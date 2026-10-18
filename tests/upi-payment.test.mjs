import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync('upi-payment.js', 'utf8').split('(() => {')[0];
const context = vm.createContext({ URL, URLSearchParams, Number, String, Error, RegExp, Array, Object });
vm.runInContext(fs.readFileSync('categories.js', 'utf8'), context);
vm.runInContext(source, context);

test('UPI expenses use the shared category list', () => {
  assert.equal(source.includes("'Monthly Travelling'"), false);
  assert.throws(() => context.pocketUpiExpense({}, { id: 'x', name: 'Tea', amount: 5, date: '2026-10-18', category: 'Groceries' }));
});

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

test('detects iPhone, iPad, Android and desktop browsers', () => {
  assert.equal(context.pocketUpiPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X)', 'iPhone', 5), 'ios');
  assert.equal(context.pocketUpiPlatform('Mozilla/5.0 (Macintosh)', 'MacIntel', 5), 'ios');
  assert.equal(context.pocketUpiPlatform('Mozilla/5.0 (Linux; Android 15; Pixel 9)', 'Linux armv8l', 5), 'android');
  assert.equal(context.pocketUpiPlatform('Mozilla/5.0 (Windows NT 10.0)', 'Win32', 0), 'other');
});

test('lists popular UPI apps with an iOS scheme and Android package', () => {
  const apps = context.pocketUpiApps();
  assert.equal(apps.map(app => app.id).join(','), ['gpay', 'phonepe', 'paytm', 'cred', 'bhim'].join(','));
  for (const app of apps) {
    assert.match(app.ios, /^[a-z]+:\/\/.+\?$/);
    assert.match(app.android, /^[a-z0-9_]+(\.[a-z0-9_]+)+$/i);
  }
});

test('builds iOS app links and Android intents for a chosen app', () => {
  const draft = { upiId: 'cafe@okaxis', payeeName: 'Corner Cafe', amount: 120, note: 'Tea', reference: 'MP9' };
  assert.ok(context.pocketBuildUpiPaymentUrl(draft, 'phonepe', 'ios').startsWith('phonepe://pay?pa=cafe%40okaxis'));
  assert.ok(context.pocketBuildUpiPaymentUrl(draft, 'paytm', 'ios').startsWith('paytmmp://pay?'));
  const intent = context.pocketBuildUpiPaymentUrl(draft, 'phonepe', 'android', 'https://pocketmonthlybudget.netlify.app/app.html#upi-app-missing');
  assert.ok(intent.startsWith('intent://pay?pa=cafe%40okaxis'));
  assert.match(intent, /#Intent;scheme=upi;package=com\.phonepe\.app;S\.browser_fallback_url=https%3A%2F%2Fpocketmonthlybudget\.netlify\.app%2Fapp\.html%23upi-app-missing;end$/);
  assert.equal(context.pocketBuildUpiPaymentUrl(draft, 'gpay', 'android', 'javascript:alert(1)').includes('browser_fallback_url'), false);
  assert.ok(context.pocketBuildUpiPaymentUrl(draft, 'generic', 'android').startsWith('upi://pay?'));
  assert.throws(() => context.pocketBuildUpiPaymentUrl(draft, 'unknown-app', 'ios'));
});

test('records which app the user chose in the confirmed expense', () => {
  const expense = context.pocketUpiExpense({ upiId: 'cafe@okaxis', appLabel: 'PhonePe' }, { id: 'e2', name: 'Tea', amount: 120, date: '2026-10-18', category: 'Personal Buying', details: '' });
  assert.match(expense.details, /via PhonePe/);
});

test('opens a UPI app with no payee, amount or QR filled in', () => {
  assert.equal(context.pocketUpiOpenAppUrl('phonepe', 'ios'), 'phonepe://');
  assert.equal(context.pocketUpiOpenAppUrl('gpay', 'ios'), 'gpay://');
  const intent = context.pocketUpiOpenAppUrl('paytm', 'android', 'https://pocketmonthlybudget.netlify.app/app.html#upi-app-missing');
  assert.match(intent, /^intent:\/\/#Intent;scheme=paytmmp;package=net\.one97\.paytm;S\.browser_fallback_url=https%3A%2F%2F.+;end$/);
  assert.equal(intent.includes('pa='), false);
  assert.equal(context.pocketUpiOpenAppUrl('gpay', 'android', 'javascript:alert(1)').includes('browser_fallback_url'), false);
  assert.throws(() => context.pocketUpiOpenAppUrl('unknown', 'ios'));
});

test('an expense from an open-app payment needs only what the user enters on return', () => {
  const expense = context.pocketUpiExpense({ upiId: '', appLabel: 'Google Pay' }, { id: 'e3', name: 'Groceries', amount: '640', date: '2026-10-18', category: 'Personal Buying', details: '' });
  assert.equal(expense.amount, 640);
  assert.match(expense.details, /User-confirmed UPI payment · not bank-verified · via Google Pay/);
  assert.equal(expense.details.includes('Paid to'), false);
});
