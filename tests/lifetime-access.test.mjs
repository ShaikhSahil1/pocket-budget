import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { createLifetimeOrder, getLifetimeStatus, restoreLifetimePayment, verifyLifetimePayment } from '../netlify/functions/_lifetime-access.mjs';

test('₹499 Razorpay payment is verified and restored only for its Google account', async () => {
  const previous = { fetch: globalThis.fetch, id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
  process.env.RAZORPAY_KEY_ID = 'rzp_test_example'; process.env.RAZORPAY_KEY_SECRET = 'razorpay-secret';
  const cookieSecret = 'cookie-secret-that-is-long-enough-for-testing';
  let license = '', hasLicenseSheet = false, orderNotes;
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value.startsWith('https://www.googleapis.com/drive/v3/files?')) return { ok: true, json: async () => ({ files: [{ id: 'sheet-A' }] }) };
    if (value.includes('/v4/spreadsheets/sheet-A?fields=')) return { ok: true, json: async () => ({ sheets: [{ properties: { title: 'Sheet1' } }, ...(hasLicenseSheet ? [{ properties: { title: 'PocketLicense' } }] : [])] }) };
    if (value.includes(':batchUpdate')) { hasLicenseSheet = true; return { ok: true, json: async () => ({}) }; }
    if (value.includes('/values/') && options.method === 'PUT') { license = JSON.parse(options.body).values[0][0]; return { ok: true, json: async () => ({}) }; }
    if (value.includes('/values/')) return { ok: true, json: async () => ({ values: license ? [[license]] : [] }) };
    if (value === 'https://api.razorpay.com/v1/orders' && options.method === 'POST') {
      const body = JSON.parse(options.body); assert.equal(body.amount, 49900); assert.equal(body.currency, 'INR'); orderNotes = body.notes;
      return { ok: true, json: async () => ({ id: 'order_Example123', amount: body.amount, currency: body.currency }) };
    }
    if (value.endsWith('/orders/order_Example123')) return { ok: true, json: async () => ({ id: 'order_Example123', status: 'paid', amount: 49900, amount_paid: 49900, currency: 'INR', notes: orderNotes }) };
    if (value.endsWith('/payments/pay_Example123')) return { ok: true, json: async () => ({ id: 'pay_Example123', order_id: 'order_Example123', status: 'captured', captured: true, amount: 49900, amount_refunded: 0, currency: 'INR', created_at: 1760720000 }) };
    throw new Error('Unexpected request: ' + value);
  };
  try {
    const account = { id: 'google-account-A', email: 'a@example.com' };
    assert.equal((await getLifetimeStatus({ accessToken: 'token', accountId: account.id, cookieSecret })).entitled, false);
    const order = await createLifetimeOrder({ accessToken: 'token', account, cookieSecret });
    assert.equal(order.amount, 49900); assert.equal(order.keyId, 'rzp_test_example');
    await assert.rejects(() => verifyLifetimePayment({ accessToken: 'token', account, cookieSecret, payment: { orderId: order.orderId, paymentId: 'pay_Example123', signature: '0'.repeat(64) } }), /signature/);
    const signature = createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update('order_Example123|pay_Example123').digest('hex');
    assert.equal((await verifyLifetimePayment({ accessToken: 'token', account, cookieSecret, payment: { orderId: order.orderId, paymentId: 'pay_Example123', signature } })).entitled, true);
    assert.ok(license); assert.equal((await getLifetimeStatus({ accessToken: 'token', accountId: account.id, cookieSecret })).entitled, true);
    license = '';
    assert.equal((await restoreLifetimePayment({ accessToken: 'token', account, cookieSecret, paymentId: 'pay_Example123' })).entitled, true);
    await assert.rejects(() => restoreLifetimePayment({ accessToken: 'token', account: { id: 'google-account-B', email: 'b@example.com' }, cookieSecret, paymentId: 'pay_Example123' }), /No eligible/);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [['RAZORPAY_KEY_ID', previous.id], ['RAZORPAY_KEY_SECRET', previous.secret]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});

test('payments remain disabled without Razorpay keys so deploys cannot lock existing users', async () => {
  const previous = { id: process.env.RAZORPAY_KEY_ID, secret: process.env.RAZORPAY_KEY_SECRET };
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  try {
    const status = await getLifetimeStatus({ accessToken: 'unused', accountId: 'account', cookieSecret: 'secret' });
    assert.equal(status.enabled, false); assert.equal(status.entitled, true);
  } finally {
    for (const [name, value] of [['RAZORPAY_KEY_ID', previous.id], ['RAZORPAY_KEY_SECRET', previous.secret]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
