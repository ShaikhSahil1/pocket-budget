(() => {
  const nav = document.createElement('button'); nav.dataset.tab = 'Mini tools';
  nav.innerHTML = '<span>⇄</span>Mini tools'; $('nav').append(nav);
  const view = document.createElement('div'); view.id = 'mini-tools-view'; view.className = 'mini-tools'; view.hidden = true;
  view.innerHTML = `<article class="panel converter"><div class="panel-heading"><div><h3>Currency converter</h3><span>Calculate instantly using the latest available reference rates.</span></div><button id="rates-refresh">Refresh rates</button></div><div class="converter-body"><label>Amount<input id="convert-amount" type="number" min="0" max="1000000000000" step="any" value="1" inputmode="decimal"></label><div class="converter-pair"><label>From<select id="convert-from"></select></label><button id="convert-swap" aria-label="Swap currencies">⇄</button><label>To<select id="convert-to"></select></label></div><div class="conversion-result" aria-live="polite"><small>Converted amount</small><h2 id="convert-result">—</h2><p id="convert-rate"></p></div><p id="rates-status" role="status">Open this tab to load exchange rates.</p><p class="rate-note">Reference rates update daily, not tick by tick. Bank and payment-provider rates may differ. This tool does not change your budget amounts or saved currency.</p><a href="https://www.exchangerate-api.com" target="_blank" rel="noopener">Rates By Exchange Rate API</a></div></article>`;
  document.querySelector('section > .stats').before(view);
  const loadRates = createPocketRateClient();
  let table, loading = false, attempted = false;
  const names = typeof Intl.DisplayNames === 'function' ? new Intl.DisplayNames(['en'], { type: 'currency' }) : null;
  function options(codes) {
    const oldFrom = $('convert-from').value || 'INR', oldTo = $('convert-to').value || 'USD';
    for (const id of ['convert-from', 'convert-to']) {
      $(id).replaceChildren();
      for (const code of codes.slice().sort()) {
        const option = document.createElement('option'); option.value = code;
        option.textContent = code + ' · ' + (names?.of(code) || code); $(id).append(option);
      }
    }
    $('convert-from').value = codes.includes(oldFrom) ? oldFrom : 'INR';
    $('convert-to').value = codes.includes(oldTo) ? oldTo : 'USD';
  }
  function calculate() {
    $('convert-result').textContent = '—'; $('convert-rate').textContent = '';
    if (!table) return;
    try {
      if ($('convert-amount').value.trim() === '') throw Error('Enter an amount to convert.');
      const from = $('convert-from').value, to = $('convert-to').value;
      const result = convertPocketAmount(Number($('convert-amount').value), from, to, table.rates);
      $('convert-result').textContent = new Intl.NumberFormat('en-IN', { style: 'currency', currency: to, maximumFractionDigits: 4 }).format(result.amount);
      const number = new Intl.NumberFormat('en-IN', { maximumSignificantDigits: 8 });
      $('convert-rate').textContent = '1 ' + from + ' = ' + number.format(result.rate) + ' ' + to + ' · 1 ' + to + ' = ' + number.format(1 / result.rate) + ' ' + from;
    } catch (error) { $('convert-rate').textContent = error.message; }
  }
  async function refresh(force = false) {
    if (loading) return; loading = true; attempted = true;
    $('rates-refresh').disabled = true; $('rates-status').textContent = 'Fetching exchange rates…';
    try {
      table = await loadRates(force); options(Object.keys(table.rates)); calculate();
      const old = Date.now() - table.updated > 48 * 3600000;
      $('rates-status').textContent = (table.stale || old ? 'Older rates — refresh failed or the provider has not updated. ' : '') + 'Provider updated: ' + new Date(table.updated).toLocaleString() + (table.cached ? ' · Cached rates' : ' · Just fetched');
    } catch (error) { $('rates-status').textContent = error.message + ' Check your connection and use Refresh rates.'; }
    finally { loading = false; $('rates-refresh').disabled = false; }
  }
  options(pocketCurrencyCodes);
  $('convert-amount').oninput = calculate;
  $('convert-from').onchange = $('convert-to').onchange = calculate;
  $('convert-swap').onclick = () => { const from = $('convert-from').value; $('convert-from').value = $('convert-to').value; $('convert-to').value = from; calculate(); };
  $('rates-refresh').onclick = () => refresh(true);
  view.addEventListener('pocket-open-converter', () => { if (pocketStorageKey && !attempted) refresh(); });
  const originalRender = render;
  render = function () {
    originalRender(); const active = tab === 'Mini tools'; view.hidden = !active;
    $('add').hidden = active; document.querySelector('.toolbar').hidden = active;
    if (!active) return;
    document.querySelectorAll('section > .stats, section > .middle, section > .transactions').forEach(element => element.hidden = true);
    $('leaves-view').hidden = true; $('title').textContent = 'Your everyday mini tools.';
    $('subtitle').textContent = 'Currency conversion, travel notes, packing and task checklists.';
  };
  render();
})();
