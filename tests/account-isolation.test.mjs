import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const fresh = n => ({ balances: { '2026-10': n }, expenses: [], currency: 'INR' });
const storageKey = (id, name) => `pocket-account:${id}:${name}`;
async function workspace(id, storage = new Map(), cloud = null) {
  const elements = new Map(), listeners = {}, writes = [], classes = new Set(), progressVisibility = [];
  const element = name => {
    if (!elements.has(name)) {
      const made = { hidden: false, value: '', style: {}, before() {}, close() {}, click() {}, setAttribute() {} };
      if (name === 'cloud-progress') {
        let hidden = false;
        Object.defineProperty(made, 'hidden', { get: () => hidden, set: value => { hidden = value; progressVisibility.push(value); } });
      }
      elements.set(name, made);
    }
    return elements.get(name);
  };
  let signedIn = id, refreshes = 0;
  const context = {
    console, URL, URLSearchParams, Blob, Date, JSON, Number, Object, Array, Set, Error,
    data: fresh(0), cats: [], validateLeaves() {}, render() {}, toast() {}, confirm: () => true,
    localDate: date => date.toISOString().slice(0, 10), $: element,
    setTimeout: () => 1, clearTimeout() {}, navigator: { onLine: true },
    location: { search: '', pathname: '/', assign() {} }, history: { replaceState() {} },
    localStorage: { getItem: key => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, value), removeItem: key => storage.delete(key) },
    document: {
      body: { classList: { add: key => classes.add(key), remove: key => classes.delete(key) } },
      createElement: () => element('created-' + elements.size), querySelector: element, querySelectorAll: () => [],
      addEventListener: (name, fn) => listeners[name] = fn,
    },
    window: { addEventListener: (name, fn) => listeners[name] = fn },
    fetch: async (url, options = {}) => {
      if (url === '/api/google-auth') {
        const action = JSON.parse(options.body).action;
        if (action === 'refresh') refreshes++;
        if (action === 'logout') { signedIn = null; return { ok: true, json: async () => ({ ok: true }) }; }
        return { ok: !!signedIn, status: signedIn ? 200 : 401, json: async () => signedIn ? ({ account: { id: signedIn, email: signedIn + '@example.com' }, access_token: 'token-' + signedIn, expires_in: 3600 }) : ({ error: 'Not connected.' }) };
      }
      if (url.startsWith('https://www.googleapis.com/drive/v3/files?')) {
        assert.ok(decodeURIComponent(url.replaceAll('+', ' ')).includes("'me' in owners"));
        assert.ok(decodeURIComponent(url.replaceAll('+', ' ')).includes("value='" + id + "'"));
        return { ok: true, json: async () => ({ files: [{ id: 'sheet-' + id }] }) };
      }
      assert.ok(url.startsWith('https://sheets.googleapis.com/v4/spreadsheets/sheet-' + id));
      if (options.method === 'PUT') { writes.push(JSON.parse(options.body)); return { ok: true, json: async () => ({}) }; }
      if (url.includes('/values/')) return { ok: true, json: async () => ({ values: cloud === null ? [] : [['pocket-account-backup-v1'], [id], [JSON.stringify(cloud)]] }) };
      return { ok: true, json: async () => ({ sheets: [{ properties: { title: 'PocketData' } }] }) };
    },
  };
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('account-storage.js', 'utf8'), context);
  vm.runInContext('function persist(){if(!pocketStorageKey)return false;localStorage.setItem(pocketStorageKey,JSON.stringify(data));return true}', context);
  vm.runInContext(fs.readFileSync('currency-support.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('backup-validation.js', 'utf8'), context);
  vm.runInContext(fs.readFileSync('google-account-sync.js', 'utf8'), context);
  for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve));
  return { context, element, storage, listeners, writes, classes, progressVisibility, refreshes: () => refreshes, switchAccount: next => signedIn = next };
}

test('Google Sheet reads show and then clear the loading bar', async () => {
  const app = await workspace('A', new Map(), fresh(250));
  assert.ok(app.progressVisibility.includes(false));
  assert.equal(app.progressVisibility.at(-1), true);
});

test('shared-browser legacy data is never assigned to a signed-in account', async () => {
  const storage = new Map([['pocket-v1', JSON.stringify(fresh(900))]]);
  const app = await workspace('A', storage);
  assert.equal(app.context.data.balances['2026-10'], undefined);
  assert.equal(storage.get('pocket-v1'), JSON.stringify(fresh(900)));
  assert.equal(app.element('legacy-import').hidden, false);
  assert.equal(app.classes.has('account-locked'), false);
});

test('accounts load separate data and write only to their own sheet', async () => {
  const storage = new Map([[storageKey('A', 'data'), JSON.stringify(fresh(100))], [storageKey('B', 'data'), JSON.stringify(fresh(200))]]);
  const a = await workspace('A', storage);
  assert.equal(a.context.data.balances['2026-10'], 100);
  a.context.data.balances['2026-10'] = 150; assert.equal(a.context.persist(), true);
  await a.element('cloud-save').onclick();
  assert.equal(a.writes[0].values[1][0], 'A');
  assert.equal(JSON.parse(storage.get(storageKey('B', 'data'))).balances['2026-10'], 200);
  const b = await workspace('B', storage, fresh(250));
  assert.equal(b.context.data.balances['2026-10'], 250);
  assert.equal(JSON.parse(storage.get(storageKey('A', 'data'))).balances['2026-10'], 150);
});

test('logout clears the screen and locks edits while preserving account copies', async () => {
  const storage = new Map([[storageKey('A', 'data'), JSON.stringify(fresh(100))]]);
  const app = await workspace('A', storage);
  await app.element('cloud-disconnect').onclick();
  assert.equal(Object.keys(app.context.data.balances).length, 0);
  assert.equal(app.context.persist(), false);
  assert.equal(app.classes.has('account-locked'), true);
  assert.equal(JSON.parse(storage.get(storageKey('A', 'data'))).balances['2026-10'], 100);
});

test('stale tabs refuse cloud writes when the server account changes', async () => {
  const app = await workspace('A');
  app.switchAccount('B'); await app.element('cloud-save').onclick();
  assert.equal(app.writes.length, 0);
  assert.equal(app.classes.has('account-locked'), true);
  assert.equal(app.context.persist(), false);
});

test('cross-tab account changes immediately hide the previous account', async () => {
  const app = await workspace('A', new Map([[storageKey('A', 'data'), JSON.stringify(fresh(100))]]));
  app.listeners.storage({ key: 'pocket-active-google-account', newValue: 'B' });
  assert.equal(Object.keys(app.context.data.balances).length, 0);
  assert.equal(app.context.persist(), false);
});

test('signed-out visitors cannot load saved account data', async () => {
  const app = await workspace(null, new Map([[storageKey('A', 'data'), JSON.stringify(fresh(100))]]));
  assert.equal(Object.keys(app.context.data.balances).length, 0);
  assert.equal(app.classes.has('account-locked'), true);
  assert.equal(app.context.persist(), false);
});

test('one Google save checks the signed-in account once, not before every Sheets request', async () => {
  const app = await workspace('A', new Map([[storageKey('A', 'data'), JSON.stringify(fresh(100))]]));
  const before = app.refreshes();
  app.context.data.balances['2026-10'] = 120; app.context.persist();
  await app.element('cloud-save').onclick();
  assert.equal(app.writes.length, 1);
  assert.equal(app.refreshes() - before, 1);
});
