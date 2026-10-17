import { CHAT_MODEL, cleanHistory, cleanMessage, fallbackAnswer, systemPrompt } from './_chat-core.mjs';

const requests = new Map();
const WINDOW_MS = 5 * 60 * 1000;
const MAX_REQUESTS = 12;

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

function sameOrigin(request) {
  const origin = request.headers.get('origin');
  return origin && origin === new URL(request.url).origin && request.headers.get('x-requested-with') === 'XmlHttpRequest';
}

function rateLimited(request) {
  const forwarded = request.headers.get('x-nf-client-connection-ip') || request.headers.get('x-forwarded-for') || 'unknown';
  const client = forwarded.split(',')[0].trim();
  const now = Date.now();
  const recent = (requests.get(client) || []).filter(time => now - time < WINDOW_MS);
  recent.push(now);
  requests.set(client, recent);
  return recent.length > MAX_REQUESTS;
}

export default async request => {
  if (request.method !== 'POST') return json({ error: 'Method not allowed.' }, 405);
  if (!sameOrigin(request)) return json({ error: 'Invalid request origin.' }, 403);
  if (rateLimited(request)) return json({ error: 'Please wait a few minutes before asking again.' }, 429);

  let body;
  try { body = await request.json(); }
  catch { return json({ error: 'Invalid request.' }, 400); }
  const message = cleanMessage(body.message);
  if (!message) return json({ error: 'Write a question first.' }, 400);

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return json({ reply: fallbackAnswer(message), mode: 'built-in' });

  try {
    const model = cleanMessage(process.env.GEMINI_MODEL, 80) || CHAT_MODEL;
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        systemInstruction: { parts: [{ text: systemPrompt() }] },
        contents: [...cleanHistory(body.history), { role: 'user', parts: [{ text: message }] }],
        generationConfig: { temperature: 0.25, maxOutputTokens: 300 },
      }),
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error?.message || 'Gemini is temporarily unavailable.');
    const reply = result.candidates?.[0]?.content?.parts?.map(part => part.text || '').join('').trim();
    if (!reply) throw new Error('No answer was returned.');
    return json({ reply, mode: 'gemini' });
  } catch {
    return json({ reply: fallbackAnswer(message), mode: 'built-in', limited: true });
  }
};

export const config = { path: '/api/monthly-pocket-chat' };
