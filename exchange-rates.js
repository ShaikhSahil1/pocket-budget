function convertPocketAmount(amount, from, to, rates) {
  if (!Number.isFinite(amount) || amount < 0 || amount > 1e12) throw Error('Enter an amount between 0 and 1 trillion.');
  if (!Object.hasOwn(rates, from) || !Object.hasOwn(rates, to) || !Number.isFinite(rates[from]) || rates[from] <= 0 || !Number.isFinite(rates[to]) || rates[to] <= 0) throw Error('This currency pair is not available from the rate provider.');
  const rate = rates[to] / rates[from];
  return { rate, amount: amount * rate };
}
function createPocketRateClient(fetcher = fetch, clock = Date.now) {
  let cached, fetchedAt = 0, pending;
  return async function load(force = false) {
    if (cached && clock() - fetchedAt < (force ? 60000 : 3600000)) return { ...cached, cached: true };
    if (pending) return pending;
    pending = (async () => {
      const controller = new AbortController(), timer = setTimeout(() => controller.abort(), 12000);
      try {
        const response = await fetcher('https://open.er-api.com/v6/latest/USD', { signal: controller.signal, credentials: 'omit', referrerPolicy: 'no-referrer' });
        if (!response.ok) throw Error(response.status === 429 ? 'Rate provider is busy. Please try again later.' : 'Unable to fetch exchange rates.');
        const body = await response.json();
        if (body.result !== 'success' || body.base_code !== 'USD' || !body.rates || body.rates.USD !== 1 || !Number.isFinite(body.time_last_update_unix) || body.time_last_update_unix <= 0) throw Error('The rate provider returned invalid data.');
        const rates = Object.fromEntries(Object.entries(body.rates).filter(([code, rate]) => /^[A-Z]{3}$/.test(code) && Number.isFinite(rate) && rate > 0));
        if (!rates.INR) throw Error('INR rates are currently unavailable.');
        cached = { rates, updated: body.time_last_update_unix * 1000, checked: clock() }; fetchedAt = clock();
        return { ...cached, cached: false };
      } catch (error) {
        if (cached) return { ...cached, cached: true, stale: true };
        throw Error(error.name === 'AbortError' ? 'Rate request timed out. Please refresh to retry.' : error.message);
      } finally { clearTimeout(timer); pending = undefined; }
    })();
    return pending;
  };
}
