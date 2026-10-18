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

function pocketBuildUpiPaymentUrl(draft, app = 'generic') {
  if (!draft || !pocketValidUpiId(draft.upiId) || typeof draft.payeeName !== 'string' || !draft.payeeName.trim() || !Number.isFinite(draft.amount) || draft.amount <= 0) throw Error('Enter a valid UPI ID, recipient name and amount.');
  const params = new URLSearchParams({ pa: draft.upiId.trim(), pn: draft.payeeName.trim(), am: Number(draft.amount).toFixed(2), cu: 'INR' });
  if (draft.reference) params.set('tr', String(draft.reference).slice(0, 35));
  if (draft.note) params.set('tn', String(draft.note).trim().slice(0, 80));
  return (app === 'gpay' ? 'gpay://upi/pay?' : 'upi://pay?') + params.toString();
}

function pocketUpiExpense(draft, values) {
  const amount = Number(values.amount);
  const categories = ['Business Trip', 'Reimbursable', 'Personal Buying', 'Monthly Travelling'];
  if (!Number.isFinite(amount) || amount <= 0 || typeof values.name !== 'string' || !values.name.trim() || !/^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(values.date) || !categories.includes(values.category)) throw Error('Enter valid expense details and the amount you actually paid.');
  const detailParts = ['User-confirmed UPI payment · not bank-verified'];
  if (draft.upiId) detailParts.push('Paid to ' + draft.upiId);
  if (values.details && values.details.trim()) detailParts.push(values.details.trim());
  return { id: values.id, name: values.name.trim(), amount, date: values.date, category: values.category, details: detailParts.join(' · ').slice(0, 200), refundable: false, received: false };
}

