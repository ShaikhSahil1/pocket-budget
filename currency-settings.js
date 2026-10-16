(() => {
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null;
  const name = code => names?.of(code) || code;
  const select = $('currency');
  select.replaceChildren();
  const codes = ['INR', ...pocketCurrencyCodes.filter(code => code !== 'INR').sort((a, b) => name(a).localeCompare(name(b)))];
  for (const code of codes) {
    const option = document.createElement('option'); option.value = code;
    option.textContent = code + ' · ' + name(code); select.append(option);
  }
  const dialog = document.createElement('dialog');
  dialog.id = 'currency-dialog'; dialog.setAttribute('aria-labelledby', 'currency-dialog-title');
  dialog.innerHTML = `<div class="modal-heading"><h2 id="currency-dialog-title">Save currency preference?</h2><button type="button" id="currency-close" aria-label="Close currency preference">×</button></div><p id="currency-question"></p><p>Amounts are not converted. Saving updates your account preference and syncs it to Google. INR is the default for new accounts.</p><p id="currency-error" role="alert"></p><div class="modal-actions currency-choices"><button type="button" id="currency-cancel">Cancel</button><button type="button" id="currency-temporary">Use temporarily</button><button type="button" id="currency-save" class="primary">Save permanently</button></div>`;
  document.body.append(dialog);
  let pending, accountKey, base;
  const originalRender = render;
  render = function () { originalRender(); select.value = currentPocketCurrency(); };
  select.onchange = () => {
    pending = select.value; accountKey = pocketStorageKey; base = data.currency;
    select.value = currentPocketCurrency();
    if (!accountKey || !isPocketCurrency(pending) || pending === currentPocketCurrency()) return;
    $('currency-question').textContent = 'Use ' + name(pending) + ' (' + pending + ') for your budget?';
    $('currency-error').textContent = ''; dialog.showModal();
  };
  const valid = () => accountKey && pocketStorageKey === accountKey && data.currency === base && !document.body.classList.contains('account-locked');
  $('currency-close').onclick = $('currency-cancel').onclick = () => dialog.close();
  $('currency-temporary').onclick = () => {
    if (!valid()) { dialog.close(); return; }
    pocketTemporaryCurrency = { code: pending, account: accountKey, base };
    render(); dialog.close(); toast('Currency changed temporarily; amounts are not converted');
  };
  $('currency-save').onclick = () => {
    if (!valid()) { dialog.close(); return; }
    const previousTemporary = pocketTemporaryCurrency;
    pocketTemporaryCurrency = null; data.currency = pending;
    if (persist()) { dialog.close(); toast('Currency preference saved; amounts are not converted'); }
    else if (pocketStorageKey === accountKey) {
      data.currency = base; pocketTemporaryCurrency = previousTemporary; render();
      $('currency-error').textContent = 'Could not save your preference. Please try again.';
    }
  };
  render();
})();
