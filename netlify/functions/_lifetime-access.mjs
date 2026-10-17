import { createHmac, timingSafeEqual } from 'node:crypto';

const lifetimeAmount = 49900;
const lifetimeCurrency = 'INR';
const licenseSheet = 'PocketLicense';

function paymentSettings() {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId && !keySecret) return null;
  if (!keyId || !keySecret) throw new Error('Razorpay server settings are incomplete.');
  return { keyId, keySecret };
}

async function responseJson(response, fallback) {
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.error?.description || body.error || fallback);
  return body;
}

async function google(accessToken, url, options = {}) {
  return responseJson(await fetch(url, {
    ...options,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${accessToken}`, ...(options.headers || {}) },
  }), 'Google data request failed.');
}

async function razorpay(path, settings, options = {}) {
  return responseJson(await fetch(`https://api.razorpay.com/v1${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${Buffer.from(`${settings.keyId}:${settings.keySecret}`).toString('base64')}`,
      ...(options.headers || {}),
    },
  }), 'Razorpay request failed.');
}

function accountHash(accountId, secret) {
  return createHmac('sha256', secret).update(`monthly-pocket:${accountId}`).digest('hex').slice(0, 32);
}

function signLicense(payload, secret) {
  const encoded = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = createHmac('sha256', secret).update(encoded).digest('base64url');
  return `${encoded}.${signature}`;
}

function readLicense(token, accountId, secret) {
  try {
    const [encoded, signature, extra] = String(token || '').split('.');
    if (!encoded || !signature || extra) return null;
    const expected = createHmac('sha256', secret).update(encoded).digest();
    const supplied = Buffer.from(signature, 'base64url');
    if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8'));
    if (payload.v !== 1 || payload.account !== accountId || payload.amount !== lifetimeAmount || payload.currency !== lifetimeCurrency || !payload.paymentId) return null;
    return payload;
  } catch { return null; }
}

async function privateSheet(accessToken, accountId, create = false) {
  const query = `trashed = false and 'me' in owners and mimeType = 'application/vnd.google-apps.spreadsheet' and appProperties has { key='pocketAccount' and value='${accountId}' }`;
  const result = await google(accessToken, 'https://www.googleapis.com/drive/v3/files?' + new URLSearchParams({ q: query, fields: 'files(id)', orderBy: 'createdTime', pageSize: '100' }));
  if (result.files?.length) return result.files[0].id;
  if (!create) return '';
  const made = await google(accessToken, 'https://www.googleapis.com/drive/v3/files?fields=id', {
    method: 'POST',
    body: JSON.stringify({ name: 'Pocket Budget — My private data', mimeType: 'application/vnd.google-apps.spreadsheet', appProperties: { pocketAccount: accountId } }),
  });
  return made.id;
}

async function sheetTitles(accessToken, sheetId) {
  const meta = await google(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}?fields=sheets.properties.title`);
  return meta.sheets?.map(item => item.properties.title) || [];
}

async function storedLicense(accessToken, accountId) {
  const sheetId = await privateSheet(accessToken, accountId);
  if (!sheetId || !(await sheetTitles(accessToken, sheetId)).includes(licenseSheet)) return '';
  const values = await google(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`'${licenseSheet}'!A1`)}?valueRenderOption=UNFORMATTED_VALUE`);
  return values.values?.[0]?.[0] || '';
}

