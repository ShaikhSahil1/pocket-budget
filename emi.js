function validatePocketEmis(emis) {
  if (emis === undefined) return;
  if (!Array.isArray(emis) || emis.length > 300) throw Error('Invalid EMI backup.');
  const validDate = value => typeof value === 'string' && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value));
  const ids = new Set();
  for (const emi of emis) {
    if (!emi || typeof emi.id !== 'string' || !emi.id || ids.has(emi.id) || typeof emi.name !== 'string' || !emi.name.trim() || emi.name.length > 100 || !Number.isFinite(emi.amount) || emi.amount <= 0 || !validDate(emi.startDate) || !validDate(emi.endDate) || emi.endDate < emi.startDate || !['auto', 'manual'].includes(emi.mode) || !Array.isArray(emi.manualMonths) || emi.manualMonths.some(month => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) || (emi.paidMonths !== undefined && (!Array.isArray(emi.paidMonths) || emi.paidMonths.some(month => !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)))) || typeof emi.notes !== 'string' || emi.notes.length > 200) throw Error('Invalid EMI record.');
    ids.add(emi.id);
  }
}

function pocketEmiDueInMonth(emi, month) {
  if (!emi || !/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) return false;
  const starts = emi.startDate.slice(0, 7), ends = emi.endDate.slice(0, 7);
  return month >= starts && month <= ends && (emi.mode === 'auto' || emi.manualMonths.includes(month));
}

