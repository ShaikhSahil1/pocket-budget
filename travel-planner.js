(() => {
  const panel = document.createElement('article'); panel.className = 'panel travel-planner';
  panel.innerHTML = `<div class="panel-heading"><div><h3>Travel planner notes</h3><span>Packing and tasks, saved with your Google account.</span></div><button id="plan-add" class="primary">＋ New plan</button></div><div class="planner-body"><label>Choose a plan<select id="plan-select"></select></label><div id="plan-detail"></div><p id="plan-empty">Create a travel plan to keep notes and organize your packing and tasks.</p></div>`;
  $('mini-tools-view').append(panel);
  const planDialog = document.createElement('dialog');
  planDialog.setAttribute('aria-labelledby', 'plan-dialog-title');
  planDialog.innerHTML = `<form id="plan-form"><div class="modal-heading"><h2 id="plan-dialog-title">New travel plan</h2><button type="button" id="plan-close" aria-label="Close travel plan">×</button></div><label>Plan name<input id="plan-title" required maxlength="120" placeholder="e.g. Goa weekend"></label><label>Travel notes<textarea id="plan-notes" rows="6" maxlength="10000" placeholder="Travel details, reminders or useful information"></textarea></label><p id="plan-error" role="alert"></p><div class="modal-actions"><button type="button" id="plan-cancel">Cancel</button><button class="primary">Save plan</button></div></form>`;
  document.body.append(planDialog);
  const itemDialog = document.createElement('dialog');
  itemDialog.setAttribute('aria-labelledby', 'plan-item-title');
  itemDialog.innerHTML = `<form id="plan-item-form"><div class="modal-heading"><h2 id="plan-item-title">Checklist item</h2><button type="button" id="plan-item-close" aria-label="Close checklist item">×</button></div><label>Item details<input id="plan-item-text" required maxlength="300" placeholder="e.g. Pack phone charger"></label><p id="plan-item-error" role="alert"></p><div class="modal-actions"><button type="button" id="plan-item-cancel">Cancel</button><button class="primary">Save item</button></div></form>`;
  document.body.append(itemDialog);
  let selectedId = '', selectedAccount = null, editingId = '', editingAccount, editingPlan, editingKind, editingItem;
  const plans = () => data.travelPlans || [];
  const active = () => plans().find(plan => plan.id === selectedId);
  const accountValid = key => key && key === pocketStorageKey && !document.body.classList.contains('account-locked');
  function save(next) {
    if (!accountValid(selectedAccount)) throw Error('Account changed. Reload before editing your planner.');
    validatePocketTravelPlans(next);
    const previous = data, accountKey = pocketStorageKey;
    data = { ...data, travelPlans: next };
    if (persist()) return true;
    if (pocketStorageKey === accountKey) { data = previous; render(); }
    throw Error('Could not save your plan. Please try again.');
  }
  function draw() {
    if (selectedAccount !== pocketStorageKey) { selectedAccount = pocketStorageKey; selectedId = ''; }
    if (!active()) selectedId = plans()[0]?.id || '';
    $('plan-select').innerHTML = plans().map(plan => `<option value="${esc(plan.id)}">${esc(plan.title)}</option>`).join('');
    $('plan-select').value = selectedId; $('plan-select').parentElement.hidden = !plans().length;
    $('plan-empty').hidden = !!active();
    const plan = active();
    if (!plan) { $('plan-detail').innerHTML = ''; return; }
    const checklist = (kind, title) => {
      const items = plan[kind], done = items.filter(item => item.done).length;
      return `<section class="checklist"><div class="checklist-heading"><div><h4>${title}</h4><small>${done} of ${items.length} completed</small></div><button data-action="add-item" data-kind="${kind}">＋ Add item</button></div><progress value="${done}" max="${Math.max(1, items.length)}" aria-label="${title} completion"></progress><ul>${items.map(item => `<li class="${item.done ? 'completed' : ''}"><label class="check"><input type="checkbox" data-item="${esc(item.id)}" data-kind="${kind}" ${item.done ? 'checked' : ''}><span>${esc(item.text)}</span></label><div><button data-action="edit-item" data-kind="${kind}" data-item="${esc(item.id)}" aria-label="Edit ${esc(item.text)}">Edit</button><button data-action="delete-item" data-kind="${kind}" data-item="${esc(item.id)}" aria-label="Delete ${esc(item.text)}">×</button></div></li>`).join('')}</ul>${items.length ? '' : '<p>No items yet. Add your first item.</p>'}</section>`;
    };
    $('plan-detail').innerHTML = `<div class="plan-heading"><h3>${esc(plan.title)}</h3><div><button data-action="edit-plan">Edit notes</button><button data-action="delete-plan" class="danger-outline">Delete plan</button></div></div><p class="plan-notes">${esc(plan.notes || 'No notes yet. Use Edit notes to add your travel details.')}</p><div class="checklist-grid">${checklist('packing', 'Packing checklist')}${checklist('tasks', 'Task checklist')}</div>`;
  }
  function editPlan(plan) {
    if (!accountValid(pocketStorageKey)) return;
    editingId = plan?.id || ''; editingAccount = pocketStorageKey;
    $('plan-dialog-title').textContent = plan ? 'Edit travel plan' : 'New travel plan';
    $('plan-title').value = plan?.title || ''; $('plan-notes').value = plan?.notes || ''; $('plan-error').textContent = '';
    planDialog.showModal();
  }
  $('plan-add').onclick = () => editPlan();
  $('plan-select').onchange = () => { selectedId = $('plan-select').value; draw(); };
  $('plan-close').onclick = $('plan-cancel').onclick = () => planDialog.close();
  $('plan-item-close').onclick = $('plan-item-cancel').onclick = () => itemDialog.close();
  $('plan-form').onsubmit = event => {
    event.preventDefault(); if (!accountValid(editingAccount)) { planDialog.close(); return; }
    try {
      const existing = plans().find(plan => plan.id === editingId);
      if (editingId && !existing) throw Error('This plan was removed. Close and reopen the planner.');
      const plan = { ...(existing || { id: crypto.randomUUID(), packing: [], tasks: [] }), title: $('plan-title').value.trim(), notes: $('plan-notes').value.trim() };
      const next = existing ? plans().map(entry => entry.id === plan.id ? plan : entry) : plans().concat(plan);
      const previousSelection = selectedId; selectedId = plan.id;
      try { save(next); } catch (error) { selectedId = previousSelection; draw(); throw error; }
      planDialog.close(); toast('Travel plan saved');
    } catch (error) { $('plan-error').textContent = error.message; }
  };
  $('plan-detail').onclick = event => {
    const button = event.target.closest('button'), plan = active();
    if (!button || !plan || !accountValid(selectedAccount)) return;
    const action = button.dataset.action, kind = button.dataset.kind;
    if (action === 'edit-plan') { editPlan(plan); return; }
    if (action === 'delete-plan') {
      if (!confirm('Delete “' + plan.title + '” and all its notes, packing items and tasks?')) return;
      try { save(plans().filter(entry => entry.id !== plan.id)); toast('Travel plan deleted'); } catch (error) { toast(error.message); } return;
    }
    if (!['packing', 'tasks'].includes(kind)) return;
    const item = plan[kind].find(entry => entry.id === button.dataset.item);
    if (action === 'delete-item' && item) {
      if (!confirm('Delete “' + item.text + '”?')) return;
      try { save(plans().map(entry => entry.id === plan.id ? { ...entry, [kind]: entry[kind].filter(row => row.id !== item.id) } : entry)); } catch (error) { toast(error.message); } return;
    }
    if (action === 'add-item' || action === 'edit-item' && item) {
      editingPlan = plan.id; editingKind = kind; editingItem = item?.id || ''; editingAccount = pocketStorageKey;
      $('plan-item-title').textContent = (item ? 'Edit ' : 'Add ') + (kind === 'packing' ? 'packing item' : 'task');
      $('plan-item-text').value = item?.text || ''; $('plan-item-error').textContent = ''; itemDialog.showModal();
    }
  };
  $('plan-detail').onchange = event => {
    const input = event.target, plan = active(), kind = input.dataset.kind;
    if (!plan || !['packing', 'tasks'].includes(kind) || !input.dataset.item) return;
    try { save(plans().map(entry => entry.id === plan.id ? { ...entry, [kind]: entry[kind].map(item => item.id === input.dataset.item ? { ...item, done: input.checked } : item) } : entry)); }
    catch (error) { draw(); toast(error.message); }
  };
  $('plan-item-form').onsubmit = event => {
    event.preventDefault(); if (!accountValid(editingAccount)) { itemDialog.close(); return; }
    try {
      const plan = plans().find(entry => entry.id === editingPlan);
      if (!plan) throw Error('This plan was removed. Close and reopen the planner.');
      const existing = plan[editingKind].find(item => item.id === editingItem);
      if (editingItem && !existing) throw Error('This item was removed. Close and reopen the planner.');
      const item = { id: existing?.id || crypto.randomUUID(), text: $('plan-item-text').value.trim(), done: existing?.done || false };
      const items = existing ? plan[editingKind].map(row => row.id === item.id ? item : row) : plan[editingKind].concat(item);
      save(plans().map(entry => entry.id === plan.id ? { ...entry, [editingKind]: items } : entry));
      itemDialog.close(); toast('Checklist saved');
    } catch (error) { $('plan-item-error').textContent = error.message; }
  };
  const originalRender = render; render = function () { originalRender(); draw(); };
  draw();
})();
