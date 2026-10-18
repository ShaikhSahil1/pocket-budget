function validatePocketEmis(emis) {
  if (emis === undefined) return;
  if (!Array.isArray(emis) || emis.length > 300) throw Error('Invalid EMI backup.');
  const validDate = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
  const ids = new Set();
  for (const emi of emis) {
    if (!emi || typeof emi.id !== 'string' || !emi.id || ids.has(emi.id) || typeof emi.name !== 'string' || !emi.name.trim() || emi.name.length > 100 || !Number.isFinite(emi.amount) || emi.amount <= 0 || !validDate(emi.startDate) || !validDate(emi.endDate) || emi.endDate < emi.startDate || !['auto', 'manual'].includes(emi.mode) || !Array.isArray(emi.manualMonths) || emi.manualMonths.some(month => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) || typeof emi.notes !== 'string' || emi.notes.length > 200) throw Error('Invalid EMI record.');
    ids.add(emi.id);
  }
}

function pocketEmiDueInMonth(emi, month) {
  if (!emi || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const starts = emi.startDate.slice(0, 7), ends = emi.endDate.slice(0, 7);
  return month >= starts && month <= ends && (emi.mode === 'auto' || emi.manualMonths.includes(month));
}

(() => {
  const store = () => data.emis || [];
  const navButton = document.createElement('button');
  navButton.dataset.tab = 'EMI';
  navButton.innerHTML = '<span>▦</span>EMI';
  $('nav').append(navButton);

  const view = document.createElement('div');
  view.id = 'emi-view';
  view.hidden = true;
  view.innerHTML = `<div class="emi-hero"><div><div class="eyebrow">RECURRING PAYMENTS</div><h3>Your EMIs, month by month.</h3><p>Automatic schedules appear every month between their start and end dates. Manual schedules appear only when you add the selected month.</p></div><div class="emi-total"><small>DUE THIS MONTH</small><strong id="emi-month-total">₹0</strong><span id="emi-month-count">0 payments</span></div></div><article class="panel transactions"><div class="panel-heading"><div><h3>EMI schedule</h3><span id="emi-schedule-label"></span></div></div><div class="table-wrap"><table><thead><tr><th>EMI</th><th>SCHEDULE</th><th>FROM → TO</th><th>THIS MONTH</th><th class="right">AMOUNT</th><th></th></tr></thead><tbody id="emi-rows"></tbody></table></div><p id="emi-empty" class="leave-empty">No EMI plans yet. Choose Add EMI to create an automatic monthly schedule or a plan you control manually.</p></article>`;
  document.querySelector('.stats').before(view);

  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<form id="emi-form"><div class="modal-heading"><h2 id="emi-modal-title">Add EMI</h2><button type="button" id="emi-close" aria-label="Close">×</button></div><input id="emi-id" type="hidden"><label>EMI name<input id="emi-name" maxlength="100" required placeholder="e.g. Home loan, phone, car"></label><div class="form-grid"><label>Amount per month<input id="emi-amount" type="number" min="0.01" step="0.01" required placeholder="0.00"></label><label>Schedule<select id="emi-mode"><option value="auto">Auto-add every month</option><option value="manual">Add months manually</option></select></label><label>From date<input id="emi-start" type="date" required></label><label>To date<input id="emi-end" type="date" required></label></div><label>Notes<input id="emi-notes" maxlength="200" placeholder="Optional account or payment details"></label><p>Auto-add creates a due item for every month in the date range. Manual mode lets you include or remove the month currently selected in Monthly Pocket.</p><div class="modal-actions"><button type="button" id="emi-cancel">Cancel</button><button class="primary">Save EMI</button></div></form>`;
  document.body.append(dialog);

  const previousRender = render;
  const previousAdd = $('add').onclick;
  function openEmi(emi) {
    $('emi-form').reset();
    $('emi-id').value = emi?.id || '';
    $('emi-modal-title').textContent = emi ? 'Edit EMI' : 'Add EMI';
    $('emi-name').value = emi?.name || '';
    $('emi-amount').value = emi?.amount || '';
    $('emi-mode').value = emi?.mode || 'auto';
    $('emi-start').value = emi?.startDate || $('month').value + '-01';
    $('emi-end').value = emi?.endDate || $('month').value + '-28';
    $('emi-notes').value = emi?.notes || '';
    dialog.showModal();
  }
  render = function () {
    previousRender();
    const active = tab === 'EMI';
    view.hidden = !active;
    if (!active) return;
    document.querySelectorAll('section > .stats, section > .middle, section > .transactions, #leaves-view').forEach(element => element.hidden = true);
    ['currency', 'export', 'balance'].forEach(id => $(id).hidden = true);
    $('add').textContent = '＋ Add EMI';
    $('title').textContent = 'Your EMIs, clearly scheduled.';
    $('subtitle').textContent = 'Choose automatic monthly entries or stay in control with manual months.';
    const month = $('month').value;
    const due = store().filter(emi => pocketEmiDueInMonth(emi, month));
    $('emi-month-total').textContent = money(due.reduce((sum, emi) => sum + emi.amount, 0));
    $('emi-month-count').textContent = due.length + (due.length === 1 ? ' payment' : ' payments');
    $('emi-schedule-label').textContent = month + ' · ' + store().length + (store().length === 1 ? ' plan' : ' plans');
    $('emi-empty').hidden = store().length > 0;
    $('emi-rows').innerHTML = store().slice().sort((a, b) => a.startDate.localeCompare(b.startDate)).map(emi => {
      const included = pocketEmiDueInMonth(emi, month), activeRange = month >= emi.startDate.slice(0, 7) && month <= emi.endDate.slice(0, 7);
      const control = emi.mode === 'manual' && activeRange ? `<button class="status ${included ? '' : 'pending'}" data-action="month" data-id="${esc(emi.id)}">${included ? '✓ Added' : '＋ Add month'}</button>` : `<span class="status ${included ? '' : 'pending'}">${included ? '✓ Auto-added' : 'Outside range'}</span>`;
      return `<tr><td><strong>${esc(emi.name)}</strong><small>${esc(emi.notes || '—')}</small></td><td><span class="badge">${emi.mode === 'auto' ? 'Auto monthly' : 'Manual'}</span></td><td>${esc(emi.startDate)} → ${esc(emi.endDate)}</td><td>${control}</td><td class="right"><strong>${money(emi.amount)}</strong></td><td class="row-actions"><button data-action="edit" data-id="${esc(emi.id)}">Edit</button><button data-action="delete" data-id="${esc(emi.id)}">×</button></td></tr>`;
    }).join('');
  };
  $('add').onclick = () => tab === 'EMI' ? openEmi() : previousAdd();
  $('emi-close').onclick = $('emi-cancel').onclick = () => dialog.close();
  $('emi-form').onsubmit = event => {
    event.preventDefault();
    const existing = store().find(emi => emi.id === $('emi-id').value);
    const emi = { id: $('emi-id').value || crypto.randomUUID(), name: $('emi-name').value.trim(), amount: Number($('emi-amount').value), mode: $('emi-mode').value, startDate: $('emi-start').value, endDate: $('emi-end').value, notes: $('emi-notes').value.trim(), manualMonths: existing?.manualMonths || [] };
    const next = store().filter(item => item.id !== emi.id).concat(emi);
    try { validatePocketEmis(next); } catch (error) { toast(error.message); return; }
    data.emis = next;
    if (persist()) { dialog.close(); toast('EMI schedule saved'); }
  };
  $('emi-rows').onclick = event => {
    const button = event.target.closest('button');
    if (!button) return;
    const emi = store().find(item => item.id === button.dataset.id);
    if (!emi) return;
    if (button.dataset.action === 'edit') openEmi(emi);
    if (button.dataset.action === 'month') {
      const month = $('month').value;
      emi.manualMonths = emi.manualMonths.includes(month) ? emi.manualMonths.filter(value => value !== month) : emi.manualMonths.concat(month).sort();
      if (persist()) toast(emi.manualMonths.includes(month) ? 'EMI added for ' + month : 'EMI removed from ' + month);
    }
    if (button.dataset.action === 'delete' && confirm('Delete the EMI schedule “' + emi.name + '”?')) {
      data.emis = store().filter(item => item.id !== emi.id);
      if (persist()) toast('EMI schedule deleted');
    }
  };
  navButton.addEventListener('click', event => { event.stopPropagation(); tab = 'EMI'; render(); });
  render();
})();

(() => {
  const form = $('balance-form');
  const amountLabel = $('balance-value').closest('label');
  const choices = document.createElement('div');
  choices.className = 'funding-choices';
  choices.innerHTML = `<label class="funding-choice"><input type="radio" name="funding-mode" value="replace" checked><span><strong>Set this month’s funds</strong><small>Replace the amount you entered for this month.</small></span></label><label class="funding-choice"><input type="radio" name="funding-mode" value="add"><span><strong>Add extra money</strong><small>Add a bonus, cash deposit or other additional amount.</small></span></label><div class="carry-summary"><span>Carried forward automatically</span><strong id="funding-carried"></strong></div>`;
  amountLabel.before(choices);
  amountLabel.firstChild.textContent = 'Amount';
  form.querySelector('h2').textContent = 'Monthly funds';
  form.querySelector('p').textContent = 'Unused positive balance is already carried forward. Choose whether to set this month’s new funds or add an extra amount.';
  form.querySelector('.primary').textContent = 'Save monthly funds';
  $('balance').innerHTML = '<span>✦</span> Set / add funds';
  $('balance').onclick = () => {
    const month = $('month').value, current = data.balances[month] || 0;
    form.elements['funding-mode'].value = 'replace';
    $('balance-value').value = current || '';
    $('funding-carried').textContent = money(pocketMonthTotals(data, month).carried);
    amountLabel.firstChild.textContent = 'New funds for ' + month;
    $('balance-modal').showModal();
  };
  form.onchange = event => {
    if (event.target.name !== 'funding-mode') return;
    const adding = event.target.value === 'add';
    amountLabel.firstChild.textContent = adding ? 'Additional amount to add' : 'New funds for ' + $('month').value;
    $('balance-value').value = adding ? '' : data.balances[$('month').value] || '';
  };
  form.onsubmit = event => {
    event.preventDefault();
    const amount = Number($('balance-value').value), month = $('month').value;
    if (!Number.isFinite(amount) || amount < 0) return;
    const adding = form.elements['funding-mode'].value === 'add';
    data.balances[month] = adding ? Math.round(((data.balances[month] || 0) + amount + Number.EPSILON) * 100) / 100 : amount;
    if (persist()) { $('balance-modal').close(); toast(adding ? 'Additional funds added' : 'Monthly funds updated'); }
  };
})();
