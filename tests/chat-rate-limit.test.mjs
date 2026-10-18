import test from 'node:test';
import assert from 'node:assert/strict';
import handler, { config } from '../netlify/functions/monthly-pocket-chat.mjs';

test('chat uses Netlify shared rate limiting within the platform maximum window', () => {
  assert.equal(config.path, '/api/monthly-pocket-chat');
  assert.deepEqual(config.rateLimit.aggregateBy, ['ip', 'domain']);
  assert.ok(config.rateLimit.windowSize <= 180);
  assert.ok(config.rateLimit.windowLimit > 0);
});

test('the per-instance limiter still blocks bursts from one visitor', async () => {
  const previous = process.env.GEMINI_API_KEY; delete process.env.GEMINI_API_KEY;
  const ask = ip => handler(new Request('https://pocket.test/api/monthly-pocket-chat', { method: 'POST', headers: { Origin: 'https://pocket.test', 'X-Requested-With': 'XmlHttpRequest', 'x-nf-client-connection-ip': ip }, body: JSON.stringify({ message: 'How much does it cost?' }) }));
  try {
    const statuses = [];
    for (let i = 0; i < config.rateLimit.windowLimit + 1; i++) statuses.push((await ask('203.0.113.9')).status);
    assert.equal(statuses.at(-1), 429);
    assert.ok(statuses.slice(0, -1).every(status => status === 200));
    assert.equal((await ask('203.0.113.10')).status, 200);
  } finally { if (previous !== undefined) process.env.GEMINI_API_KEY = previous; }
});
