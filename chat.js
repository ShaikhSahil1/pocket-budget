(() => {
  const root = document.createElement('div');
  root.className = 'mp-chat';
  root.innerHTML = `
    <button class="mp-chat__launcher" type="button" aria-expanded="false" aria-controls="mp-chat-panel"><span aria-hidden="true">✦</span><b>Ask Monthly Pocket</b></button>
    <section class="mp-chat__panel" id="mp-chat-panel" aria-label="Monthly Pocket Chat" hidden>
      <header class="mp-chat__header"><div><span class="mp-chat__mark">◒</span><div><b>Monthly Pocket Chat</b><small>Product guide</small></div></div><button type="button" aria-label="Close chat">×</button></header>
      <div class="mp-chat__messages" role="log" aria-live="polite"><div class="mp-chat__message mp-chat__message--bot">Hi! Ask me how to use Monthly Pocket, manage your Sheet, restore access, or understand any feature.</div></div>
      <div class="mp-chat__suggestions"><button type="button">How do I start?</button><button type="button">Where is my data?</button><button type="button">Restore my access</button></div>
      <form class="mp-chat__form"><label for="mp-chat-input">Ask about Monthly Pocket</label><div><input id="mp-chat-input" maxlength="800" autocomplete="off" placeholder="Type your question…"><button type="submit" aria-label="Send question">↑</button></div></form>
      <p class="mp-chat__privacy">Don’t share financial or payment details. Chat text may be sent to Google Gemini. <a href="privacy-policy.html#assistant">Privacy</a></p>
    </section>`;
  document.body.append(root);

  const launcher = root.querySelector('.mp-chat__launcher');
  const panel = root.querySelector('.mp-chat__panel');
  const close = root.querySelector('.mp-chat__header button');
  const messages = root.querySelector('.mp-chat__messages');
  const form = root.querySelector('form');
  const input = root.querySelector('input');
  const send = form.querySelector('button');
  const history = [];

  function toggle(force) {
    const open = typeof force === 'boolean' ? force : panel.hidden;
    panel.hidden = !open;
    launcher.setAttribute('aria-expanded', String(open));
    if (open) input.focus();
  }

  function addMessage(text, who, pending = false) {
    const node = document.createElement('div');
    node.className = `mp-chat__message mp-chat__message--${who}${pending ? ' mp-chat__message--pending' : ''}`;
    node.textContent = text;
    messages.append(node);
    messages.scrollTop = messages.scrollHeight;
    return node;
  }

  async function ask(question) {
    const text = String(question || '').trim();
    if (!text || send.disabled) return;
    addMessage(text, 'user');
    input.value = '';
    send.disabled = true;
    input.disabled = true;
    const waiting = addMessage('Thinking…', 'bot', true);
    try {
      const response = await fetch('/api/monthly-pocket-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' },
        body: JSON.stringify({ message: text, history }),
      });
      const body = await response.json().catch(() => ({}));
      if (response.status === 429) throw new Error(body.error || 'You have asked a lot of questions in a short time. Please wait a few minutes and try again.');
      if (!response.ok) throw new Error(body.error || 'Chat is unavailable right now.');
      waiting.remove();
      addMessage(body.reply, 'bot');
      history.push({ role: 'user', text }, { role: 'model', text: body.reply });
      if (history.length > 6) history.splice(0, history.length - 6);
    } catch (error) {
      waiting.remove();
      addMessage(error.message || 'Chat is unavailable right now. Try the How to Use guide.', 'bot');
    } finally {
      send.disabled = false;
      input.disabled = false;
      input.focus();
    }
  }

  launcher.addEventListener('click', () => toggle());
  close.addEventListener('click', () => toggle(false));
  form.addEventListener('submit', event => { event.preventDefault(); ask(input.value); });
  root.querySelectorAll('.mp-chat__suggestions button').forEach(button => button.addEventListener('click', () => ask(button.textContent)));
  document.addEventListener('keydown', event => { if (event.key === 'Escape' && !panel.hidden) toggle(false); });
})();
