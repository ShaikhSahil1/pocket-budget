function pocketValidUpiId(value) {
  return typeof value === 'string' && /^[A-Za-z0-9._-]{2,}@[A-Za-z][A-Za-z0-9.-]{1,}$/.test(value.trim());
}

function pocketParseUpiPayment(value) {
  if (typeof value !== 'string' || value.length > 2000) return null;
  const trimmed = value.trim();
  if (!/^(upi:\/\/pay|gpay:\/\/upi\/pay)\?/i.test(trimmed)) return null;
  try {
    const params = new URL(trimmed).searchParams;
    const upiId = (params.get('pa') || '').trim();
    if (!pocketValidUpiId(upiId)) return null;
    const amount = Number(params.get('am'));
    return { upiId, payeeName: (params.get('pn') || '').trim().slice(0, 100), amount: Number.isFinite(amount) && amount > 0 ? amount : null, note: (params.get('tn') || '').trim().slice(0, 200), currency: (params.get('cu') || 'INR').toUpperCase() };
  } catch { return null; }
}

// Popular UPI apps. iOS cannot list installed apps, so each gets its own button
// using the app's URL scheme. Android opens a specific app through an intent link.
// Scheme formats are defined by each app and must be re-checked on real devices.
function pocketUpiApps() {
  return [
    { id: 'gpay', label: 'Google Pay', ios: 'gpay://upi/pay?', android: 'com.google.android.apps.nbu.paisa.user' },
    { id: 'phonepe', label: 'PhonePe', ios: 'phonepe://pay?', android: 'com.phonepe.app' },
    { id: 'paytm', label: 'Paytm', ios: 'paytmmp://pay?', android: 'net.one97.paytm' },
    { id: 'cred', label: 'CRED', ios: 'credpay://upi/pay?', android: 'com.dreamplug.androidapp' },
    { id: 'bhim', label: 'BHIM', ios: 'bhim://upi/pay?', android: 'in.org.npci.upiapp' },
  ];
}

function pocketUpiPlatform(userAgent, platform, maxTouchPoints) {
  const agent = String(userAgent || '');
  if (/iPad|iPhone|iPod/.test(agent) || (platform === 'MacIntel' && maxTouchPoints > 1)) return 'ios';
  if (/Android/i.test(agent)) return 'android';
  return 'other';
}

function pocketBuildUpiPaymentUrl(draft, app = 'generic', platform = 'ios', fallbackUrl = '') {
  if (!draft || !pocketValidUpiId(draft.upiId) || typeof draft.payeeName !== 'string' || !draft.payeeName.trim() || !Number.isFinite(draft.amount) || draft.amount <= 0) throw Error('Enter a valid UPI ID, recipient name and amount.');
  const params = new URLSearchParams({ pa: draft.upiId.trim(), pn: draft.payeeName.trim(), am: Number(draft.amount).toFixed(2), cu: 'INR' });
  if (draft.reference) params.set('tr', String(draft.reference).slice(0, 35));
  if (draft.note) params.set('tn', String(draft.note).trim().slice(0, 80));
  const query = params.toString();
  // The standard link. On Android it shows the chooser of every installed UPI app.
  if (app === 'generic') return 'upi://pay?' + query;
  const target = pocketUpiApps().find(item => item.id === app);
  if (!target) throw Error('Choose a supported UPI app.');
  if (platform === 'android') {
    const fallback = /^https:\/\//.test(fallbackUrl) ? 'S.browser_fallback_url=' + encodeURIComponent(fallbackUrl) + ';' : '';
    return 'intent://pay?' + query + '#Intent;scheme=upi;package=' + target.android + ';' + fallback + 'end';
  }
  return target.ios + query;
}

