import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const context = vm.createContext({ AbortController, setTimeout, clearTimeout });
vm.runInContext(fs.readFileSync('exchange-rates.js', 'utf8'), context);
const response = () => ({ ok: true, json: async () => ({ result: 'success', base_code: 'USD', time_last_update_unix: 1792108800, rates: { USD: 1, INR: 80, EUR: 0.9, BAD: -1 } }) });
test('cross-rates convert both directions, identical currencies and zero', () => {
  const rates = { USD: 1, INR: 80, EUR: 0.9 };
  assert.equal(context.convertPocketAmount(800, 'INR', 'USD', rates).amount, 10);
  assert.equal(context.convertPocketAmount(10, 'USD', 'INR', rates).amount, 800);
  assert.equal(context.convertPocketAmount(10, 'INR', 'INR', rates).amount, 10);
  assert.equal(context.convertPocketAmount(0, 'INR', 'EUR', rates).amount, 0);
});
test('rejects invalid amounts, invalid rates and unsupported pairs', () => {
  const rates = { USD: 1, INR: 80, EUR: 0 };
  for (const amount of [-1, Infinity, NaN, 1e13]) assert.throws(() => context.convertPocketAmount(amount, 'USD', 'INR', rates));
  assert.throws(() => context.convertPocketAmount(1, 'USD', 'ZZZ', rates));
  assert.throws(() => context.convertPocketAmount(1, 'USD', 'EUR', rates));
});
test('caches rates, respects refresh cooldown and sends no account or amount', async () => {
  let calls = 0, now = 1;
  const load = context.createPocketRateClient(async (url, options) => {
    calls++; assert.equal(url, 'https://open.er-api.com/v6/latest/USD'); assert.equal(options.credentials, 'omit'); assert.equal(options.body, undefined); return response();
  }, () => now);
  const first = await load(); assert.equal(first.rates.BAD, undefined);
  assert.equal((await load()).cached, true); assert.equal((await load(true)).cached, true); assert.equal(calls, 1);
  now += 61000; await load(true); assert.equal(calls, 2);
});
test('offline failure keeps previous rates marked stale; initial failure is visible', async () => {
  let now = 1, failed = false;
  const load = context.createPocketRateClient(async () => { if (failed) throw Error('Offline'); return response(); }, () => now);
  await load(); failed = true; now += 3600001; assert.equal((await load()).stale, true);
  await assert.rejects(context.createPocketRateClient(async () => { throw Error('Offline'); })(), /Offline/);
});
test('rejects malformed provider responses', async () => {
  await assert.rejects(context.createPocketRateClient(async () => ({ ok: true, json: async () => ({ result: 'success', rates: {} }) }))(), /invalid data/);
});
