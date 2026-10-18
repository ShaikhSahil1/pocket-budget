// Leave data travels with the existing full budget backup. Older backups remain valid.
function validateLeaves(leaves) {
  if (leaves === undefined) return;
  const validMonth = m => /^\d{4}-(0[1-9]|1[0-2])$/.test(m);
  const validDays = n => Number.isFinite(n) && n >= 0 && Number.isInteger(n * 2);
  const validDate = s => typeof s === 'string' && /^\d{4}-(0[1-9]|1[0-2])-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s)) && localDate(new Date(s + 'T12:00:00')) === s;
  if (!leaves || !leaves.allowances || typeof leaves.allowances !== 'object' || Array.isArray(leaves.allowances) || !Array.isArray(leaves.entries)) throw Error('Invalid leave backup.');
  for (const [month, allowance] of Object.entries(leaves.allowances)) {
    if (!validMonth(month) || !allowance || !validDays(allowance.casual) || !validDays(allowance.medical) || (allowance.compoff !== undefined && !validDays(allowance.compoff)) || (allowance.festival !== undefined && !validDays(allowance.festival))) throw Error('Invalid leave allowance.');
  }
  if (leaves.settings !== undefined && (!leaves.settings || !['auto', 'manual'].includes(leaves.settings.casualMode) || !validDays(leaves.settings.casualMonthly) || (leaves.settings.casualAutoStart !== undefined && !validMonth(leaves.settings.casualAutoStart)))) throw Error('Invalid leave settings.');
  const ids = new Set();
  for (const entry of leaves.entries) {
    if (!entry || typeof entry.id !== 'string' || ids.has(entry.id) || !['casual', 'medical', 'compoff', 'festival'].includes(entry.type) || !validDate(entry.date) || !validDays(entry.days) || entry.days <= 0 || entry.days > 1 || typeof entry.notes !== 'string') throw Error('Invalid leave record.');
    ids.add(entry.id);
  }
}

