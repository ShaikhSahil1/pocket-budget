(() => {
  const workspace = document.querySelector('.cloud-panel');
  const previousProfile = document.querySelector('.profile');
  const profile = document.createElement('button');
  profile.type = 'button'; profile.className = 'profile'; profile.id = 'user-profile';
  profile.innerHTML = previousProfile.innerHTML;
  profile.setAttribute('aria-label', 'Open user profile');
  profile.setAttribute('aria-haspopup', 'dialog');
  profile.setAttribute('aria-controls', 'profile-panel');
  profile.setAttribute('aria-expanded', 'false');
  previousProfile.replaceWith(profile);

  const dialog = document.createElement('dialog');
  dialog.id = 'profile-panel';
  dialog.setAttribute('aria-labelledby', 'profile-panel-title');
  dialog.innerHTML = `<div class="modal-heading"><h2 id="profile-panel-title">User profile</h2><button type="button" id="profile-panel-close" aria-label="Close user profile">×</button></div>`;
  dialog.append(workspace);
  document.body.append(dialog);
  profile.onclick = () => {
    if (!dialog.open) dialog.showModal();
    profile.setAttribute('aria-expanded', 'true');
  };
  $('profile-panel-close').onclick = () => dialog.close();
  dialog.addEventListener('close', () => profile.setAttribute('aria-expanded', 'false'));
  dialog.addEventListener('click', event => { if (event.target === dialog) dialog.close(); });

  // Signed-out visitors still have an obvious way to sign in on the main page.
  const entry = document.createElement('article');
  entry.className = 'panel cloud-panel account-entry';
  entry.innerHTML = `<div class="panel-heading"><div><h3>Your private workspace</h3><p>Sign in with Google to access your budget and leaves.</p><button type="button" id="workspace-restore" class="link-button" hidden>Already paid? Restore access</button></div><button id="workspace-sign-in" class="primary">Sign in with Google</button></div><div class="cloud-progress" id="workspace-opening" aria-hidden="true" hidden><span></span></div>`;
  document.querySelector('section > .stats').before(entry);
  const entryTitle = entry.querySelector('h3');
  const entryCopy = entry.querySelector('p');
  const entryButton = $('workspace-sign-in');
  const restoreButton = $('workspace-restore');
  const opening = $('workspace-opening');
  let paymentRequired = false;
  // A returning signed-in visitor sees an "opening" state instead of a sign-in prompt
  // while the Google session is checked.
  const showOpening = () => {
    entryTitle.textContent = 'Opening your dashboard…';
    entryCopy.textContent = 'Checking your Google session.';
    entryButton.hidden = true; restoreButton.hidden = true; opening.hidden = false;
  };
  if (/(?:^|;\s*)__Host-pocket_signed_in=1/.test(document.cookie)) showOpening();
  const showProfile = () => {
    if (!dialog.open) dialog.showModal();
    profile.setAttribute('aria-expanded', 'true');
  };
  const showSignedOut = () => {
    paymentRequired = false;
    entryTitle.textContent = 'Your private workspace';
    entryCopy.textContent = 'Sign in with Google to access your budget and leaves.';
    entryButton.textContent = 'Sign in with Google';
    entryButton.hidden = false; restoreButton.hidden = true; opening.hidden = true;
  };
  document.addEventListener('monthly-pocket:account-locked', showSignedOut);
  // The payment step stays on the main page; the profile panel opens only when the user asks.
  document.addEventListener('monthly-pocket:payment-required', () => {
    paymentRequired = true;
    entryTitle.textContent = 'Complete your lifetime access';
    entryCopy.textContent = 'Pay ₹499 once with Razorpay. No subscription.';
    entryButton.textContent = 'Pay ₹499 securely';
    entryButton.hidden = false; restoreButton.hidden = false; opening.hidden = true;
  });
  // If the session check ends without opening the workspace (offline, server error),
  // replace the "opening" state with a usable prompt.
  document.addEventListener('monthly-pocket:session-checked', () => {
    if (document.body.classList.contains('account-locked') && !paymentRequired) showSignedOut();
  });
  restoreButton.onclick = () => { showProfile(); const details = document.querySelector('#lifetime-access details'); if (details) details.open = true; };
  $('workspace-sign-in').onclick = () => {
    if (paymentRequired && !$('lifetime-access').hidden) { $('buy-lifetime').click(); return; }
    if ($('cloud-connect').disabled) { profile.click(); return; }
    $('cloud-connect').click();
  };
})();
