import test from 'node:test';
import assert from 'node:assert/strict';
import { CHAT_MODEL, cleanHistory, cleanMessage, fallbackAnswer, systemPrompt } from '../netlify/functions/_chat-core.mjs';

test('chat input is cleaned and bounded before it reaches Gemini', () => {
  assert.equal(cleanMessage('  hello\n\u0000 world  '), 'hello world');
  assert.equal(cleanMessage('x'.repeat(900)).length, 800);
  const history = cleanHistory(Array.from({ length: 9 }, (_, index) => ({ role: index % 2 ? 'model' : 'user', text: `message ${index}` })));
  assert.equal(history.length, 6);
  assert.equal(history[0].parts[0].text, 'message 3');
});

test('built-in guide answers common product questions without an API key', () => {
  assert.match(fallbackAnswer('Can I pay using UPI?'), /₹499 once/);
  assert.match(fallbackAnswer('I deleted my sheet'), /Drive Trash/);
  assert.match(fallbackAnswer('Where is my data stored?'), /private Google Sheet/);
});

test('Gemini prompt stays product-only and protects sensitive data', () => {
  assert.equal(CHAT_MODEL, 'gemini-2.5-flash-lite');
  assert.match(systemPrompt(), /Answer only questions about Monthly Pocket/);
  assert.match(systemPrompt(), /Never ask for or accept passwords/);
});
