// First-login guided tour: highlights each tab and button one at a time.
// Starts once per Google account on this browser; "Take the app tour" in the
// user profile replays it at any time.
function pocketTourSteps() {
  return [
    { title: 'Welcome to Monthly Pocket', text: 'This quick tour shows what each tab and button does. It takes about a minute. You can skip it now and replay it later from your user profile.' },
    { target: 'nav button[data-tab="Overview"]', tab: 'Overview', title: 'Overview', text: 'Your home screen: this month’s balance, spending by category and every expense in one place.' },
    { target: '.month-picker', tab: 'Overview', title: 'Choose a month', text: 'Use ‹ and › or pick a month. Everything on the page — funds, expenses, leaves and EMIs — follows the month you choose.' },
    { target: '#balance', tab: 'Overview', title: 'Set / add funds', text: 'Start here each month. Enter the new money you received (salary, allowance), or add an extra amount such as a bonus. Unused money from earlier months is carried forward for you.' },
    { target: 'section > .stats .stat.dark', tab: 'Overview', title: 'Available balance', text: 'What you can still spend this month: new funds plus carry-forward, minus expenses and EMIs. Refunds are added back once you mark them received.' },
    { target: '#add', tab: 'Overview', title: 'Add expense', text: 'Record a purchase with its amount, date, category and details. Tick “will be reimbursed” for money you expect back.' },
    { target: '#upi-pay-add', tab: 'Overview', title: 'Pay & Add Expense', text: 'On your phone, open Google Pay, PhonePe, Paytm or another UPI app straight from here. When you come back, Monthly Pocket asks what you paid and adds it as an expense.' },
    { target: 'section > .middle .breakdown', tab: 'Overview', title: 'Where your money goes', text: 'A chart of this month’s spending by category, with your daily spending allowance alongside.' },
    { target: '#search', tab: 'Overview', title: 'Your expenses', text: 'Every expense for the month. Search by name, tap Edit or × to change one, and tap “Pending refund” when the money comes back.' },
    { target: '#currency', tab: 'Overview', title: 'Currency', text: 'Change how amounts are shown. This changes the symbol only—amounts are not converted.' },
    { target: '#export', tab: 'Overview', title: 'Export CSV', text: 'Download this month’s funds and expenses as a spreadsheet file.' },
    { target: '#clear-month', tab: 'Overview', title: 'Clear month', text: 'Remove a month’s expenses, balance or leave records. You confirm by typing the month, and you can download a backup first.' },
    { target: 'nav button[data-tab="Business Trip"]', tab: 'Overview', title: 'Business Trip', text: 'Shows only business-trip expenses for the selected month.' },
    { target: 'nav button[data-tab="Reimbursable"]', tab: 'Overview', title: 'Reimbursable', text: 'Every expense you expect to be paid back, from any category. Mark each refund received when it arrives.' },
    { target: 'nav button[data-tab="Personal Buying"]', tab: 'Overview', title: 'Personal Buying', text: 'Your personal purchases. Scheduled EMI payments also appear here.' },
    { target: 'nav button[data-tab="Monthly Travelling"]', tab: 'Overview', title: 'Monthly Travelling', text: 'Daily commute and travel costs for the month.' },
    { target: 'nav button[data-tab="Leaves"]', tab: 'Leaves', title: 'Leaves', text: 'Track casual, festival, medical and comp-off leave. Unused days carry forward each month.' },
    { target: '#leave-settings', tab: 'Leaves', title: 'Set monthly allowances', text: 'Casual leave is added automatically (1.5 days by default). Add festival, medical and comp-off days when you receive them.' },
    { target: '#add', tab: 'Leaves', title: 'Add leave', text: 'On this tab the main button records time off: choose the date, type and number of days (half days allowed).' },
    { target: 'nav button[data-tab="Mini tools"]', tab: 'Mini tools', title: 'Mini tools', text: 'Handy extras saved to your account.' },
    { target: '#tool-cards', tab: 'Mini tools', title: 'Converter & travel planner', text: 'Convert currencies with daily reference rates, or plan a trip with notes, a packing list and tasks.' },
    { target: 'nav button[data-tab="EMI"]', tab: 'EMI', title: 'EMI', text: 'See every loan or EMI plan: what is due this month, what is paid and what remains.' },
    { target: '#add', tab: 'EMI', title: 'Add EMI', text: 'Enter an EMI once with its amount, months and due day. It appears automatically each month and can remind you on the due date.' },
    { target: '#user-profile', tab: 'Overview', title: 'User profile', text: 'Your Google account, your private Google Sheet, Load and Save, full backup and restore, the app tour and Log out.' },
    { target: '.mp-chat__launcher', tab: 'Overview', title: 'Ask Monthly Pocket', text: 'Questions while you use the app? Ask the help chat. Please don’t type financial or payment details into it.' },
    { title: 'You’re ready', text: 'Start with “Set / add funds” for this month, then add your first expense. Your data saves to this browser and your own Google Sheet automatically.', last: true },
  ];
}

