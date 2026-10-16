// Start empty on every page load; a server-verified Google identity selects storage.
let pocketStorageKey = null;
const emptyPocketData = () => ({ balances: {}, expenses: [], currency: 'INR' });
const pocketAccountKey = (id, name) => 'pocket-account:' + encodeURIComponent(id) + ':' + name;
document.body.classList.add('account-locked');
