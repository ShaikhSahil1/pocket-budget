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
  entry.innerHTML = `<div class="panel-heading"><div><h3>Your private workspace</h3><p>Sign in with Google to access your budget and leaves.</p></div><button id="workspace-sign-in" class="primary">Sign in with Google</button></div>`;
  document.querySelector('section > .stats').before(entry);
  const entryTitle = entry.querySelector('h3');
  const entryCopy = entry.querySelector('p');
  const entryButton = $('workspace-sign-in');
  const showProfile = () => {
    if (!dialog.open) dialog.showModal();
    profile.setAttribute('aria-expanded', 'true');
  };
  const showSignedOut = () => {
    entryTitle.textContent = 'Your private workspace';
    entryCopy.textContent = 'Sign in with Google to access your budget and leaves.';
    entryButton.textContent = 'Sign in with Google';
  };
  document.addEventListener('monthly-pocket:account-locked', showSignedOut);
  document.addEventListener('monthly-pocket:payment-required', () => {
    entryTitle.textContent = 'Complete your lifetime access';
    entryCopy.textContent = 'Pay ₹499 once with Razorpay, or restore an earlier verified payment.';
    entryButton.textContent = 'Continue to secure payment';
    showProfile();
  });
  $('workspace-sign-in').onclick = () => {
    if (!$('lifetime-access').hidden) { showProfile(); return; }
    if ($('cloud-connect').disabled) { profile.click(); return; }
    $('cloud-connect').click();
  };
})();
