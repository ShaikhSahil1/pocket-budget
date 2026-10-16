function clearPocketMonth(source, month, options) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw Error('Choose a valid month.');
  if (!options.budget && !options.leaves) throw Error('Choose what to clear.');
  const next = JSON.parse(JSON.stringify(source));
  if (options.budget) {
    delete next.balances[month];
    next.expenses = next.expenses.filter(entry => entry.date.slice(0, 7) !== month);
  }
  if (options.leaves && next.leaves) {
    next.leaves.entries = next.leaves.entries.filter(entry => entry.date.slice(0, 7) !== month);
  }
  return next;
}

(() => {
  const button = document.createElement('button');
  button.id = 'clear-month'; button.className = 'danger-outline';
  button.textContent = 'Clear month…';
  document.querySelector('.actions').append(button);
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'clear-month-title');
  dialog.innerHTML = `<form id="clear-month-form"><div class="modal-heading"><h2 id="clear-month-title">Clear selected month</h2><button type="button" id="clear-month-close" aria-label="Close">×</button></div><p id="clear-month-description"></p><label class="check"><input id="clear-month-budget" type="checkbox"> Expenses and starting balance <span id="clear-budget-count"></span></label><label class="check"><input id="clear-month-leaves" type="checkbox"> Leave records <span id="clear-leave-count"></span></label><p>Only the selected month is affected, across all categories. Other months’ records and leave allowances stay unchanged. Future carry-forward recalculates. This deletion will also sync to your Google Sheet.</p><button type="button" id="clear-month-backup">Download full backup first</button><label>Type the month to confirm <strong id="clear-month-label"></strong><input id="clear-month-confirm" required autocomplete="off" placeholder="YYYY-MM"></label><p id="clear-month-error" role="alert"></p><div class="modal-actions"><button type="button" id="clear-month-cancel">Cancel</button><button type="submit" class="danger" id="clear-month-submit" disabled>Delete selected data</button></div></form>`;
  document.body.append(dialog);
  let targetMonth, accountKey, snapshot;
  const selected = () => ({ budget: $('clear-month-budget').checked, leaves: $('clear-month-leaves').checked });
  function update() {
    const options = selected();
    const hasBudget = data.expenses.some(entry => entry.date.slice(0, 7) === targetMonth) || Object.hasOwn(data.balances, targetMonth);
    const hasLeaves = data.leaves?.entries.some(entry => entry.date.slice(0, 7) === targetMonth);
    $('clear-month-submit').disabled = $('clear-month-confirm').value !== targetMonth || !(options.budget && hasBudget || options.leaves && hasLeaves);
  }
  button.onclick = () => {
    if (!pocketStorageKey || document.body.classList.contains('account-locked')) return;
    targetMonth = $('month').value; accountKey = pocketStorageKey; snapshot = JSON.stringify(data);
    $('clear-month-form').reset();
    $('clear-month-budget').checked = tab !== 'Leaves';
    $('clear-month-leaves').checked = tab === 'Leaves';
    const name = new Date(targetMonth + '-01T12:00:00').toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
    $('clear-month-description').textContent = 'Choose what to delete for ' + name + ' (' + targetMonth + '). This cannot be undone without a backup.';
    $('clear-month-label').textContent = targetMonth;
    $('clear-budget-count').textContent = '(' + data.expenses.filter(entry => entry.date.slice(0, 7) === targetMonth).length + ' expenses)';
    $('clear-leave-count').textContent = '(' + (data.leaves?.entries.filter(entry => entry.date.slice(0, 7) === targetMonth).length || 0) + ' records)';
    $('clear-month-error').textContent = ''; update(); dialog.showModal();
  };
  $('clear-month-confirm').oninput = update;
  $('clear-month-budget').onchange = $('clear-month-leaves').onchange = update;
  $('clear-month-close').onclick = $('clear-month-cancel').onclick = () => dialog.close();
  $('clear-month-backup').onclick = () => $('json-export').click();
  $('clear-month-form').onsubmit = event => {
    event.preventDefault(); update();
    if ($('clear-month-submit').disabled) return;
    if (!accountKey || accountKey !== pocketStorageKey || $('month').value !== targetMonth || JSON.stringify(data) !== snapshot || document.body.classList.contains('account-locked')) {
      $('clear-month-error').textContent = 'Your account, month or data changed. Close this dialog and review the month again.';
      $('clear-month-submit').disabled = true; return;
    }
    const previous = data;
    try {
      data = clearPocketMonth(data, targetMonth, selected());
      if (persist()) { dialog.close(); toast('Selected data cleared for ' + targetMonth + '. Google sync will follow.'); }
      else {
        if (pocketStorageKey === accountKey) { data = previous; render(); }
        $('clear-month-error').textContent = 'Could not save the deletion. No monthly data was cleared.';
      }
    } catch (error) {
      if (pocketStorageKey === accountKey) { data = previous; render(); }
      $('clear-month-error').textContent = error.message;
    }
  };
})();
