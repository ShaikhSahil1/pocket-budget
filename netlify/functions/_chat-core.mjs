export const CHAT_MODEL = 'gemini-2.5-flash-lite';

export const PRODUCT_KNOWLEDGE = `
Monthly Pocket is a browser-based monthly budget app. It costs ₹499 once for lifetime access; there is no subscription. Payments are processed and rechecked through Razorpay.
Users sign in with Google. Their budget is kept in their browser and in a private Google Sheet named “Pocket Budget — My private data” that they own. Monthly Pocket does not keep a central database of budget records.
Quick start: sign in, set the month's new funds, add expenses, mark refunds pending until received, and review the available balance and daily allowance. Positive unused money carries forward automatically; negative balances do not.
Features include monthly expenses, categories, reimbursements, leave tracking, currency conversion, travel planning, CSV export, and full JSON backup/restore.
Privacy: Monthly Pocket does not sell financial data. Google handles sign-in and the private Sheet. Razorpay handles payment credentials. The assistant receives only the messages typed into chat; users should not enter financial records, passwords, payment credentials, API keys, or other sensitive information.
Recovery: restore a deleted Sheet from Google Drive Trash within 30 days. If permanently deleted, paid access can be restored with the original Razorpay pay_ ID, creating a new Sheet. Old budget data can return only from the original browser's local copy or a downloaded JSON backup.
Payment: UPI may be offered by Razorpay Checkout when available. Access is linked to the Google account used for payment. A captured, non-refunded ₹499 payment is required.
Google warning: the OAuth warning disappears only after the Google consent screen is configured for production and Google completes any required verification.
Helpful pages: /how-to-use for the complete guide, /privacy-policy for privacy, /data-policy for storage details, and /terms-of-service for terms.
`;

const fallbackItems = [
  { terms: ['price', 'cost', 'pay', 'payment', 'upi', 'lifetime', 'subscription'], answer: 'Monthly Pocket costs ₹499 once for lifetime access—there is no subscription. Razorpay Checkout may show UPI when it is available. Access is linked to the Google account used during payment.' },
  { terms: ['start', 'begin', 'use', 'expense', 'balance'], answer: 'Start in 3 moves: sign in with Google, set this month’s new funds, then add expenses as they happen. Monthly Pocket shows what remains and automatically carries forward a positive balance.' },
  { terms: ['privacy', 'data', 'store', 'safe', 'sheet'], answer: 'Your working budget stays in this browser and in a private Google Sheet you own. Monthly Pocket has no central budget-record database and does not sell your financial data.' },
  { terms: ['delete', 'deleted', 'recover', 'restore', 'backup'], answer: 'First restore “Pocket Budget — My private data” from Google Drive Trash. If it is gone forever, restore paid access with the original Razorpay payment ID, then recover records from the original browser or a JSON backup.' },
  { terms: ['refund', 'reimburse'], answer: 'Keep reimbursable spending marked as pending until the money actually returns. Then choose “Pending refund” to add it back to the balance once.' },
  { terms: ['leave', 'medical', 'casual', 'comp'], answer: 'The Leave tool tracks casual, medical, and comp-off allowances plus full or half days. Positive unused leave carries forward; negative leave does not.' },
  { terms: ['currency', 'convert', 'exchange'], answer: 'Use the Currency tool to convert using public daily rates. Currency requests do not include your Google identity or budget amounts.' },
  { terms: ['travel', 'plan', 'packing'], answer: 'The Travel Planner keeps trip notes, packing lists, tasks, and progress inside Monthly Pocket.' },
  { terms: ['login', 'sign in', 'google', 'warning', 'verified'], answer: 'Sign in with Google to connect your private Sheet and paid access. If Google shows an unverified-app warning, the OAuth consent screen still needs production verification.' },
];

export function cleanMessage(value, max = 800) {
  return String(value || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

export function cleanHistory(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(-6).map(item => ({
    role: item?.role === 'model' ? 'model' : 'user',
    parts: [{ text: cleanMessage(item?.text, 600) }],
  })).filter(item => item.parts[0].text);
}

export function fallbackAnswer(message) {
  const normalized = cleanMessage(message).toLowerCase();
  if (!normalized) return 'Ask me anything about Monthly Pocket.';
  if (/^(hi|hello|hey|namaste)\b/.test(normalized)) return 'Hello! I can help you start a budget, understand privacy, restore access, use refunds, or learn any Monthly Pocket feature.';
  const match = fallbackItems.reduce((best, item) => {
    const score = item.terms.filter(term => normalized.includes(term)).reduce((total, term) => total + term.length, 0);
    return score > best.score ? { item, score } : best;
  }, { item: null, score: 0 }).item;
  return match?.answer || 'I can help with Monthly Pocket features, payment, privacy, Google Sheets, backups, or recovery. For the full walkthrough, open the How to Use guide.';
}

export function systemPrompt() {
  return `You are Monthly Pocket Guide, the concise product-support assistant for Monthly Pocket. Answer only questions about Monthly Pocket using the verified knowledge below. Never invent features, policies, payment status, or user-specific data. Do not provide financial advice. If the answer is not in the knowledge, say you do not know and direct the user to /how-to-use. Never ask for or accept passwords, payment credentials, API keys, full financial records, or other sensitive data. Keep answers friendly, plain, and under 120 words.\n\nVERIFIED PRODUCT KNOWLEDGE:\n${PRODUCT_KNOWLEDGE}`;
}