(() => {
  const types = ['casual', 'medical', 'compoff', 'festival'];
  const label = type => ({ casual: 'Casual', medical: 'Medical', compoff: 'Comp-off', festival: 'Festival' })[type];
  const store = () => data.leaves || { allowances: {}, entries: [] };
  const editableStore = () => data.leaves ||= { allowances: {}, entries: [] };
  const allowanceFor = month => {
    const effective = Object.keys(store().allowances).filter(m => m <= month).sort().pop();
    return { casual: store().allowances[month]?.casual ?? (effective ? store().allowances[effective].casual : 0),
      medical: store().allowances[month]?.medical || 0,
      compoff: store().allowances[month]?.compoff || 0,
      festival: store().allowances[month]?.festival || 0 };
  };
  const navButton = document.createElement('button');
  navButton.dataset.tab = 'Leaves';
  navButton.innerHTML = '<span>☷</span>Leaves';
  $('nav').append(navButton);
  const view = document.createElement('div');
  view.id = 'leaves-view';
  view.hidden = true;
  view.innerHTML = `<div class="leave-toolbar"><div><h3>Monthly leave balance</h3><p id="leave-policy"></p></div><button id="leave-settings">Set monthly allowances</button></div><div class="stats leave-stats" id="leave-stats"></div><article class="panel transactions"><div class="panel-heading"><div><h3>Leaves taken</h3><span>Record each date separately, including half days.</span></div></div><div class="table-wrap"><table><thead><tr><th>DATE</th><th>TYPE</th><th>DAYS</th><th>NOTES</th><th></th></tr></thead><tbody id="leave-rows"></tbody></table></div><p id="leave-empty" class="leave-empty">No leaves recorded this month. Use Add leave to record time off.</p></article>`;
  document.querySelector('.stats').before(view);
  const dialog = document.createElement('dialog');
  dialog.innerHTML = `<form id="leave-form"><div class="modal-heading"><h2 id="leave-modal-title">Add leave</h2><button type="button" id="leave-close" aria-label="Close">×</button></div><input type="hidden" id="leave-id"><label>Date<input id="leave-date" type="date" required></label><div class="form-grid"><label>Leave type<select id="leave-type"><option value="casual">Casual leave</option><option value="festival">Festival leave</option><option value="medical">Medical leave</option><option value="compoff">Comp-off leave</option></select></label><label>Days<select id="leave-days"><option value="1">1 day</option><option value="0.5">Half day</option></select></label></div><label>Details / festival name<input id="leave-notes" maxlength="200" placeholder="e.g. Diwali, family event, appointment"></label><p>Each record deducts from the selected month. A negative balance shows leave taken beyond your allowance.</p><div class="modal-actions"><button type="button" id="leave-cancel">Cancel</button><button class="primary">Save leave</button></div></form>`;
  document.body.append(dialog);
  const settings = document.createElement('dialog');
  settings.innerHTML = `<form id="leave-settings-form"><div class="modal-heading"><h2>Monthly leave allowances</h2><button type="button" id="leave-settings-close" aria-label="Close">×</button></div><p id="leave-effective"></p><label>Casual leave credit<select id="leave-casual-mode"><option value="auto">Auto-add every month</option><option value="manual">I will add it manually</option></select></label><div class="form-grid"><label id="leave-casual-auto-wrap">Casual days auto-added monthly<input id="leave-casual-monthly" type="number" min="0" step="0.5" required value="1.5"></label><label id="leave-casual-manual-wrap">Casual days added this month<input id="leave-casual" type="number" min="0" step="0.5" required></label><label>Festival days added this month<input id="leave-festival" type="number" min="0" step="0.5" required></label><label>Medical days added this month<input id="leave-medical" type="number" min="0" step="0.5" required></label><label>Comp-off days added this month<input id="leave-compoff" type="number" min="0" step="0.5" required></label></div><p>Automatic casual leave defaults to 1.5 days each month. Choose manual to control each month yourself. Festival, medical and comp-off credits are always added manually for the selected month. Unused positive days carry forward.</p><div class="modal-actions"><button type="button" id="leave-settings-cancel">Cancel</button><button class="primary">Save allowances</button></div></form>`;
  document.body.append(settings);
  function openLeave(entry) {
    $('leave-form').reset();
    $('leave-modal-title').textContent = entry ? 'Edit leave' : 'Add leave';
    $('leave-id').value = entry?.id || '';
    $('leave-date').value = entry?.date || ($('month').value === localDate(new Date()).slice(0, 7) ? localDate(new Date()) : $('month').value + '-01');
    $('leave-type').value = entry?.type || 'casual';
    $('leave-days').value = entry?.days || 1;
    $('leave-notes').value = entry?.notes || '';
    dialog.showModal();
  }
  const budgetRender = render;
  const budgetAdd = $('add').onclick;
  render = function () {
    budgetRender();
    const active = tab === 'Leaves';
    view.hidden = !active;
    document.querySelectorAll('section > .stats, section > .middle, section > .transactions').forEach(el => el.hidden = active);
    ['currency', 'export', 'balance'].forEach(id => $(id).hidden = active);
    $('add').textContent = active ? '＋ Add leave' : '＋ Add expense';
    if (!active) return;
    $('title').textContent = 'Your leaves, at a glance.';
    $('subtitle').textContent = 'Set your monthly allowances and keep track of time off.';
    const month = $('month').value, totals = pocketMonthTotals(data, month), allowance = totals.leaveTotal;
    const entries = store().entries.filter(e => e.date.slice(0, 7) === month).sort((a, b) => b.date.localeCompare(a.date));
    const leaveSettings = store().settings || { casualMode: Object.keys(store().allowances).length ? 'manual' : 'auto', casualMonthly: 1.5 };
    $('leave-policy').textContent = (leaveSettings.casualMode === 'auto' ? `${leaveSettings.casualMonthly} casual days auto-added monthly` : 'Casual leave added manually') + ' · Festival, medical and comp-off added manually · Unused days carry forward';
    $('leave-stats').innerHTML = types.map(type => {
      const used = entries.filter(e => e.type === type).reduce((sum, e) => sum + e.days, 0);
      return `<article class="stat ${type === 'casual' ? 'dark' : ''}"><div>${label(type)} leave remaining</div><h2>${allowance[type] - used} days</h2><small>${totals.allowance[type]} ${type === 'casual' && leaveSettings.casualMode === 'auto' ? 'auto-added' : 'added this month'} + ${totals.leaveCarried[type]} carried · ${used} taken</small></article>`;
    }).join('');
    $('leave-empty').hidden = entries.length > 0;
    $('leave-rows').innerHTML = entries.map(e => `<tr><td>${esc(e.date)}</td><td><span class="badge">${label(e.type)} leave</span></td><td>${e.days}</td><td class="leave-notes">${esc(e.notes || '—')}</td><td class="row-actions"><button data-action="edit" data-id="${esc(e.id)}" aria-label="Edit leave on ${esc(e.date)}">Edit</button><button data-action="delete" data-id="${esc(e.id)}" aria-label="Delete leave on ${esc(e.date)}">×</button></td></tr>`).join('');
  };
  $('add').onclick = () => tab === 'Leaves' ? openLeave() : budgetAdd();
  $('leave-close').onclick = $('leave-cancel').onclick = () => dialog.close();
  $('leave-settings-close').onclick = $('leave-settings-cancel').onclick = () => settings.close();
  $('leave-settings').onclick = () => {
    const allowance = allowanceFor($('month').value);
    const leaveSettings = store().settings || { casualMode: Object.keys(store().allowances).length ? 'manual' : 'auto', casualMonthly: 1.5 };
    $('leave-effective').textContent = 'Effective from ' + $('month').value + '. Earlier months keep their allowances.';
    types.forEach(type => $('leave-' + type).value = allowance[type]);
    $('leave-casual-mode').value = leaveSettings.casualMode;
    $('leave-casual-monthly').value = leaveSettings.casualMonthly;
    toggleCasualMode();
    settings.showModal();
  };
  function toggleCasualMode() {
    const automatic = $('leave-casual-mode').value === 'auto';
    $('leave-casual-auto-wrap').hidden = !automatic;
    $('leave-casual-manual-wrap').hidden = automatic;
    $('leave-casual-monthly').required = automatic;
    $('leave-casual').required = !automatic;
  }
  $('leave-casual-mode').onchange = toggleCasualMode;
  $('leave-settings-form').onsubmit = event => {
    event.preventDefault();
    const allowance = Object.fromEntries(types.map(type => [type, Number($('leave-' + type).value)]));
    const previousSettings = store().settings || {};
    const casualMode = $('leave-casual-mode').value;
    const leaveSettings = { casualMode, casualMonthly: Number($('leave-casual-monthly').value), casualAutoStart: casualMode === 'auto' ? (previousSettings.casualAutoStart || $('month').value) : previousSettings.casualAutoStart };
    const leaves = { allowances: { ...store().allowances, [$('month').value]: allowance }, entries: store().entries, settings: leaveSettings };
    try { validateLeaves(leaves); } catch (error) { toast(error.message); return; }
    data.leaves = leaves;
    if (persist()) { settings.close(); toast('Monthly leave allowances saved'); }
  };
  $('leave-form').onsubmit = event => {
    event.preventDefault();
    const entry = { id: $('leave-id').value || crypto.randomUUID(), date: $('leave-date').value, type: $('leave-type').value, days: Number($('leave-days').value), notes: $('leave-notes').value.trim() };
    const entries = store().entries.filter(e => e.id !== entry.id).concat(entry);
    const leaves = { allowances: store().allowances, entries, ...(store().settings ? { settings: store().settings } : {}) };
    try { validateLeaves(leaves); } catch (error) { toast(error.message); return; }
    data.leaves = leaves;
    $('month').value = entry.date.slice(0, 7);
    if (persist()) { dialog.close(); toast('Leave saved'); }
  };
  $('leave-rows').onclick = event => {
    const button = event.target.closest('button');
    if (!button) return;
    const entry = store().entries.find(e => e.id === button.dataset.id);
    if (!entry) return;
    if (button.dataset.action === 'edit') openLeave(entry);
    if (button.dataset.action === 'delete' && confirm('Delete this ' + label(entry.type).toLowerCase() + ' leave on ' + entry.date + '?')) {
      editableStore().entries = store().entries.filter(e => e.id !== entry.id);
      if (persist()) toast('Leave deleted');
    }
  };
  render();
})();

// Keep the core HTML stable while loading the optional EMI workspace.
const pocketEmiScript = document.createElement('script');
pocketEmiScript.src = 'emi.js';
document.body.append(pocketEmiScript);