function pocketEmiPlanMetrics(emi, selectedMonth) {
  const monthIndex = month => Number(month.slice(0, 4)) * 12 + Number(month.slice(5, 7)) - 1;
  const start = emi.startDate.slice(0, 7), end = emi.endDate.slice(0, 7);
  const installments = monthIndex(end) - monthIndex(start) + 1;
  const elapsed = Math.max(0, Math.min(installments, monthIndex(selectedMonth) - monthIndex(start) + 1));
  const status = selectedMonth < start ? 'upcoming' : selectedMonth > end ? 'completed' : 'active';
  return { installments, elapsed, remaining: Math.max(0, installments - elapsed), total: Math.round((installments * emi.amount + Number.EPSILON) * 100) / 100, status, paid: (emi.paidMonths || []).includes(selectedMonth) };
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
  view.innerHTML = `<div class="emi-hero"><div><div class="eyebrow">EMI CONTROL CENTRE</div><h3>Know what is due, paid and remaining.</h3><p>Automatic plans appear every month in their date range. Manual plans appear only when you choose to add them for that month.</p><div class="emi-legend"><span><i class="active"></i>Active</span><span><i class="upcoming"></i>Upcoming</span><span><i class="completed"></i>Completed</span></div></div><div class="emi-total"><small>REMAINING THIS MONTH</small><strong id="emi-month-remaining">₹0</strong><span id="emi-month-count">0 payments due</span></div></div><div class="emi-summary"><article><span>Total due</span><strong id="emi-month-total">₹0</strong><small id="emi-due-count">0 scheduled</small></article><article><span>Paid</span><strong id="emi-month-paid">₹0</strong><small id="emi-paid-count">0 marked paid</small></article><article><span>Active plans</span><strong id="emi-active-count">0</strong><small id="emi-plan-count">0 plans in total</small></article><article><span>Total monthly commitment</span><strong id="emi-commitment">₹0</strong><small>All automatic active plans</small></article></div><article class="panel emi-plans"><div class="panel-heading emi-panel-heading"><div><h3>Your EMI plans</h3><span id="emi-schedule-label"></span></div><div class="emi-filters" id="emi-filters"><button class="active" data-filter="all">All</button><button data-filter="due">Due this month</button><button data-filter="upcoming">Upcoming</button><button data-filter="completed">Completed</button></div></div><div id="emi-cards" class="emi-cards"></div><div id="emi-empty" class="emi-empty"><div>▦</div><h3>No EMI plan added yet</h3><p>Add your first EMI once. Monthly Pocket will build the schedule and show what is due each month.</p><button class="primary" id="emi-empty-add">＋ Add your first EMI</button></div></article>`;
  document.querySelector('.stats').before(view);
  const overview = document.createElement('article');
  overview.id = 'overview-emi';
  overview.className = 'panel overview-emi';
  overview.hidden = true;
  overview.innerHTML = `<div class="panel-heading"><div><span class="eyebrow">EMI SNAPSHOT</span><h3>Your EMI commitments</h3><span id="overview-emi-subtitle"></span></div><button id="overview-emi-open">View all EMIs →</button></div><div class="overview-emi-body"><div class="overview-emi-total"><span>REMAINING THIS MONTH</span><strong id="overview-emi-total"></strong><small id="overview-emi-count"></small></div><div id="overview-emi-list" class="overview-emi-list"></div></div>`;
  document.querySelector('section > .transactions').before(overview);

  const dialog = document.createElement('dialog');
  dialog.className = 'emi-dialog';
  dialog.innerHTML = `<form id="emi-form"><div class="modal-heading"><div><span class="eyebrow">NEW PAYMENT PLAN</span><h2 id="emi-modal-title">Add EMI</h2></div><button type="button" id="emi-close" aria-label="Close">×</button></div><input id="emi-id" type="hidden"><div class="emi-form-intro"><b>One setup. A clear month-by-month view.</b><span>Enter the monthly amount and full date range. The day in “From date” becomes your monthly due day.</span></div><label>What is this EMI for?<input id="emi-name" maxlength="100" required placeholder="e.g. Home loan, car, phone"></label><div class="form-grid"><label>Monthly payment<input id="emi-amount" type="number" min="0.01" step="0.01" required placeholder="₹ 0.00"></label><label>How should it appear?<select id="emi-mode"><option value="auto">Automatically every month</option><option value="manual">Only when I add the month</option></select></label><label>First payment date<input id="emi-start" type="date" required></label><label>Last payment date<input id="emi-end" type="date" required></label></div><div class="emi-form-preview" id="emi-form-preview">Enter an amount and dates to preview the plan.</div><label>Optional notes<input id="emi-notes" maxlength="200" placeholder="e.g. Bank name, loan reference"></label><div class="modal-actions"><button type="button" id="emi-cancel">Cancel</button><button class="primary">Save EMI plan</button></div></form>`;
  document.body.append(dialog);

  const previousRender = render;
  const previousAdd = $('add').onclick;
  let filter = 'all';
  const monthLabel = month => new Date(month + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
  const dueDate = (emi, month) => {
    const day = Math.min(Number(emi.startDate.slice(8, 10)), new Date(Number(month.slice(0, 4)), Number(month.slice(5, 7)), 0).getDate());
    return new Date(month + '-' + String(day).padStart(2, '0') + 'T12:00:00').toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  };
  function previewPlan() {
    const amount = Number($('emi-amount').value), start = $('emi-start').value, end = $('emi-end').value;
    if (!amount || !start || !end || end < start) { $('emi-form-preview').textContent = end && start && end < start ? 'The last payment date must be after the first payment date.' : 'Enter an amount and dates to preview the plan.'; return; }
    const metrics = pocketEmiPlanMetrics({ amount, startDate: start, endDate: end, paidMonths: [] }, start.slice(0, 7));
    $('emi-form-preview').innerHTML = `<strong>${metrics.installments} monthly payments</strong><span>${money(metrics.total)} total · due around day ${Number(start.slice(8, 10))} each month</span>`;
  }
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
    previewPlan();
    dialog.showModal();
  }
  render = function () {
    previousRender();
    const active = tab === 'EMI';
    const overviewActive = tab === 'Overview';
    overview.hidden = !overviewActive;
    overview.style.display = overviewActive ? 'block' : 'none';
    view.hidden = !active;
    view.style.display = active ? 'block' : 'none';
    const month = $('month').value;
    if (overviewActive) {
      const overviewDue = store().filter(emi => pocketEmiDueInMonth(emi, month));
      const unpaid = overviewDue.filter(emi => !(emi.paidMonths || []).includes(month));
      $('overview-emi-total').textContent = money(unpaid.reduce((sum, emi) => sum + emi.amount, 0));
      $('overview-emi-count').textContent = unpaid.length + (unpaid.length === 1 ? ' payment still due' : ' payments still due');
      $('overview-emi-subtitle').textContent = monthLabel(month) + ' · ' + store().length + (store().length === 1 ? ' saved EMI plan' : ' saved EMI plans');
      $('overview-emi-list').innerHTML = overviewDue.length ? overviewDue.slice(0, 4).map(emi => `<div><span class="overview-emi-icon">▦</span><span><b>${esc(emi.name)}</b><small>Due ${dueDate(emi, month)} · ${emi.mode === 'auto' ? 'Automatic' : 'Manual'}</small></span><strong>${money(emi.amount)}<small>${(emi.paidMonths || []).includes(month) ? '✓ Paid' : 'Due'}</small></strong></div>`).join('') : `<div class="overview-emi-none"><span>✓</span><p><b>No EMI due in ${monthLabel(month)}</b><small>${store().length ? 'Your saved plans are still available in the EMI dashboard.' : 'Add an EMI plan to see its monthly details here.'}</small></p></div>`;
    }
    if (!active) return;
    document.querySelectorAll('section > .stats, section > .middle, section > .transactions, #leaves-view').forEach(element => element.hidden = true);
    ['currency', 'export', 'balance'].forEach(id => $(id).hidden = true);
    $('add').textContent = '＋ Add EMI';
    $('title').textContent = 'Your EMIs, clearly scheduled.';
    $('subtitle').textContent = 'Choose automatic monthly entries or stay in control with manual months.';
    const plans = store().map(emi => ({ emi, metrics: pocketEmiPlanMetrics(emi, month), due: pocketEmiDueInMonth(emi, month) }));
    const due = plans.filter(plan => plan.due), paid = due.filter(plan => plan.metrics.paid), totalDue = due.reduce((sum, plan) => sum + plan.emi.amount, 0), paidTotal = paid.reduce((sum, plan) => sum + plan.emi.amount, 0);
    const activePlans = plans.filter(plan => plan.metrics.status === 'active');
    $('emi-month-total').textContent = money(totalDue);
    $('emi-month-paid').textContent = money(paidTotal);
    $('emi-month-remaining').textContent = money(totalDue - paidTotal);
    $('emi-month-count').textContent = (due.length - paid.length) + (due.length - paid.length === 1 ? ' payment due' : ' payments due');
    $('emi-due-count').textContent = due.length + ' scheduled';
    $('emi-paid-count').textContent = paid.length + ' marked paid';
    $('emi-active-count').textContent = activePlans.length;
    $('emi-plan-count').textContent = store().length + (store().length === 1 ? ' plan in total' : ' plans in total');
    $('emi-commitment').textContent = money(activePlans.filter(plan => plan.emi.mode === 'auto').reduce((sum, plan) => sum + plan.emi.amount, 0));
    $('emi-schedule-label').textContent = monthLabel(month) + ' · click any month above to review its schedule';
    $('emi-empty').hidden = store().length > 0;
    const visible = plans.filter(plan => filter === 'all' || filter === 'due' && plan.due || filter === plan.metrics.status);
    $('emi-cards').innerHTML = visible.map(({ emi, metrics, due }) => {
      const activeRange = metrics.status === 'active', progress = Math.round(metrics.elapsed / metrics.installments * 100);
      const scheduleControl = emi.mode === 'manual' && activeRange ? `<button data-action="month" data-id="${esc(emi.id)}" class="emi-secondary">${due ? 'Remove from this month' : '＋ Add to this month'}</button>` : '';
      const paidControl = due ? `<button data-action="paid" data-id="${esc(emi.id)}" class="${metrics.paid ? 'emi-paid' : 'primary'}">${metrics.paid ? '✓ Paid · Undo' : 'Mark as paid'}</button>` : '';
      return `<article class="emi-card"><div class="emi-card-top"><div><span class="emi-status ${metrics.status}">${metrics.status}</span><h3>${esc(emi.name)}</h3><p>${esc(emi.notes || (emi.mode === 'auto' ? 'Automatically added every month' : 'You choose which months to include'))}</p></div><div class="emi-card-amount"><strong>${money(emi.amount)}</strong><span>per month</span></div></div><div class="emi-progress"><div><span>Plan progress</span><b>${metrics.elapsed} of ${metrics.installments} months</b></div><progress max="100" value="${progress}"></progress></div><div class="emi-details"><span><small>PAYMENT RANGE</small><b>${esc(emi.startDate)} → ${esc(emi.endDate)}</b></span><span><small>${due ? 'DUE THIS MONTH' : metrics.status === 'upcoming' ? 'STARTS' : 'PLAN TOTAL'}</small><b>${due ? dueDate(emi, month) : metrics.status === 'upcoming' ? monthLabel(emi.startDate.slice(0, 7)) : money(metrics.total)}</b></span><span><small>REMAINING MONTHS</small><b>${metrics.remaining}</b></span><span><small>SCHEDULE</small><b>${emi.mode === 'auto' ? 'Automatic monthly' : 'Manual control'}</b></span></div><div class="emi-card-actions">${paidControl}${scheduleControl}<button data-action="edit" data-id="${esc(emi.id)}">Edit</button><button data-action="delete" data-id="${esc(emi.id)}" class="danger-link">Delete</button></div></article>`;
    }).join('') || `<div class="emi-filter-empty">No EMI plans match this view for ${monthLabel(month)}.</div>`;
    requestAnimationFrame(() => { if (tab === 'EMI') { view.hidden = false; view.style.display = 'block'; } });
  };
  $('add').onclick = () => tab === 'EMI' ? openEmi() : previousAdd();
  $('overview-emi-open').onclick = () => { tab = 'EMI'; render(); view.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
  $('emi-empty-add').onclick = () => openEmi();
  $('emi-close').onclick = $('emi-cancel').onclick = () => dialog.close();
  ['emi-amount', 'emi-start', 'emi-end'].forEach(id => $(id).addEventListener('input', previewPlan));
  $('emi-filters').onclick = event => {
    const button = event.target.closest('button[data-filter]');
    if (!button) return;
    filter = button.dataset.filter;
    document.querySelectorAll('#emi-filters button').forEach(item => item.classList.toggle('active', item === button));
    render();
  };
  $('emi-form').onsubmit = event => {
    event.preventDefault();
    const existing = store().find(emi => emi.id === $('emi-id').value);
    const emi = { id: $('emi-id').value || crypto.randomUUID(), name: $('emi-name').value.trim(), amount: Number($('emi-amount').value), mode: $('emi-mode').value, startDate: $('emi-start').value, endDate: $('emi-end').value, notes: $('emi-notes').value.trim(), manualMonths: existing?.manualMonths || [], paidMonths: existing?.paidMonths || [] };
    const next = store().filter(item => item.id !== emi.id).concat(emi);
    try { validatePocketEmis(next); } catch (error) { toast(error.message); return; }
    data.emis = next;
    if (persist()) { dialog.close(); toast('EMI schedule saved'); }
  };
  $('emi-cards').onclick = event => {
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
    if (button.dataset.action === 'paid') {
      const month = $('month').value;
      emi.paidMonths ||= [];
      emi.paidMonths = emi.paidMonths.includes(month) ? emi.paidMonths.filter(value => value !== month) : emi.paidMonths.concat(month).sort();
      if (persist()) toast(emi.paidMonths.includes(month) ? 'EMI marked paid for ' + month : 'Paid status removed for ' + month);
    }
    if (button.dataset.action === 'delete' && confirm('Delete the EMI schedule “' + emi.name + '”?')) {
      data.emis = store().filter(item => item.id !== emi.id);
      if (persist()) toast('EMI schedule deleted');
    }
  };
  navButton.addEventListener('click', event => { event.stopPropagation(); tab = 'EMI'; render(); requestAnimationFrame(() => { view.hidden = false; view.style.display = 'block'; }); });
  new MutationObserver(() => { if (tab === 'EMI' && (view.hidden || view.style.display === 'none')) { view.hidden = false; view.style.display = 'block'; } }).observe(view, { attributes: true, attributeFilter: ['hidden', 'style'] });
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
