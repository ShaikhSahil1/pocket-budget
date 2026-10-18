(() => {
  const panel = document.createElement('article');
  panel.className = 'panel cloud-panel';
  panel.innerHTML = `<div class="panel-heading"><div><h3>Your private Google workspace</h3><span id="account-email">Not signed in</span><br><span id="cloud-status" role="status">Checking your Google session…</span></div><button id="cloud-connect">Sign in with Google</button></div><div class="cloud-progress" id="cloud-progress" role="progressbar" aria-label="Google Sheet activity" aria-valuetext="Idle" hidden><span></span></div><div class="lifetime-access" id="lifetime-access" hidden><span>ONE-TIME PURCHASE</span><h3>Unlock Monthly Pocket for life.</h3><p>Pay ₹499 once. No subscription, no renewal, and no recurring charge.</p><div><button class="primary" id="buy-lifetime">Pay securely with Razorpay</button><button id="paywall-logout">Use another Google account</button></div><details><summary>Already paid? Restore access</summary><label>Razorpay payment ID<input id="restore-payment-id" autocomplete="off" placeholder="pay_…"></label><button id="restore-lifetime">Verify payment ID</button></details><small>Access is linked to this Google account after Razorpay verifies the payment.</small></div><div class="cloud-actions" id="account-actions" hidden><a id="account-sheet" target="_blank" rel="noopener">Open my Google Sheet</a><button id="cloud-load">Load from Google</button><button id="cloud-save">Save to Google</button><button id="json-export">Download full backup</button><label class="import-label">Restore backup<input type="file" id="json-import" accept=".json,application/json"></label><button id="legacy-import" hidden>Import previous device data</button><button id="cloud-disconnect">Log out</button></div><p>Sign in to see your own budget and leaves. Each account has separate storage and its own Monthly Pocket spreadsheet. Local copies remain on this browser; log out when finished on a shared device.</p>`;
  document.querySelector('section > .stats').before(panel);
  let account = null, token = '', expires = 0, sheet = '', baseline, busy = false, paying = false, timer, revision = 0, generation = 0;
  let sheetReady = false, workspaceReady = false, verifiedOperation = 0, operation = 0;
  const sessionKey = 'pocket-active-google-account';
  const key = name => {
    if (!account) throw Error('Sign in with Google first.');
    return pocketAccountKey(account.id, name);
  };
  const dirty = () => !!account && localStorage.getItem(key('dirty')) === '1';
  const status = message => $('cloud-status').textContent = message;
  const sheetLoading = active => {
    const progress = $('cloud-progress');
    progress.hidden = !active;
    progress.setAttribute?.('aria-valuetext', active ? 'Reading your Google Sheet' : 'Idle');
  };
  const signal = name => {
    if (typeof CustomEvent === 'function') document.dispatchEvent(new CustomEvent(name));
  };
  const rawData = () => JSON.stringify(data);
  const hash = raw => { let value = 2166136261; for (const char of String(raw)) value = Math.imul(value ^ char.charCodeAt(0), 16777619); return (value >>> 0).toString(16) + ':' + String(raw).length; };
  function controls() {
    $('cloud-connect').hidden = !!account;
    $('cloud-connect').disabled = busy;
    $('account-actions').hidden = !account || !workspaceReady;
    $('lifetime-access').hidden = !account || workspaceReady;
    $('buy-lifetime').disabled = busy || paying;
    $('paywall-logout').disabled = busy || paying;
    $('restore-lifetime').disabled = busy || paying;
    ['cloud-load', 'cloud-save'].forEach(id => $(id).disabled = busy || !sheetReady);
    ['cloud-disconnect', 'json-export', 'json-import', 'legacy-import'].forEach(id => $(id).disabled = busy);
    $('account-sheet').hidden = !sheetReady;
  }
  function lock(message) {
    generation++; clearTimeout(timer); account = null; token = ''; sheet = ''; sheetReady = false; workspaceReady = false;
    sheetLoading(false);
    pocketStorageKey = null; baseline = undefined; data = emptyPocketData();
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    $('currency').value = data.currency; $('search').value = ''; render();
    document.body.classList.add('account-locked');
    $('account-email').textContent = 'Not signed in';
    document.querySelector('.profile span').textContent = 'Sign in to your workspace';
    document.querySelector('.saved').textContent = '● Sign in to save';
    controls(); status(message);
    signal('monthly-pocket:account-locked');
  }
  async function auth(action, values = {}) {
    const response = await fetch('/api/google-auth', { method: 'POST', credentials: 'same-origin', headers: { 'Content-Type': 'application/json', 'X-Requested-With': 'XmlHttpRequest' }, body: JSON.stringify({ action, ...values }) });
    const body = await response.json();
    if (!response.ok) { const error = Error(body.error || 'Google session unavailable.'); error.status = response.status; throw error; }
    return body;
  }
  function loadRazorpay() {
    if (window.Razorpay) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement('script'); script.src = 'https://checkout.razorpay.com/v1/checkout.js'; script.async = true;
      script.onload = resolve; script.onerror = () => reject(Error('Razorpay Checkout could not load. Check your connection and try again.'));
      document.head.append(script);
    });
  }
  async function buyLifetime() {
    if (!account || paying) return; paying = true; controls(); status('Preparing secure Razorpay checkout…');
    try {
      const order = await auth('create_lifetime_order');
      if (order.entitled) { location.reload(); return; }
      await loadRazorpay();
      let verificationStarted = false;
      const checkout = new Razorpay({
        key: order.keyId, order_id: order.orderId, amount: order.amount, currency: order.currency,
        name: 'Monthly Pocket', description: 'Lifetime access · one-time payment', prefill: { email: order.email },
        readonly: { email: true }, theme: { color: '#234f42' }, retry: { enabled: true },
        handler: async result => {
          verificationStarted = true;
          status('Verifying your payment securely…');
          try {
            await auth('verify_lifetime_payment', { payment: { orderId: result.razorpay_order_id, paymentId: result.razorpay_payment_id, signature: result.razorpay_signature } });
            toast('Payment verified · Lifetime access unlocked'); location.reload();
          } catch (error) { paying = false; controls(); status('Payment could not be verified · ' + error.message); toast(error.message); signal('monthly-pocket:payment-required'); }
        },
        modal: { ondismiss: () => {
          if (verificationStarted) return;
          paying = false; controls(); status('Payment cancelled · No charge was recorded.');
          signal('monthly-pocket:payment-required');
        } },
      });
      checkout.on('payment.failed', response => { paying = false; controls(); const message = response.error?.description || 'Payment failed. Try again.'; status(message); toast(message); });
      const profilePanel = document.getElementById('profile-panel');
      if (profilePanel?.open) profilePanel.close();
      checkout.open();
    } catch (error) { paying = false; controls(); status('Checkout unavailable · ' + error.message); toast(error.message); signal('monthly-pocket:payment-required'); }
  }
  async function restoreLifetime() {
    const paymentId = $('restore-payment-id').value.trim();
    if (!paymentId || paying) return; paying = true; controls(); status('Checking your Razorpay payment ID…');
    try { await auth('restore_lifetime_payment', { paymentId }); toast('Payment verified · Lifetime access restored'); location.reload(); }
    catch (error) { paying = false; controls(); status('Access could not be restored · ' + error.message); toast(error.message); }
  }
  async function refresh() {
    const currentGeneration = generation, result = await auth('refresh');
    if (currentGeneration !== generation) throw Error('Account changed. Reload the page.');
    if (!account || result.account?.id !== account.id) { lock('Your Google account changed. Reload to sign in again.'); throw Error('Account changed. No data was synced.'); }
    if (result.entitled === false) { location.reload(); throw Error('Lifetime access is required.'); }
    token = result.access_token; expires = Date.now() + result.expires_in * 1000 - 30000;
  }
  async function google(url, options = {}) {
    const currentGeneration = generation;
    // Check the cookie's identity once per sync operation (and when the token is
    // about to expire). Stale tabs still refuse to sync after an account change,
    // without repeating the server check for every Sheets request in one save.
    if (verifiedOperation !== operation || Date.now() >= expires) { await refresh(); verifiedOperation = operation; }
    const response = await fetch(url, { ...options, headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token } });
    const body = await response.json();
    if (currentGeneration !== generation) throw Error('Account changed. Reload the page.');
    if (!response.ok) throw Error(body.error?.message || 'Google request failed (' + response.status + ').');
    return body;
  }
  const sheets = (path = '', options) => google('https://sheets.googleapis.com/v4/spreadsheets/' + encodeURIComponent(sheet) + path, options);
  async function privateSheet() {
    const query = "trashed = false and 'me' in owners and mimeType = 'application/vnd.google-apps.spreadsheet' and appProperties has { key='pocketAccount' and value='" + account.id + "' }";
    const result = await google('https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: query, fields: 'files(id,name)', orderBy: 'createdTime', pageSize: '100' }));
    if (result.files?.length) return result.files[0].id;
    const created = await google('https://www.googleapis.com/drive/v3/files?fields=id', { method: 'POST', body: JSON.stringify({ name: 'Pocket Budget — My private data', mimeType: 'application/vnd.google-apps.spreadsheet', appProperties: { pocketAccount: account.id } }) });
    return created.id;
  }
  async function readCloud() {
    sheetLoading(true);
    try {
      if (!sheetReady) throw Error('Your private spreadsheet is not ready. Reload to retry.');
      const meta = await sheets('?fields=sheets.properties.title');
      if (!meta.sheets?.some(s => s.properties.title === 'PocketData')) return null;
      const body = await sheets('/values/' + encodeURIComponent("'PocketData'!A:A") + '?valueRenderOption=UNFORMATTED_VALUE');
      if (!body.values?.length) return null;
      if (body.values[0][0] !== 'pocket-account-backup-v1' || body.values[1]?.[0] !== account.id) throw Error('This spreadsheet does not belong to this Monthly Pocket account.');
      const raw = body.values.slice(2).map(row => row[0] || '').join('');
      validatePocketBackup(JSON.parse(raw)); return raw;
    } finally { sheetLoading(false); }
  }
  function remember(raw, clearDirty = true) {
    baseline = raw;
    localStorage.setItem(key('sync'), JSON.stringify({ sheet, hash: hash(raw) }));
    if (clearDirty) localStorage.removeItem(key('dirty'));
  }
  async function loadCloud(ask = true) {
    status('Reading your Google Sheet…');
    const raw = await readCloud();
    if (raw === null) { remember(null, !dirty()); status('Private sheet ready · Changes save automatically.'); return; }
    if (ask && !confirm('Replace this account’s local budget and leaves with its Google backup?')) return;
    const next = validatePocketBackup(JSON.parse(raw));
    localStorage.setItem(pocketStorageKey, JSON.stringify(next)); data = next;
    $('currency').value = data.currency; render(); remember(raw); status('Loaded your Google data.');
  }
  async function saveCloud(automatic = false) {
    const current = await readCloud();
    if (baseline !== undefined && current !== baseline) throw Error('Your cloud copy changed. Download a backup, then load your Google data before saving.');
    if (baseline === undefined && current !== null) {
      if (automatic) throw Error('Choose Load from Google or Save to Google to resolve pending changes.');
      if (!confirm('Replace this account’s entire Google backup with its local budget and leaves?')) return;
    }
    const saveRevision = revision, raw = rawData(); validatePocketBackup(JSON.parse(raw));
    const meta = await sheets('?fields=sheets.properties.title');
    if (!meta.sheets?.some(s => s.properties.title === 'PocketData')) await sheets(':batchUpdate', { method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: 'PocketData' } } }] }) });
    const values = [['pocket-account-backup-v1'], [account.id], ...(raw.match(/[\s\S]{1,30000}/g) || ['']).map(chunk => [chunk])];
    const oldRows = current === null ? 2 : 2 + Math.ceil(current.length / 30000);
    while (values.length < oldRows) values.push(['']);
    await sheets('/values/' + encodeURIComponent("'PocketData'!A1") + '?valueInputOption=RAW', { method: 'PUT', body: JSON.stringify({ values }) });
    remember(raw, revision === saveRevision);
    status('Saved to your Google Sheet · ' + new Date().toLocaleTimeString());
    if (revision !== saveRevision) queue(false);
  }
  async function run(action) {
    if (busy) return; busy = true; operation++; controls();
    try { await action(); } catch (error) {
      if (error.status === 401) lock('Session ended. Sign in again to access your data.');
      else { status('Not synced · ' + error.message); toast(error.message); }
    } finally { busy = false; controls(); }
  }
  function queue(change = true) {
    if (!account) return;
    if (change) { revision++; localStorage.setItem(key('dirty'), '1'); }
    clearTimeout(timer);
    status('Saved for ' + account.email + ' on this device · Google sync pending.');
    if (!sheetReady || !navigator.onLine) return;
    timer = setTimeout(() => { if (busy) { queue(false); return; } run(() => saveCloud(true)); }, 1200);
  }
  $('cloud-connect').onclick = () => location.assign('/api/google-auth?action=start');
  $('buy-lifetime').onclick = buyLifetime;
  $('restore-lifetime').onclick = restoreLifetime;
  $('paywall-logout').onclick = () => run(async () => { await auth('logout'); localStorage.removeItem(sessionKey); lock('Signed out. Choose the Google account you want to use.'); });
  $('cloud-load').onclick = () => run(() => loadCloud());
  $('cloud-save').onclick = () => run(() => saveCloud());
  $('cloud-disconnect').onclick = () => run(async () => {
    if (dirty() && !confirm('Some changes have not synced yet. They will stay in this account’s local storage. Log out anyway?')) return;
    await auth('logout'); localStorage.removeItem(sessionKey);
    lock('Logged out · Your data is hidden. Sign in to your account to continue.');
  });
  $('json-export').onclick = () => {
    if (!account) return;
    const url = URL.createObjectURL(new Blob([rawData()], { type: 'application/json' }));
    const anchor = document.createElement('a'); anchor.href = url; anchor.download = 'pocket-full-backup-' + localDate(new Date()) + '.json'; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  function restore(next) {
    validatePocketBackup(next);
    localStorage.setItem(pocketStorageKey, JSON.stringify(next)); data = next; $('currency').value = data.currency; render(); queue();
  }
  $('json-import').onchange = event => run(async () => {
    try {
      const file = event.target.files[0]; if (!file || !account) return;
      const currentGeneration = generation;
      if (file.size > 10000000) throw Error('Backup file is too large.');
      const next = validatePocketBackup(JSON.parse(await file.text()));
      if (currentGeneration !== generation || !account) return;
      if (confirm('Replace all budget and leave data for ' + account.email + ' with this backup?')) restore(next);
    } finally { event.target.value = ''; }
  });
  $('legacy-import').onclick = () => {
    if (!account || busy) return;
    if (!confirm('Import the old shared-browser data into ' + account.email + '? Only continue if this data belongs to you. This replaces this account’s current data.')) return;
    try { restore(JSON.parse(localStorage.getItem('pocket-v1'))); toast('Previous data imported into your account.'); } catch (error) { toast(error.message); }
  };
  const originalPersist = persist;
  persist = function () {
    if (!account || localStorage.getItem(sessionKey) !== account.id) { lock('Account changed. Reload to continue.'); return false; }
    const ok = originalPersist(); if (ok) queue(); return ok;
  };
  window.addEventListener('storage', event => {
    if (event.key === sessionKey && account && event.newValue !== account.id) lock('Account changed in another tab. Reload to continue.');
  });
  window.addEventListener('beforeunload', event => { if (dirty()) { event.preventDefault(); event.returnValue = ''; } });
  window.addEventListener('online', () => { if (dirty()) queue(false); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && dirty() && !busy) { clearTimeout(timer); run(() => saveCloud(true)); } });
  lock('Checking your Google session…');
  run(async () => {
    const result = await auth('refresh');
    if (!result.account?.id) throw Error('Sign in again to enable account storage.');
    account = result.account;
    $('account-email').textContent = account.email;
    document.querySelector('.profile span').textContent = account.email;
    localStorage.setItem(sessionKey, account.id);
    if (result.entitled === false) {
      document.querySelector('.saved').textContent = '● Lifetime access required';
      status('Secure payment required · ₹499 once for lifetime access.');
      controls();
      signal('monthly-pocket:payment-required');
      return;
    }
    token = result.access_token; expires = Date.now() + result.expires_in * 1000 - 30000; verifiedOperation = operation;
    pocketStorageKey = pocketAccountKey(account.id, 'data');
    const raw = localStorage.getItem(pocketStorageKey);
    data = raw ? validatePocketBackup(JSON.parse(raw)) : emptyPocketData();
    $('currency').value = data.currency; render(); workspaceReady = true;
    document.querySelector('.saved').textContent = '● Saved for your account';
    $('legacy-import').hidden = !localStorage.getItem('pocket-v1');
    status('Finding your private Monthly Pocket spreadsheet…');
    sheet = await privateSheet(); sheetReady = true;
    $('account-sheet').href = 'https://docs.google.com/spreadsheets/d/' + encodeURIComponent(sheet) + '/edit';
    if (dirty()) {
      const current = await readCloud();
      const known = JSON.parse(localStorage.getItem(key('sync')) || '{}');
      if (current === null || (known.sheet === sheet && known.hash === hash(current))) { baseline = current; await saveCloud(true); }
      else status('Local and cloud changes need attention. Download a backup, then choose Load or Save.');
    } else await loadCloud(false);
    if (new URLSearchParams(location.search).has('google')) history.replaceState(null, '', location.pathname);
  }).finally(() => { if (account && workspaceReady) document.body.classList.remove('account-locked'); signal('monthly-pocket:session-checked'); });
})();