async function saveLicense(accessToken, accountId, token) {
  const sheetId = await privateSheet(accessToken, accountId, true);
  if (!(await sheetTitles(accessToken, sheetId)).includes(licenseSheet)) {
    await google(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}:batchUpdate`, {
      method: 'POST', body: JSON.stringify({ requests: [{ addSheet: { properties: { title: licenseSheet, hidden: true } } }] }),
    });
  }
  await google(accessToken, `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`'${licenseSheet}'!A1`)}?valueInputOption=RAW`, {
    method: 'PUT', body: JSON.stringify({ values: [[token]] }),
  });
}

export async function getLifetimeStatus({ accessToken, accountId, cookieSecret }) {
  const settings = paymentSettings();
  if (!settings) return { enabled: false, entitled: true, amount: lifetimeAmount, currency: lifetimeCurrency };
  const license = readLicense(await storedLicense(accessToken, accountId), accountId, cookieSecret);
  return { enabled: true, entitled: !!license, amount: lifetimeAmount, currency: lifetimeCurrency };
}

export async function createLifetimeOrder({ accessToken, account, cookieSecret }) {
  const settings = paymentSettings();
  if (!settings) throw new Error('Razorpay payments are not configured yet.');
  const current = await getLifetimeStatus({ accessToken, accountId: account.id, cookieSecret });
  if (current.entitled) return { ...current, alreadyPaid: true };
  const order = await razorpay('/orders', settings, {
    method: 'POST',
    body: JSON.stringify({
      amount: lifetimeAmount,
      currency: lifetimeCurrency,
      receipt: `mp_${accountHash(account.id, cookieSecret).slice(0, 12)}_${Date.now().toString(36)}`,
      notes: { product: 'monthly-pocket-lifetime', account_hash: accountHash(account.id, cookieSecret) },
    }),
  });
  if (!order.id || order.amount !== lifetimeAmount || order.currency !== lifetimeCurrency) throw new Error('Razorpay returned an invalid order.');
  return { enabled: true, entitled: false, keyId: settings.keyId, orderId: order.id, amount: lifetimeAmount, currency: lifetimeCurrency, email: account.email };
}

export async function verifyLifetimePayment({ accessToken, account, cookieSecret, payment }) {
  const settings = paymentSettings();
  if (!settings) throw new Error('Razorpay payments are not configured yet.');
  const orderId = String(payment.orderId || '');
  const paymentId = String(payment.paymentId || '');
  const signature = String(payment.signature || '');
  if (!/^order_[A-Za-z0-9]+$/.test(orderId) || !/^pay_[A-Za-z0-9]+$/.test(paymentId) || !/^[a-f0-9]{64}$/i.test(signature)) throw new Error('Invalid payment confirmation.');
  const expected = createHmac('sha256', settings.keySecret).update(`${orderId}|${paymentId}`).digest();
  const supplied = Buffer.from(signature, 'hex');
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new Error('Payment signature verification failed.');
  const [order, paid] = await Promise.all([
    razorpay(`/orders/${encodeURIComponent(orderId)}`, settings),
    razorpay(`/payments/${encodeURIComponent(paymentId)}`, settings),
  ]);
  const validOrder = order.id === orderId && order.status === 'paid' && order.amount === lifetimeAmount && order.amount_paid === lifetimeAmount && order.currency === lifetimeCurrency && order.notes?.product === 'monthly-pocket-lifetime' && order.notes?.account_hash === accountHash(account.id, cookieSecret);
  const validPayment = paid.id === paymentId && paid.order_id === orderId && paid.status === 'captured' && paid.captured === true && paid.amount === lifetimeAmount && paid.currency === lifetimeCurrency && Number(paid.amount_refunded || 0) === 0;
  if (!validOrder || !validPayment) throw new Error('Payment is not captured for the correct product and amount.');
  const payload = { v: 1, account: account.id, paymentId, orderId, amount: lifetimeAmount, currency: lifetimeCurrency, paidAt: new Date().toISOString() };
  await saveLicense(accessToken, account.id, signLicense(payload, cookieSecret));
  return { enabled: true, entitled: true, amount: lifetimeAmount, currency: lifetimeCurrency };
}

export async function restoreLifetimePayment({ accessToken, account, cookieSecret, paymentId: suppliedPaymentId }) {
  const settings = paymentSettings();
  if (!settings) throw new Error('Razorpay payments are not configured yet.');
  const paymentId = String(suppliedPaymentId || '').trim();
  if (!/^pay_[A-Za-z0-9]+$/.test(paymentId)) throw new Error('Enter a valid Razorpay payment ID.');
  const paid = await razorpay(`/payments/${encodeURIComponent(paymentId)}`, settings);
  if (!/^order_[A-Za-z0-9]+$/.test(String(paid.order_id || ''))) throw new Error('This payment is not linked to a Monthly Pocket order.');
  const order = await razorpay(`/orders/${encodeURIComponent(paid.order_id)}`, settings);
  const validOrder = order.id === paid.order_id && order.status === 'paid' && order.amount === lifetimeAmount && order.amount_paid === lifetimeAmount && order.currency === lifetimeCurrency && order.notes?.product === 'monthly-pocket-lifetime' && order.notes?.account_hash === accountHash(account.id, cookieSecret);
  const validPayment = paid.id === paymentId && paid.status === 'captured' && paid.captured === true && paid.amount === lifetimeAmount && paid.currency === lifetimeCurrency && Number(paid.amount_refunded || 0) === 0;
  if (!validOrder || !validPayment) throw new Error('No eligible ₹499 payment was found for this Google account.');
  const payload = { v: 1, account: account.id, paymentId, orderId: paid.order_id, amount: lifetimeAmount, currency: lifetimeCurrency, paidAt: new Date((paid.created_at || Date.now() / 1000) * 1000).toISOString() };
  await saveLicense(accessToken, account.id, signLicense(payload, cookieSecret));
  return { enabled: true, entitled: true, amount: lifetimeAmount, currency: lifetimeCurrency };
}

export const lifetimePlan = { amount: lifetimeAmount, currency: lifetimeCurrency };