(() => {
  const trigger = document.createElement('button');
  trigger.id = 'upi-pay-add'; trigger.type = 'button'; trigger.innerHTML = '<span>⌁</span> Pay & Add Expense';
  const heading = document.querySelector('section > .heading');
  const headingActions = document.createElement('div'); headingActions.className = 'heading-actions';
  heading.querySelector(':scope > #add').before(headingActions); headingActions.append(trigger, $('add'));

  const dialog = document.createElement('dialog');
  dialog.id = 'upi-payment-dialog'; dialog.className = 'upi-dialog';
  dialog.innerHTML = `<form id="upi-payment-form"><div class="modal-heading"><div><span class="eyebrow">iPHONE PAYMENT HELPER</span><h2>Pay & Add Expense</h2></div><button type="button" id="upi-close" aria-label="Close">×</button></div><div class="upi-trust-note"><b>Monthly Pocket remembers—not verifies.</b><span>Your payment app handles the transfer. Monthly Pocket cannot read Google Pay or PhonePe payment status, so you confirm the expense after returning.</span></div><div class="upi-qr-row"><div><b>Have a UPI QR?</b><small>Take a photo or choose the QR from Photos. It is decoded only on this device.</small></div><label class="upi-file-button">Scan UPI QR<input id="upi-qr-file" type="file" accept="image/*"></label></div><p id="upi-qr-status" class="upi-status" role="status"></p><label>UPI ID<input id="upi-id" required maxlength="100" inputmode="email" autocomplete="off" placeholder="recipient@bank"></label><div class="form-grid"><label>Recipient name<input id="upi-payee" required maxlength="100" autocomplete="off" placeholder="e.g. Corner Cafe"></label><label>Amount (INR)<input id="upi-amount" required type="number" min="0.01" step="0.01" inputmode="decimal" placeholder="₹ 0.00"></label></div><label>Expense name<input id="upi-expense-name" required maxlength="100" placeholder="e.g. Coffee and breakfast"></label><div class="form-grid"><label>Category<select id="upi-category"></select></label><label>Date<input id="upi-date" type="date" required></label></div><label>Note / details<input id="upi-note" maxlength="160" placeholder="Shown in the payment app and saved with the expense"></label><div id="upi-error" class="upi-error" role="alert"></div><div class="upi-platform-note"><b>iOS phase</b><span>Google Pay can be launched directly. “Other UPI app” uses the standard UPI link; which app opens depends on iOS and installed apps. You may need to switch back manually.</span></div><div class="modal-actions upi-actions"><button type="button" id="upi-other-app">Other UPI app</button><button type="button" class="primary" id="upi-gpay">Pay with Google Pay</button></div></form>`;
  document.body.append(dialog);

  const review = document.createElement('dialog');
  review.id = 'upi-review-dialog'; review.className = 'upi-dialog upi-review-dialog';
  review.innerHTML = `<form id="upi-review-form"><div class="modal-heading"><div><span class="eyebrow">USER CONFIRMATION</span><h2>Did you complete the payment?</h2></div></div><div class="upi-review-amount"><span>REMEMBERED AMOUNT</span><strong id="upi-review-remembered"></strong><small id="upi-review-recipient"></small></div><p>Confirm only if you completed the payment. You can correct the amount or details before saving.</p><label>Expense name<input id="upi-review-name" required maxlength="100"></label><div class="form-grid"><label>Amount actually paid<input id="upi-review-amount" type="number" min="0.01" step="0.01" inputmode="decimal" required></label><label>Date<input id="upi-review-date" type="date" required></label></div><label>Category<select id="upi-review-category"></select></label><label>Details<input id="upi-review-details" maxlength="160"></label><div id="upi-review-error" class="upi-error" role="alert"></div><div class="upi-verification-label"><b>User-confirmed</b><span>This record is not confirmation from a bank, Google Pay, PhonePe or NPCI.</span></div><div class="modal-actions"><button type="button" id="upi-not-paid">I didn’t pay</button><button type="submit" class="primary">Confirm & Add Expense</button></div></form>`;
  document.body.append(review);

  $('upi-category').innerHTML = $('upi-review-category').innerHTML = cats.map(category => `<option>${esc(category)}</option>`).join('');
  let activePendingKey = '', reviewScheduled = false;
  const isIos = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
  const pendingKey = () => pocketStorageKey ? pocketStorageKey + ':pending-upi-payment' : '';
  const readPending = () => {
    const key = pendingKey(); if (!key) return null;
    try { const value = JSON.parse(localStorage.getItem(key) || 'null'); return value && value.v === 1 && value.launchedAt && Date.now() - value.launchedAt < 7 * 86400000 ? value : null; } catch { return null; }
  };
  const clearPending = key => { if (key) localStorage.removeItem(key); };

  function openPayment() {
    if (!pocketStorageKey) { toast('Sign in to use Pay & Add Expense.'); return; }
    $('upi-payment-form').reset(); $('upi-date').value = localDate(new Date());
    $('upi-category').value = cats.includes(tab) ? tab : 'Personal Buying';
    $('upi-error').textContent = ''; $('upi-qr-status').textContent = '';
    if (currentPocketCurrency() !== 'INR') $('upi-error').textContent = 'UPI uses INR. Switch your workspace currency to INR before starting a payment.';
    else if (!isIos()) $('upi-error').textContent = 'This release is the iOS flow. Android support will be enabled in the next phase.';
    dialog.showModal();
  }

  function paymentDraft() {
    if (currentPocketCurrency() !== 'INR') throw Error('Switch your workspace currency to INR before using UPI.');
    if (!isIos()) throw Error('This release currently supports iPhone and iPad.');
    const draft = { v: 1, platform: 'ios', upiId: $('upi-id').value.trim(), payeeName: $('upi-payee').value.trim(), amount: Number($('upi-amount').value), expenseName: $('upi-expense-name').value.trim(), category: $('upi-category').value, date: $('upi-date').value, note: $('upi-note').value.trim(), reference: 'MP' + crypto.randomUUID().replaceAll('-', '').slice(0, 28), launchedAt: Date.now() };
    pocketBuildUpiPaymentUrl(draft);
    if (!draft.expenseName || !draft.date || !cats.includes(draft.category)) throw Error('Complete the expense name, category and date.');
    return draft;
  }

  function launch(app) {
    try {
      const draft = paymentDraft(), key = pendingKey();
      localStorage.setItem(key, JSON.stringify(draft)); activePendingKey = key; dialog.close();
      location.href = pocketBuildUpiPaymentUrl(draft, app);
      setTimeout(() => { if (document.visibilityState === 'visible') showPendingReview(); }, 1400);
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
      $('upi-qr-status').textContent = '✓ UPI QR read successfully. Check the recipient and amount before paying.';
    } catch (error) { $('upi-qr-status').textContent = error.message; }
    finally { $('upi-qr-file').value = ''; }
  }

  function showPendingReview() {
    if (review.open || document.body.classList.contains('account-locked')) return;
    const pending = readPending(); if (!pending) return; activePendingKey = pendingKey();
    $('upi-review-remembered').textContent = money(pending.amount); $('upi-review-recipient').textContent = 'For ' + pending.payeeName + ' · ' + pending.upiId;
    $('upi-review-name').value = pending.expenseName; $('upi-review-amount').value = pending.amount; $('upi-review-date').value = pending.date || localDate(new Date());
    $('upi-review-category').value = cats.includes(pending.category) ? pending.category : 'Personal Buying'; $('upi-review-details').value = pending.note || ''; $('upi-review-error').textContent = ''; review.showModal();
  }

  function schedulePendingReview() {
    if (reviewScheduled) return; reviewScheduled = true;
    setTimeout(() => { reviewScheduled = false; if (document.visibilityState === 'visible') showPendingReview(); }, 900);
  }

  trigger.onclick = openPayment; $('upi-close').onclick = () => dialog.close(); $('upi-gpay').onclick = () => launch('gpay'); $('upi-other-app').onclick = () => launch('generic');
  $('upi-qr-file').onchange = event => decodeQr(event.target.files?.[0]);
  $('upi-not-paid').onclick = () => { clearPending(activePendingKey || pendingKey()); activePendingKey = ''; review.close(); toast('Payment was not added.'); };
  $('upi-review-form').onsubmit = event => {
    event.preventDefault(); const pending = readPending(); if (!pending) { $('upi-review-error').textContent = 'This payment draft is no longer available.'; return; }
    try {
      const entry = pocketUpiExpense(pending, { id: crypto.randomUUID(), name: $('upi-review-name').value, amount: $('upi-review-amount').value, date: $('upi-review-date').value, category: $('upi-review-category').value, details: $('upi-review-details').value });
      const previous = data.expenses; data.expenses = previous.concat(entry); $('month').value = entry.date.slice(0, 7);
      if (!persist()) { data.expenses = previous; throw Error('The expense could not be saved. Try again.'); }
      clearPending(activePendingKey || pendingKey()); activePendingKey = ''; review.close(); toast('User-confirmed UPI expense saved');
    } catch (error) { $('upi-review-error').textContent = error.message; }
  };
  window.addEventListener('pageshow', schedulePendingReview);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') schedulePendingReview(); });
  document.addEventListener('monthly-pocket:account-locked', () => { if (dialog.open) dialog.close(); if (review.open) review.close(); activePendingKey = ''; });
  const previousRender = render; render = function () { previousRender(); schedulePendingReview(); };
  schedulePendingReview();
})();