function pocketUpiExpense(draft, values, categories = pocketCategories) {
  const amount = Number(values.amount);
  if (!Number.isFinite(amount) || amount <= 0 || typeof values.name !== 'string' || !values.name.trim() || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(values.date) || !categories.includes(values.category)) throw Error('Enter valid expense details and the amount you actually paid.');
  const detailParts = ['User-confirmed UPI payment · not bank-verified'];
  if (draft.upiId) detailParts.push('Paid to ' + draft.upiId);
  if (draft.appLabel) detailParts.push('via ' + draft.appLabel);
  if (values.details && values.details.trim()) detailParts.push(values.details.trim());
  return { id: values.id, name: values.name.trim(), amount, date: values.date, category: values.category, details: detailParts.join(' · ').slice(0, 200), refundable: false, received: false };
}

(() => {
  const trigger = document.createElement('button');
  trigger.id = 'upi-pay-add'; trigger.type = 'button'; trigger.innerHTML = '<span>⌁</span> Pay & Add Expense';
  const heading = document.querySelector('section > .heading');
  const headingActions = document.createElement('div'); headingActions.className = 'heading-actions';
  heading.querySelector(':scope > #add').before(headingActions); headingActions.append(trigger, $('add'));

  const platform = pocketUpiPlatform(navigator.userAgent, navigator.platform, navigator.maxTouchPoints);
  const apps = pocketUpiApps();
  const appLabel = id => apps.find(item => item.id === id)?.label || 'your UPI app';

  const dialog = document.createElement('dialog');
  dialog.id = 'upi-payment-dialog'; dialog.className = 'upi-dialog';
  dialog.innerHTML = `<form id="upi-payment-form"><div class="modal-heading"><div><span class="eyebrow">UPI PAYMENT HELPER</span><h2>Pay & Add Expense</h2></div><button type="button" id="upi-close" aria-label="Close">×</button></div><div class="upi-trust-note"><b>Monthly Pocket remembers—not verifies.</b><span>Your UPI app handles the transfer. Monthly Pocket cannot read payment status, so you confirm the expense after returning.</span></div><div class="upi-qr-row"><div><b>Have a UPI QR?</b><small>Take a photo or choose the QR from your gallery. It is decoded only on this device.</small></div><label class="upi-file-button">Scan UPI QR<input id="upi-qr-file" type="file" accept="image/*"></label></div><p id="upi-qr-status" class="upi-status" role="status"></p><label>UPI ID<input id="upi-id" required maxlength="100" inputmode="email" autocomplete="off" placeholder="recipient@bank"></label><div class="form-grid"><label>Recipient name<input id="upi-payee" required maxlength="100" autocomplete="off" placeholder="e.g. Corner Cafe"></label><label>Amount (INR)<input id="upi-amount" required type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="₹ 0.00"></label></div><label>Expense name<input id="upi-expense-name" required maxlength="100" placeholder="e.g. Coffee and breakfast"></label><div class="form-grid"><label>Category<select id="upi-category"></select></label><label>Date<input id="upi-date" type="date" required></label></div><label>Note / details<input id="upi-note" maxlength="160" placeholder="Shown in the payment app and saved with the expense"></label><div id="upi-error" class="upi-error" role="alert"></div><div id="upi-waiting" class="upi-waiting" hidden><b id="upi-waiting-title"></b><span>Finish the payment in your UPI app, then come back here. If the app did not open, it may not be installed—choose another app below.</span><button type="button" id="upi-returned">I’m back · Review payment</button></div><div class="upi-pay-with"><b>Pay with</b><small id="upi-pay-hint"></small><button type="button" class="primary upi-chooser" id="upi-chooser" data-app="generic" hidden>Choose from my UPI apps</button><div class="upi-app-grid" id="upi-app-grid" role="group" aria-label="UPI apps"></div></div></form>`;
  document.body.append(dialog);

  const review = document.createElement('dialog');
  review.id = 'upi-review-dialog'; review.className = 'upi-dialog upi-review-dialog';
  review.innerHTML = `<form id="upi-review-form"><div class="modal-heading"><div><span class="eyebrow">USER CONFIRMATION</span><h2>Did you complete the payment?</h2></div></div><div class="upi-review-amount"><span>REMEMBERED AMOUNT</span><strong id="upi-review-remembered"></strong><small id="upi-review-recipient"></small></div><p>Add this expense only if you completed the payment. You can correct the amount or details before saving.</p><label>Expense name<input id="upi-review-name" required maxlength="100"></label><div class="form-grid"><label>Amount actually paid<input id="upi-review-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label>Date<input id="upi-review-date" type="date" required></label></div><label>Category<select id="upi-review-category"></select></label><label>Details<input id="upi-review-details" maxlength="160"></label><div id="upi-review-error" class="upi-error" role="alert"></div><div class="upi-verification-label"><b>User-confirmed</b><span>This record is not confirmation from a bank, UPI app or NPCI.</span></div><div class="modal-actions"><button type="button" id="upi-not-paid">I didn’t pay · Don’t add</button><button type="submit" class="primary">Yes, add expense</button></div></form>`;
  document.body.append(review);

  $('upi-category').innerHTML = $('upi-review-category').innerHTML = cats.map(category => `<option>${esc(category)}</option>`).join('');
  let activePendingKey = '', reviewScheduled = false, launchedReference = '', waitTimer;
  const pendingKey = () => pocketStorageKey ? pocketStorageKey + ':pending-upi-payment' : '';
  const lastAppKey = () => pocketStorageKey ? pocketStorageKey + ':upi-last-app' : '';
  const readPending = () => {
    const key = pendingKey(); if (!key) return null;
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && value.v === 1 && value.launchedAt && Date.now() - value.launchedAt < 7 * 86400000 ? value : null; } catch { return null; }
  };
  const writePending = value => { const key = pendingKey(); if (key) localStorage.setItem(key, JSON.stringify(value)); };
  const clearPending = key => { if (key) localStorage.removeItem(key); };
  const lastApp = () => { try { return localStorage.getItem(lastAppKey()) || ''; } catch { return ''; } };

  function drawApps() {
    const remembered = lastApp();
    const ordered = apps.slice().sort((a, b) => (b.id === remembered) - (a.id === remembered));
    const other = platform === 'android' ? '' : `<button type="button" class="upi-app" data-app="generic"><span class="upi-app-mark" aria-hidden="true">⋯</span>Other UPI app<small>iOS decides</small></button>`;
    $('upi-app-grid').innerHTML = ordered.map(item => `<button type="button" class="upi-app${item.id === remembered ? ' last-used' : ''}" data-app="${item.id}"><span class="upi-app-mark upi-app-${item.id}" aria-hidden="true">${esc(item.label.slice(0, 1))}</span>${esc(item.label)}${item.id === remembered ? '<small>Last used</small>' : ''}</button>`).join('') + other;
    $('upi-chooser').hidden = platform !== 'android';
    $('upi-pay-hint').textContent = platform === 'android' ? 'Android shows every UPI app installed on your phone. Or open a specific app below.' : platform === 'ios' ? 'iPhone cannot list installed apps. Tap the UPI app you use.' : 'Open Monthly Pocket on your phone to pay with a UPI app.';
    dialog.querySelectorAll('[data-app]').forEach(button => button.disabled = platform === 'other');
  }

  function showWaiting(app) {
    $('upi-waiting-title').textContent = 'Waiting for ' + (app === 'generic' ? 'your UPI app' : appLabel(app)) + '…';
    $('upi-waiting').hidden = false;
    if (!dialog.open) dialog.showModal();
  }

  function openPayment() {
    if (!pocketStorageKey) { toast('Sign in to use Pay & Add Expense.'); return; }
    $('upi-payment-form').reset(); $('upi-date').value = localDate(new Date());
    $('upi-category').value = cats.includes(tab) ? tab : 'Personal Buying';
    $('upi-error').textContent = ''; $('upi-qr-status').textContent = ''; $('upi-waiting').hidden = true;
    drawApps();
    if (currentPocketCurrency() !== 'INR') $('upi-error').textContent = 'UPI uses INR. Switch your workspace currency to INR before starting a payment.';
    else if (platform === 'other') $('upi-error').textContent = 'UPI apps open only on a phone. Open Monthly Pocket on your iPhone or Android phone.';
    dialog.showModal();
  }

  function paymentDraft(app) {
    if (currentPocketCurrency() !== 'INR') throw Error('Switch your workspace currency to INR before using UPI.');
    if (platform === 'other') throw Error('Open Monthly Pocket on your phone to pay with a UPI app.');
    const draft = { v: 1, platform, app, appLabel: app === 'generic' ? '' : appLabel(app), upiId: $('upi-id').value.trim(), payeeName: $('upi-payee').value.trim(), amount: Number($('upi-amount').value), expenseName: $('upi-expense-name').value.trim(), category: $('upi-category').value, date: $('upi-date').value, note: $('upi-note').value.trim(), reference: 'MP' + crypto.randomUUID().replaceAll('-', '').slice(0, 28), launchedAt: Date.now(), left: false };
    pocketBuildUpiPaymentUrl(draft);
    if (!draft.expenseName || !draft.date || !cats.includes(draft.category)) throw Error('Complete the expense name, category and date.');
    return draft;
  }

  function launch(app) {
    try {
      const draft = paymentDraft(app);
      const url = pocketBuildUpiPaymentUrl(draft, app, platform, location.href.split('#')[0] + '#upi-app-missing');
      writePending(draft); activePendingKey = pendingKey(); launchedReference = draft.reference;
      if (app !== 'generic') { try { localStorage.setItem(lastAppKey(), app); } catch {} }
      $('upi-error').textContent = ''; $('upi-waiting').hidden = true;
      location.href = url;
      // If the page never goes to the background, the app probably did not open.
      clearTimeout(waitTimer);
      waitTimer = setTimeout(() => { const pending = readPending(); if (pending && pending.reference === draft.reference && !pending.left && document.visibilityState === 'visible') showWaiting(app); }, 2500);
    } catch (error) { $('upi-error').textContent = error.message; }
  }

  async function decodeQr(file) {
    $('upi-qr-status').textContent = 'Reading QR on this device…';
    try {
      if (!file || file.size > 15000000 || !file.type.startsWith('image/')) throw Error('Choose a QR image up to 15 MB.');
      if (typeof jsQR !== 'function') throw Error('QR reader is unavailable. Enter the UPI ID manually.');
      const bitmap = await createImageBitmap(file), scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
      const canvas = document.createElement('canvas'); canvas.width = Math.max(1, Math.round(bitmap.width * scale)); canvas.height = Math.max(1, Math.round(bitmap.height * scale));
      const context = canvas.getContext('2d', { willReadFrequently: true }); context.drawImage(bitmap, 0, 0, canvas.width, canvas.height); bitmap.close?.();
      const pixels = context.getImageData(0, 0, canvas.width, canvas.height), code = jsQR(pixels.data, pixels.width, pixels.height, { inversionAttempts: 'attemptBoth' }), parsed = code && pocketParseUpiPayment(code.data);
      if (!parsed || parsed.currency !== 'INR') throw Error('This image does not contain a supported INR UPI payment QR.');
      $('upi-id').value = parsed.upiId; if (parsed.payeeName) $('upi-payee').value = parsed.payeeName; if (parsed.amount) $('upi-amount').value = parsed.amount;
      if (parsed.note) { $('upi-note').value = parsed.note; if (!$('upi-expense-name').value) $('upi-expense-name').value = parsed.note.slice(0, 100); }
      $('upi-qr-status').textContent = '✓ UPI QR read successfully. Check the recipient and amount, then choose your UPI app.';
    } catch (error) { $('upi-qr-status').textContent = error.message; }
    finally { $('upi-qr-file').value = ''; }
  }

  function showPendingReview(force = false) {
    if (review.open || document.body.classList.contains('account-locked')) return;
    const pending = readPending(); if (!pending) return;
    // A draft launched from this page waits until the user has actually left for the app.
    if (!force && pending.reference === launchedReference && !pending.left) return;
    clearTimeout(waitTimer); activePendingKey = pendingKey();
    if (dialog.open) dialog.close();
    $('upi-review-remembered').textContent = money(pending.amount); $('upi-review-recipient').textContent = 'For ' + pending.payeeName + ' · ' + pending.upiId + (pending.appLabel ? ' · via ' + pending.appLabel : '');
    $('upi-review-name').value = pending.expenseName; $('upi-review-amount').value = pending.amount; $('upi-review-date').value = pending.date || localDate(new Date());
    $('upi-review-category').value = cats.includes(pending.category) ? pending.category : 'Personal Buying'; $('upi-review-details').value = pending.note || ''; $('upi-review-error').textContent = ''; review.showModal();
  }

  function schedulePendingReview() {
    if (reviewScheduled) return; reviewScheduled = true;
    setTimeout(() => { reviewScheduled = false; if (document.visibilityState === 'visible') showPendingReview(); }, 900);
  }

  // Android Chrome returns here through the intent fallback when the chosen app is missing.
  function appMissing() {
    if (location.hash !== '#upi-app-missing') return;
    const pending = readPending(); if (!pending) return;
    history.replaceState(null, '', location.pathname + location.search);
    clearTimeout(waitTimer); clearPending(pendingKey()); launchedReference = '';
    if (!dialog.open) { drawApps(); dialog.showModal(); }
    $('upi-waiting').hidden = true;
    $('upi-error').textContent = (pending.appLabel || 'That app') + ' is not installed on this phone. Choose another UPI app.';
  }

  trigger.onclick = openPayment; $('upi-close').onclick = () => { clearTimeout(waitTimer); dialog.close(); };
  dialog.addEventListener('click', event => { const button = event.target.closest('[data-app]'); if (button && !button.disabled) launch(button.dataset.app); });
  $('upi-returned').onclick = () => showPendingReview(true);
  $('upi-qr-file').onchange = event => decodeQr(event.target.files?.[0]);
  $('upi-not-paid').onclick = () => { clearPending(activePendingKey || pendingKey()); activePendingKey = ''; launchedReference = ''; review.close(); toast('Payment was not added.'); };
  $('upi-review-form').onsubmit = event => {
    event.preventDefault(); const pending = readPending(); if (!pending) { $('upi-review-error').textContent = 'This payment draft is no longer available.'; return; }
    try {
      const entry = pocketUpiExpense(pending, { id: crypto.randomUUID(), name: $('upi-review-name').value, amount: $('upi-review-amount').value, date: $('upi-review-date').value, category: $('upi-review-category').value, details: $('upi-review-details').value });
      const previous = data.expenses; data.expenses = previous.concat(entry); $('month').value = entry.date.slice(0, 7);
      if (!persist()) { data.expenses = previous; throw Error('The expense could not be saved. Try again.'); }
      clearPending(activePendingKey || pendingKey()); activePendingKey = ''; launchedReference = ''; review.close(); toast('User-confirmed UPI expense saved');
    } catch (error) { $('upi-review-error').textContent = error.message; }
  };
  window.addEventListener('pageshow', schedulePendingReview);
  window.addEventListener('hashchange', appMissing);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      const pending = readPending();
      if (pending && pending.reference === launchedReference && !pending.left) { pending.left = true; writePending(pending); clearTimeout(waitTimer); }
      return;
    }
    schedulePendingReview();
  });
  document.addEventListener('monthly-pocket:account-locked', () => { clearTimeout(waitTimer); if (dialog.open) dialog.close(); if (review.open) review.close(); activePendingKey = ''; launchedReference = ''; });
  const previousRender = render; render = function () { previousRender(); appMissing(); schedulePendingReview(); };
  appMissing();
  schedulePendingReview();
})();