(() => {
  const steps = pocketTourSteps();
  const doneKey = () => pocketStorageKey ? pocketStorageKey + ':tour-done' : '';
  const root = document.createElement('div');
  root.className = 'mp-tour'; root.hidden = true;
  root.innerHTML = `<div class="mp-tour__shade"></div><div class="mp-tour__spot" aria-hidden="true"></div><section class="mp-tour__card" role="dialog" aria-modal="true" aria-labelledby="mp-tour-title" aria-describedby="mp-tour-text"><div class="mp-tour__top"><span class="mp-tour__count" id="mp-tour-count"></span><button type="button" class="mp-tour__skip" id="mp-tour-skip">Skip tour</button></div><h3 id="mp-tour-title"></h3><p id="mp-tour-text"></p><div class="mp-tour__bar"><i id="mp-tour-progress"></i></div><div class="mp-tour__actions"><button type="button" id="mp-tour-back">Back</button><button type="button" class="primary" id="mp-tour-next">Next</button></div></section>`;
  document.body.append(root);
  const spot = root.querySelector('.mp-tour__spot'), card = root.querySelector('.mp-tour__card');
  let index = 0, active = false, current = null, startTab = 'Overview', returnFocus = null;

  const visible = element => { if (!element) return false; const box = element.getBoundingClientRect(); return box.width > 0 && box.height > 0; };
  const setTab = name => { if (typeof tab !== 'undefined' && tab !== name) { tab = name; render(); } };

  function available(step) {
    if (!step.target) return true;
    if (step.tab) setTab(step.tab);
    return visible(document.querySelector(step.target));
  }

  function place() {
    if (!active) return;
    const margin = 16, gap = 14, vw = innerWidth, vh = innerHeight;
    if (!current) {
      spot.hidden = true; root.classList.add('mp-tour--centered');
      card.style.left = Math.max(margin, (vw - card.offsetWidth) / 2) + 'px';
      card.style.top = Math.max(margin, (vh - card.offsetHeight) / 2) + 'px';
      return;
    }
    root.classList.remove('mp-tour--centered'); spot.hidden = false;
    const box = current.getBoundingClientRect(), pad = 6;
    Object.assign(spot.style, { left: box.left - pad + 'px', top: box.top - pad + 'px', width: box.width + pad * 2 + 'px', height: box.height + pad * 2 + 'px' });
    const width = card.offsetWidth, height = card.offsetHeight;
    let top = box.bottom + pad + gap;
    if (top + height > vh - margin) top = box.top - pad - gap - height;
    if (top < margin) top = Math.min(vh - height - margin, Math.max(margin, box.bottom + pad + gap));
    const left = Math.min(vw - width - margin, Math.max(margin, box.left + box.width / 2 - width / 2));
    card.style.left = left + 'px'; card.style.top = Math.max(margin, top) + 'px';
  }

  function show(next, direction = 1) {
    while (next >= 0 && next < steps.length && !available(steps[next])) next += direction;
    if (next < 0) next = 0;
    if (next >= steps.length) { finish(); return; }
    index = next;
    const step = steps[index];
    current = step.target ? document.querySelector(step.target) : null;
    if (current) current.scrollIntoView({ block: 'center', inline: 'center', behavior: 'auto' });
    $('mp-tour-title').textContent = step.title;
    $('mp-tour-text').textContent = step.text;
    $('mp-tour-count').textContent = (index + 1) + ' of ' + steps.length;
    $('mp-tour-progress').style.width = ((index + 1) / steps.length * 100) + '%';
    $('mp-tour-back').hidden = index === 0;
    $('mp-tour-next').textContent = step.last ? 'Start using Monthly Pocket' : index === 0 ? 'Show me around' : 'Next';
    $('mp-tour-skip').hidden = !!step.last;
    requestAnimationFrame(place);
    $('mp-tour-next').focus({ preventScroll: true });
  }

  function start() {
    if (active || !pocketStorageKey || document.body.classList.contains('account-locked')) return;
    document.querySelectorAll('dialog[open]').forEach(dialog => dialog.close());
    active = true; returnFocus = document.activeElement; startTab = typeof tab !== 'undefined' ? tab : 'Overview';
    root.hidden = false; document.body.classList.add('mp-tour-open');
    show(0);
  }

  function finish() {
    if (!active) return;
    active = false; root.hidden = true; current = null; document.body.classList.remove('mp-tour-open');
    try { const key = doneKey(); if (key) localStorage.setItem(key, String(Date.now())); } catch {}
    setTab(startTab);
    scrollTo({ top: 0 });
    returnFocus?.focus?.({ preventScroll: true });
  }

  $('mp-tour-next').onclick = () => show(index + 1, 1);
  $('mp-tour-back').onclick = () => show(index - 1, -1);
  $('mp-tour-skip').onclick = finish;
  root.querySelector('.mp-tour__shade').onclick = () => {};
  document.addEventListener('keydown', event => {
    if (!active) return;
    if (event.key === 'Escape') { event.preventDefault(); finish(); }
    else if (event.key === 'ArrowRight') show(index + 1, 1);
    else if (event.key === 'ArrowLeft' && index > 0) show(index - 1, -1);
    else if (event.key === 'Tab') { // keep keyboard focus inside the tour card
      const buttons = [...card.querySelectorAll('button')].filter(button => !button.hidden);
      const position = buttons.indexOf(document.activeElement);
      event.preventDefault();
      buttons[(position + (event.shiftKey ? -1 : 1) + buttons.length) % buttons.length].focus();
    }
  });
  addEventListener('resize', () => requestAnimationFrame(place));
  addEventListener('scroll', () => requestAnimationFrame(place), true);
  document.addEventListener('monthly-pocket:account-locked', () => { if (active) { active = false; root.hidden = true; document.body.classList.remove('mp-tour-open'); } });

  // Replay button in the user profile.
  const replay = document.createElement('button');
  replay.type = 'button'; replay.id = 'tour-replay'; replay.textContent = 'Take the app tour';
  $('account-actions')?.prepend(replay);
  replay.onclick = () => { document.getElementById('profile-panel')?.close(); setTimeout(start, 50); };

  // First visit for this account on this browser: start once the workspace is open.
  document.addEventListener('monthly-pocket:session-checked', () => {
    let seen = true; try { seen = !!localStorage.getItem(doneKey()); } catch {}
    if (seen || document.body.classList.contains('account-locked')) return;
    setTimeout(() => { if (!document.querySelector('dialog[open]')) start(); }, 600);
  });
})();
