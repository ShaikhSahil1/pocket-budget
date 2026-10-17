import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

const sessionCookie = '__Host-pocket_google_session';
const stateCookie = '__Host-pocket_google_state';
const sheetsScope = 'openid email https://www.googleapis.com/auth/drive.file';

function settings() {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const cookieSecret = process.env.COOKIE_SECRET;
  if (!clientId || !clientSecret || !cookieSecret || cookieSecret.length < 32) {
    throw new Error('Google sync server settings are incomplete.');
  }
  return { clientId, clientSecret, cookieSecret };
}

function cookieValue(request, name) {
  const source = request.headers.get('cookie') || '';
  for (const part of source.split(';')) {
    const [key, ...value] = part.trim().split('=');
    if (key === name) return decodeURIComponent(value.join('='));
  }
  return '';
}

function seal(value, secret) {
  const key = createHash('sha256').update(secret).digest();
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64url');
}

function open(value, secret) {
  const packed = Buffer.from(value, 'base64url');
  if (packed.length < 29) throw new Error('Invalid session.');
  const key = createHash('sha256').update(secret).digest();
  const decipher = createDecipheriv('aes-256-gcm', key, packed.subarray(0, 12));
  decipher.setAuthTag(packed.subarray(12, 28));
  return Buffer.concat([decipher.update(packed.subarray(28)), decipher.final()]).toString('utf8');
}

function sessionHeader(value, maxAge = 31536000) {
  return `${sessionCookie}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

function stateHeader(value, maxAge = 600) {
  return `${stateCookie}=${encodeURIComponent(value)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', ...headers },
  });
}

async function tokenRequest(values) {
  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(values),
  });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error_description || body.error || 'Google token request failed.');
  return body;
}

function requireSameOrigin(request) {
  const origin = request.headers.get('origin');
  if (!origin || origin !== new URL(request.url).origin || request.headers.get('x-requested-with') !== 'XmlHttpRequest') {
    throw new Error('Invalid request origin.');
  }
}

export default async (request) => {
  const url = new URL(request.url);
  const origin = url.origin;
  const redirectUri = `${origin}/api/google-auth`;

  try {
    const { clientId, clientSecret, cookieSecret } = settings();

    if (request.method === 'GET' && url.searchParams.get('action') === 'start') {
      const state = randomBytes(24).toString('base64url');
      const authorization = new URL('https://accounts.google.com/o/oauth2/v2/auth');
      authorization.search = new URLSearchParams({
        client_id: clientId,
        redirect_uri: redirectUri,
        response_type: 'code',
        scope: sheetsScope,
        access_type: 'offline',
        include_granted_scopes: 'true',
        prompt: 'select_account consent',
        state,
      });
      return new Response(null, {
        status: 302,
        headers: { Location: authorization.toString(), 'Set-Cookie': stateHeader(state), 'Cache-Control': 'no-store' },
      });
    }

    if (request.method === 'GET' && url.searchParams.has('code')) {
      const state = url.searchParams.get('state') || '';
      if (!state || state !== cookieValue(request, stateCookie)) return new Response('Invalid OAuth state.', { status: 400 });
      const tokens = await tokenRequest({
        code: url.searchParams.get('code'),
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri: redirectUri,
        grant_type: 'authorization_code',
      });
      if (!tokens.refresh_token) throw new Error('Google did not return a refresh token. Revoke the old Pocket Budget permission and connect again.');
      const headers = new Headers({ Location: '/app.html?google=connected', 'Cache-Control': 'no-store' });
      headers.append('Set-Cookie', sessionHeader(seal(tokens.refresh_token, cookieSecret)));
      headers.append('Set-Cookie', stateHeader('', 0));
      return new Response(null, { status: 302, headers });
    }

    if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405, { Allow: 'GET, POST' });
    requireSameOrigin(request);
    const body = await request.json();
    const sealedRefreshToken = cookieValue(request, sessionCookie);

    if (body.action === 'refresh') {
      if (!sealedRefreshToken) return json({ error: 'Not connected.' }, 401);
      let refreshToken;
      try { refreshToken = open(sealedRefreshToken, cookieSecret); }
      catch { return json({ error: 'Invalid session. Connect Google again.' }, 401, { 'Set-Cookie': sessionHeader('', 0) }); }
      try {
        const tokens = await tokenRequest({
          client_id: clientId,
          client_secret: clientSecret,
          refresh_token: refreshToken,
          grant_type: 'refresh_token',
        });
        if (!String(tokens.scope || '').split(' ').includes('https://www.googleapis.com/auth/drive.file')) {
          throw new Error('Please sign in again to allow your private Pocket spreadsheet.');
        }
        const identityResponse = await fetch('https://openidconnect.googleapis.com/v1/userinfo', {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        });
        const identity = await identityResponse.json();
        if (!identityResponse.ok || !identity.sub || !identity.email || !identity.email_verified) {
          throw new Error('Please sign in again to enable private account storage.');
        }
        return json({ access_token: tokens.access_token, expires_in: tokens.expires_in,
          account: { id: identity.sub, email: identity.email } });
      } catch (error) {
        return json({ error: error.message }, 401, { 'Set-Cookie': sessionHeader('', 0) });
      }
    }

    if (body.action === 'logout') {
      if (sealedRefreshToken) {
        try {
          const refreshToken = open(sealedRefreshToken, cookieSecret);
          await fetch('https://oauth2.googleapis.com/revoke', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({ token: refreshToken }),
          });
        } catch {}
      }
      return json({ ok: true }, 200, { 'Set-Cookie': sessionHeader('', 0) });
    }

    return json({ error: 'Unknown action.' }, 400);
  } catch (error) {
    return json({ error: error.message || 'Google authentication failed.' }, 500);
  }
};

export const config = { path: '/api/google-auth' };
