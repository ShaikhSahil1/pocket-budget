import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/google-auth.mjs';

test('a readable signed-in hint is set at login and cleared at logout or session expiry', async () => {
  const keys = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'COOKIE_SECRET', 'RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET'];
  const previous = { fetch: globalThis.fetch, env: Object.fromEntries(keys.map(key => [key, process.env[key]])) };
  Object.assign(process.env, { GOOGLE_CLIENT_ID: 'client', GOOGLE_CLIENT_SECRET: 'secret', COOKIE_SECRET: 'h'.repeat(40) });
  delete process.env.RAZORPAY_KEY_ID; delete process.env.RAZORPAY_KEY_SECRET;
  let valid = true;
  globalThis.fetch = async url => {
    if (url === 'https://oauth2.googleapis.com/token') return { ok: true, json: async () => ({ access_token: 'a', refresh_token: 'r', expires_in: 3600, scope: 'openid email https://www.googleapis.com/auth/drive.file' }) };
    if (url === 'https://openidconnect.googleapis.com/v1/userinfo') return { ok: valid, json: async () => valid ? ({ sub: 'acc', email: 'a@example.com', email_verified: true }) : ({}) };
    return { ok: true, json: async () => ({}) };
  };
  const hint = response => response.headers.getSetCookie().find(value => value.startsWith('__Host-pocket_signed_in='));
  try {
    const start = await handler(new Request('https://pocket.test/api/google-auth?action=start'));
    const state = new URL(start.headers.get('location')).searchParams.get('state');
    const callback = await handler(new Request('https://pocket.test/api/google-auth?code=x&state=' + state, { headers: { Cookie: '__Host-pocket_google_state=' + state } }));
    const set = hint(callback);
    assert.match(set, /^__Host-pocket_signed_in=1; Path=\/; Secure; SameSite=Lax; Max-Age=31536000$/);
    assert.ok(!/HttpOnly/i.test(set));
    const session = callback.headers.getSetCookie().find(value => value.startsWith('__Host-pocket_google_session=')).split(';')[0];
    const post = (cookie, action = 'refresh') => handler(new Request('https://pocket.test/api/google-auth', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://pocket.test', 'X-Requested-With': 'XmlHttpRequest' }, body: JSON.stringify({ action }) }));
    assert.match(hint(await post(session)), /=1;/, 'older sessions receive the hint on refresh');
    assert.equal(hint(await post(session + '; __Host-pocket_signed_in=1')), undefined, 'not re-sent when present');
    valid = false;
    assert.match(hint(await post(session + '; __Host-pocket_signed_in=1')), /Max-Age=0/);
    valid = true;
    assert.match(hint(await post(session, 'logout')), /Max-Age=0/);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [key, value] of Object.entries(previous.env)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  }
});
