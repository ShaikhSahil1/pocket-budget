(() => {
  const view = $('mini-tools-view');
  const converter = view.querySelector('.converter');
  const planner = view.querySelector('.travel-planner');
  const home = document.createElement('div'); home.className = 'tool-cards'; home.id = 'tool-cards';
  home.innerHTML = `<button class="tool-card tool-card-currency" id="tool-card-currency" data-tool="currency"><span class="tool-card-icon" aria-hidden="true">⇄</span><span class="eyebrow">MONEY, IN PERSPECTIVE</span><h3>Currency converter</h3><p>Convert currencies, compare exchange rates and check the latest daily reference rates.</p><span class="tool-card-open">Open converter <span aria-hidden="true">↗</span></span></button><button class="tool-card tool-card-planner" id="tool-card-planner" data-tool="planner"><span class="tool-card-icon" aria-hidden="true">☷</span><span class="eyebrow">A LITTLE MORE PREPARED</span><h3>Travel planner</h3><p>Keep your travel notes, packing list and tasks together, saved to your account.</p><span class="tool-card-open">Open planner <span aria-hidden="true">↗</span></span></button>`;
  const back = document.createElement('button'); back.id = 'tools-back'; back.className = 'tools-back';
  back.textContent = '← All mini tools'; back.hidden = true;
  view.prepend(back, home);
  let selected = null, accountKey = pocketStorageKey;
  function draw() {
    if (accountKey !== pocketStorageKey || tab !== 'Mini tools') { selected = null; accountKey = pocketStorageKey; }
    home.hidden = selected !== null; back.hidden = selected === null;
    converter.hidden = selected !== 'currency'; planner.hidden = selected !== 'planner';
    if (tab !== 'Mini tools') return;
    $('title').textContent = selected === 'currency' ? 'Currency converter.' : selected === 'planner' ? 'Your travel planner.' : 'Your everyday mini tools.';
    $('subtitle').textContent = selected === 'currency' ? 'Convert currencies and check the latest available reference rates.' : selected === 'planner' ? 'Notes, packing and tasks for a more organized trip.' : 'A little help with your money and your next journey. Choose a tool to get started.';
  }
  home.onclick = event => {
    const button = event.target.closest('button[data-tool]');
    if (!button || !['currency', 'planner'].includes(button.dataset.tool) || !pocketStorageKey) return;
    selected = button.dataset.tool; render();
    const heading = (selected === 'currency' ? converter : planner).querySelector('h3');
    heading.setAttribute('tabindex', '-1'); heading.focus({ preventScroll: true });
    if (selected === 'currency') view.dispatchEvent(new Event('pocket-open-converter'));
  };
  back.onclick = () => {
    const previous = selected; selected = null; render();
    $(previous === 'planner' ? 'tool-card-planner' : 'tool-card-currency').focus();
  };
  const originalRender = render; render = function () { originalRender(); draw(); };
  draw();
})();

// Load the iOS UPI helper after the account-backed workspace features are ready.
const pocketQrScript = document.createElement('script');
pocketQrScript.src = 'vendor/jsQR.js?v=1.4.0';
pocketQrScript.onload = () => {
  const pocketUpiScript = document.createElement('script');
  pocketUpiScript.src = 'upi-payment.js?v=20261018-2';
  document.body.append(pocketUpiScript);
};
document.body.append(pocketQrScript);
