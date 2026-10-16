import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../netlify/functions/google-auth.mjs';

test('OAuth verifies identity on the server and requires private-file access', async () => {
  const previous = { fetch: globalThis.fetch, client: process.env.GOOGLE_CLIENT_ID, secret: process.env.GOOGLE_CLIENT_SECRET, cookie: process.env.COOKIE_SECRET };
  process.env.GOOGLE_CLIENT_ID = 'test-client'; process.env.GOOGLE_CLIENT_SECRET = 'test-secret'; process.env.COOKIE_SECRET = 'x'.repeat(32);
  let identityValid = true, scope = 'openid email https://www.googleapis.com/auth/drive.file';
  globalThis.fetch = async (url, options) => {
    if (url === 'https://oauth2.googleapis.com/token') return { ok: true, json: async () => ({ access_token: 'test-access', refresh_token: 'test-refresh', expires_in: 3600, scope }) };
    assert.equal(url, 'https://openidconnect.googleapis.com/v1/userinfo');
    assert.equal(options.headers.Authorization, 'Bearer test-access');
    return { ok: identityValid, json: async () => identityValid ? ({ sub: 'account-A', email: 'a@example.com', email_verified: true }) : ({ error: 'invalid_token' }) };
  };
  try {
    const start = await handler(new Request('https://pocket.test/api/google-auth?action=start'));
    const authorization = new URL(start.headers.get('location'));
    assert.ok(authorization.searchParams.get('scope').includes('openid email'));
    assert.ok(!authorization.searchParams.get('scope').includes('/auth/spreadsheets'));
    assert.equal(authorization.searchParams.get('prompt'), 'select_account consent');
    const state = authorization.searchParams.get('state');
    const callback = await handler(new Request('https://pocket.test/api/google-auth?code=example&state=' + state, { headers: { Cookie: '__Host-pocket_google_state=' + state } }));
    assert.equal(callback.status, 302);
    const cookie = callback.headers.getSetCookie().find(value => value.startsWith('__Host-pocket_google_session=')).split(';')[0];
    assert.ok(!cookie.includes('test-refresh'));
    const request = () => new Request('https://pocket.test/api/google-auth', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://pocket.test', 'X-Requested-With': 'XmlHttpRequest', 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'refresh' }) });
    const response = await handler(request());
    const body = await response.json();
    assert.deepEqual(body.account, { id: 'account-A', email: 'a@example.com' });
    assert.equal(body.refresh_token, undefined);
    identityValid = false; assert.equal((await handler(request())).status, 401);
    identityValid = true; scope = 'https://www.googleapis.com/auth/spreadsheets';
    assert.equal((await handler(request())).status, 401);
    const wrongOrigin = new Request('https://pocket.test/api/google-auth', { method: 'POST', headers: { Origin: 'https://other.test', 'X-Requested-With': 'XmlHttpRequest' }, body: JSON.stringify({ action: 'refresh' }) });
    assert.notEqual((await handler(wrongOrigin)).status, 200);
  } finally {
    globalThis.fetch = previous.fetch;
    for (const [name, value] of [['GOOGLE_CLIENT_ID', previous.client], ['GOOGLE_CLIENT_SECRET', previous.secret], ['COOKIE_SECRET', previous.cookie]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  }
});
