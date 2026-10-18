import test from 'node:test';
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import handler from '../netlify/functions/google-auth.mjs';

const cookieSecret = 'c'.repeat(40);
const accountHash = id => createHmac('sha256', cookieSecret).update(`monthly-pocket:${id}`).digest('hex').slice(0, 32);
function license(account) {
  const encoded = Buffer.from(JSON.stringify({ v: 1, account, paymentId: 'pay_Cache1', orderId: 'order_Cache1', amount: 19900, currency: 'INR', paidAt: '2026-10-18T00:00:00.000Z' })).toString('base64url');
  return `${encoded}.${createHmac('sha256', cookieSecret).update(encoded).digest('base64url')}`;
}

test('a verified purchase is cached in a sealed cookie so refreshes skip Drive and Razorpay', async () => {
  const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'COOKIE_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
  const previous = { fetch: globalThis.fetch, env: Object.fromEntries(keys.map(key => [key, process.env[key]])) };
  Object.assign(process.env, { GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', COOKIE_SECRET: cookieSecret, RAZORPAY_KEY_ID: 'rzp_test_cache', RAZORPAY_KEY_SECRET: 'rzp-secret' });
  let account = 'account-A', refunded = 0;
  const calls = { drive: 0, razorpay: 0 };
  globalThis.fetch = async (url, options = {}) => {
    const value = String(url);
    if (value === 'https://oauth2.googleapis.com/token') return { ok: true, json: async () => ({ access_token: 'access', refresh_token: 'refresh', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/drive.file' }) };
    if (value === 'https://openidconnect.googleapis.com/v1/userinfo') return { ok: true, json: async () => ({ sub: account, email: account + '@example.com', email_verified: true }) };
    if (value === 'https://oauth2.googleapis.com/revoke') return { ok: true, json: async () => ({}) };
    if (value.startsWith('https://www.googleapis.com/drive/')) { calls.drive++; return { ok: true, json: async () => ({ files: [{ id: 'sheet-1' }] }) }; }
    if (value.includes('?fields=sheets')) return { ok: true, json: async () => ({ sheets: [{ properties: { title: 'PocketLicense' } }] }) };
    if (value.includes('/values/')) return { ok: true, json: async () => ({ values: [[license(account)]] }) };
    if (value.endsWith('/orders/order_Cache1')) { calls.razorpay++; return { ok: true, json: async () => ({ id: 'order_Cache1', status: 'paid', amount: 19900, amount_paid: 19900, currency: 'INR', notes: { product: 'monthly-pocket-lifetime', account_hash: accountHash(account) } }) }; }
    if (value.endsWith('/payments/pay_Cache1')) { calls.razorpay++; return { ok: true, json: async () => ({ id: 'pay_Cache1', order_id: 'order_Cache1', status: 'captured', captured: true, amount: 19900, amount_refunded: refunded, currency: 'INR' }) }; }
    throw new Error('Unexpected request ' + value);
  };
  try {
    const start = await handler(new Request('https://pocket.test/api/google-auth?action=start'));
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await handler(new Request('https://pocket.test/api/google-auth?code=x&state=' + state, { headers: { Cookie: '__Host-pocket_google_state=' + state } }));
    const session = callback.headers.getSetCookie().find(value => value.startsWith('__Host-pocket_google_session=')).split(';')[0];
    const post = (cookies, action = 'refresh') => handler(new Request('https://pocket.test/api/google-auth', { method: 'POST', headers: { Cookie: cookies.join('; '), Origin: 'https://pocket.test', 'X-Requested-With': 'XmlHttpRequest' }, body: JSON.stringify({ action }) }));
    const cacheCookie = response => response.headers.getSetCookie().find(value => value.startsWith('__Host-pocket_entitlement='));

    const first = await post([session]);
    assert.equal((await first.json()).entitled, true);
    assert.equal(calls.razorpay, 2);
    const cached = cacheCookie(first);
    assert.match(cached, /HttpOnly; Secure; SameSite=Strict; Max-Age=21600/);
    const entitlement = cached.split(';')[0];
    assert.ok(!entitlement.includes('account-A'));

    calls.drive = calls.razorpay = 0;
    for (let i = 0; i < 3; i++) assert.equal((await (await post([session, entitlement])).json()).entitled, true);
    assert.deepEqual(calls, { drive: 0, razorpay: 0 });

    // The cookie is bound to the Google account: another account re-verifies.
    account = 'account-B'; refunded = 19900;
    const other = await post([session, entitlement]);
    assert.equal((await other.json()).entitled, false);
    assert.ok(calls.razorpay > 0);
    assert.match(cacheCookie(other), /Max-Age=0/);

    // A tampered cookie is ignored rather than trusted.
    account = 'account-A'; refunded = 0; calls.razorpay = 0;
    await post([session, entitlement.slice(0, -2) + 'xx']);
    assert.equal(calls.razorpay, 2);

    const logout = await post([session, entitlement], 'logout');
    const cleared = logout.headers.getSetCookie();
    assert.ok(cleared.some(value => value.startsWith('__Host-pocket_google_session=;') && value.includes('Max-Age=0')));
    assert.ok(cleared.some(value => value.startsWith('__Host-pocket_entitlement=;') && value.includes('Max-Age=0')));
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries(previous.env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
