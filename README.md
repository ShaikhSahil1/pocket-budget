# Monthly Pocket

A browser-based monthly budget and leave tracker with separate Google account workspaces and private Google Sheets backups.

## Public pages

`index.html` is the public homepage, with privacy-first product messaging and a link to the budgeting workspace at `app.html`. `privacy-policy.html` explains the service's privacy practices, `terms-of-service.html` states the service terms, and `data-policy.html` maps where each class of data is processed and how users can remove it. Claims distinguish between the browser-local working copy, the user's private Google Sheet, the encrypted session cookie, and the absence of a separate Monthly Pocket budget database.

## Leave tracking

Open **Leaves** and choose a month, then **Set monthly allowances**. Casual leave is added automatically every month (1.5 days by default, adjustable) or, if you choose manual mode, entered month by month. Festival, medical and comp-off credits are always entered manually for the month in which they are received. All amounts accept half days, and positive unused days of every type carry forward monthly. Add a leave with its date, type (casual, festival, medical or comp-off), number of days (any half-day step, so multi-day leave is one entry) and details such as the festival name; records can be edited or deleted, and taking more than the allowance displays a negative balance.

Leaves save immediately with budget data in browser storage and use the same optional Google Sheets auto-sync and full JSON backup/restore. Older backups without leaves still load; restoring one replaces all local data, including leaves. Monthly budget CSV exports contain expenses only.

## Persistent Google Sheets connection

Sign in with Google before viewing or editing data. The server obtains the stable Google account ID from Google's UserInfo endpoint; local data, dirty flags and sync baselines use keys under `pocket-account:<id>:`. Signing out clears the displayed data and closes open forms. Other tabs lock when the active account changes, and each cloud request verifies the cookie's account before sending data. Browser storage is not encrypted; anyone with access to the browser profile or developer tools can inspect its saved local copies. Use separate OS/browser profiles for untrusted shared devices.

The app finds an owned spreadsheet tagged for this Google account through Drive `appProperties`, or creates a new private spreadsheet. It requests `openid email` and `drive.file`, limiting file access to app-created/opened files. It does not share sheets or use a common spreadsheet. Data is written to a `PocketData` tab with an account marker, and is rediscovered on other devices after sign-in. Do not manually share or change the app property on this sheet.

Existing users must reconnect to grant the new identity and Drive permissions. Previous `pocket-v1` shared-browser data is preserved but never automatically assigned to a user. After signing in, use **Import previous device data** only if it belongs to that account, or restore a full JSON backup. Previous manually selected Google Sheets remain unchanged; download their full backup using the previous app version or export the JSON from their `PocketData` column and restore it here.

Enable **Google Drive API** and **Google Sheets API** in the OAuth client's Google Cloud project. In Google Auth Platform, configure the app's Audience as **External**, complete the consent screen, and publish to **Production** to allow accounts beyond test users. Google verification or Workspace administrator approval may still be required by Google. While in Testing, only configured test users can authorize the app. Never promise public login until this configuration and a second-account sign-in have been verified.

The production site uses a Netlify Function and an encrypted, HTTP-only cookie so a Google Sheets connection can be restored after the tab or browser is closed.

## ₹499 lifetime access

When Razorpay is configured, a signed-in account must complete one server-created ₹499 INR order before the workspace unlocks. The server verifies the Razorpay checkout signature, fetches the order and payment directly from Razorpay, and checks that the order is paid, the payment is captured, the amount and currency match, no refund has been recorded, and the order belongs to the current Google account. A signed entitlement is then written to the hidden `PocketLicense` tab in that account's private Google Sheet. Users can restore access with their Razorpay payment ID; the server accepts it only when Razorpay confirms the same account-bound order.

To keep saving fast, the server remembers a verified purchase for 6 hours in a separate encrypted, HTTP-only `__Host-pocket_entitlement` cookie that is bound to the Google account and the Razorpay Key ID. While it is valid, session refreshes skip the Drive, Sheets and Razorpay licence checks; after it expires the full Razorpay check runs again, so a refund locks access within about 6 hours. Logging out clears it, and changing `RAZORPAY_KEY_ID` (for example from test to live keys) invalidates every cached entitlement. The browser checks the signed-in account once per Google sync operation (a save, a load or a restore), not before every Sheets request.

Payment enforcement activates only when both Razorpay keys are configured. If neither is present, existing users remain unlocked so an incomplete deployment cannot accidentally lock everyone out. Use Razorpay test keys first, complete a test transaction, enable automatic capture in Razorpay, then replace them with live keys when ready.

Configure these environment variables in Netlify with Functions scope:

- `GOOGLE_CLIENT_ID` — the Google OAuth Web application client ID.
- `GOOGLE_CLIENT_SECRET` — the matching OAuth client secret. Never commit it.
- `COOKIE_SECRET` — a private random value of at least 32 characters. Never commit it.
- `RAZORPAY_KEY_ID` — the Razorpay test or live Key ID.
- `RAZORPAY_KEY_SECRET` — the matching Razorpay secret. Never commit it or expose it to browser code.

Add this exact URI to the OAuth client's **Authorized redirect URIs**:

```text
https://pocketmonthlybudget.netlify.app/api/google-auth
```

The OAuth client also needs this **Authorized JavaScript origin**:

```text
https://pocketmonthlybudget.netlify.app
```

After Google authorization, the server returns the user to `/app.html`.

After changing Netlify environment variables, trigger a new production deploy.

When connected, changes are saved to browser storage immediately and automatically uploaded to Google Sheets after a short debounce. Pending offline changes remain marked locally and are uploaded after the Google session is restored, unless the cloud copy changed on another device; that conflict requires an explicit Load or Save choice.

## Clear a month

Choose a month and use **Clear month…**. Choose expenses plus starting balance, leave records, or both. The dialog shows the month and record counts, offers a full backup download, and requires typing the exact YYYY-MM before deletion. Other months and recurring leave allowances are preserved. Account, month, and data changes invalidate an open confirmation. Successful deletion uses the existing account-local save and Google sync; failed local saves restore the previous in-memory data.

## Automatic carry-forward

Positive available money and unused casual, medical and comp-off days carry into every following month, including skipped months and year boundaries. New monthly funds and the recurring casual allowance are added to the carried amount. Medical and comp-off credits apply only in months where you manually enter them, while their unused balances carry forward. Negative balances are displayed in their original month but do not carry forward. Editing, deleting or restoring past records recalculates future totals; no carry entries are duplicated in storage. Use **Set / add funds** to either set this month’s new funds (replacing the amount entered earlier) or add an extra amount, such as a bonus, on top of it. Enter only new funds, excluding the carry-forward shown on the dashboard. Scheduled EMI payments are deducted from the month’s available balance. CSV exports include new funds, carry-forward and the combined starting balance.

## EMI due dates and reminders

Each EMI plan stores its first and last payment month, monthly amount, due day (1–31), notes and schedule mode. When a month is shorter than the selected due day, the payment is due on that month’s last day. Users can enable a browser notification containing the EMI name, amount and notes; it appears once on the due date when Monthly Pocket is open or becomes visible. A payment already marked paid for that month does not notify. Browser permission is requested only when the user saves an EMI with reminders enabled, and old EMI records remain compatible with reminders off.

Open **EMI** to see what is due, paid and remaining for the selected month, filter plans (due this month, upcoming, completed) and open a plan for its details. Automatic plans appear every month in their date range; manual plans appear only in the months you add. Scheduled EMIs are also listed with that month’s expenses and summarized on the Overview page.

## Returning visitors and the user profile

After Google sign-in the server also sets `__Host-pocket_signed_in=1`, a readable cookie that contains no token or account data. When it is present, opening the homepage goes straight to the dashboard (`index.html?home`, used by the dashboard logo, keeps the homepage open), and the dashboard shows “Opening your dashboard…” instead of a sign-in prompt while the session is checked. Access is still decided by the encrypted HttpOnly session cookie; the hint is cleared on logout or when the session is no longer valid, and older sessions receive it on their next refresh.

The user profile never opens by itself. Click the user profile in the sidebar (below navigation on mobile) to open Google account, sync, backup/restore and logout controls. Close the panel with its close button, Escape, or the backdrop. If lifetime access is required, the main page shows **Pay ₹499 securely** and an **Already paid? Restore access** link, which opens the profile at the restore form.

## Currency preferences

New accounts default to INR. The currency menu lists currencies supported by the browser’s Intl runtime, with an ISO currency fallback for older browsers. A currency change asks whether to save permanently to the signed-in account, use temporarily until reload, or cancel. Temporary choices are not included in stored data or cloud backups. Currency changes format amounts without exchange-rate conversion.

## Help chat

Every public page and the workspace include a Monthly Pocket help chat. It answers product questions using Gemini when `GEMINI_API_KEY` is set (optionally `GEMINI_MODEL`; default `gemini-3.5-flash-lite`), and falls back to built-in answers when the key is missing or Gemini fails. Only the typed question and the last few chat turns are sent; never enter financial records or credentials. Netlify enforces a shared limit of 8 questions per visitor IP every 3 minutes across all function instances (`config.rateLimit` in `monthly-pocket-chat.mjs`), with a smaller in-memory limiter as backup; limited visitors see a “please wait” message.

## Mini tools

Mini tools follows Leaves in navigation. Its currency converter fetches the keyless ExchangeRate-API open-access USD rate table only when opened, calculates cross-rates as you type, and supports currency swapping and manual refresh. Rates update daily at the provider; the UI shows their timestamp and labels stale/cached data. No budget amounts, identity or saved currency are sent to the provider. Rates are cached in memory for an hour, with a one-minute refresh cooldown; amounts and rate preferences do not modify the budget. Attribution is displayed as required by https://www.exchangerate-api.com/docs/free.

## Travel planner notes

Mini tools includes named travel plans, free-form notes, and separate packing and task checklists. Add, edit, delete and complete checklist items; progress is shown per checklist. Plans use the same account-local data, Google Sheet auto-sync, full backup and restore as budgets and leaves. Old backups without travelPlans remain valid. Clearing a budget month does not delete travel plans. Each account has separate plans.

Mini tools opens with two themed cards: Currency converter and Travel planner. Select a card to open only that tool, and use All mini tools to return. Currency rates load only after opening the converter. Returning from another navigation tab or changing accounts resets the tool selection to the cards.

## Pay & Add Expense (UPI)

Open **Pay & Add Expense** on a phone. The quickest way is **Open my UPI app**: tap Google Pay, PhonePe, Paytm, CRED or BHIM and the app opens with nothing filled in, so you scan or pay inside it as usual. When you come back, Monthly Pocket asks whether you paid and lets you enter the amount and what it was for. A website cannot open Android’s list of all UPI apps without a payee, so this option always opens one specific app; if it does not open, choose another.

To pre-fill the payment instead, open **Or fill in the payment first (UPI ID or QR)**, enter or scan the details, then choose how to pay:

- **Android:** **Choose from my UPI apps** opens the standard `upi://pay` link, and Android shows every installed UPI app (unless a default UPI app is set). Specific app buttons open that app directly through an intent link; if it is not installed, Chrome returns to Monthly Pocket and asks you to pick another app.
- **iPhone/iPad:** iOS cannot list installed apps, so pick Google Pay, PhonePe, Paytm, CRED, BHIM or **Other UPI app**. If the app does not open within a few seconds, a waiting panel lets you choose another app or review the payment.

The last app you used is shown first. When you return, Monthly Pocket asks whether you completed the payment: **Yes, add expense** (amount and details can be corrected) or **I didn't pay · Don't add**. Expenses are marked user-confirmed and not bank-verified. Desktop browsers can fill the form but cannot launch UPI apps. App URL schemes are defined by each app and should be re-tested on real devices after app updates. Many UPI apps limit link or QR payments to personal UPI IDs; merchant QR codes work most reliably.

## Development notes

- **Script order:** `app.html` lists every feature script in one fixed order. Scripts extend each other by wrapping the shared `render()`, `monthly()` and `persist()` functions, so a script listed later wraps the ones before it. Add new features as a `<script>` tag in `app.html`; do not inject local scripts with `document.createElement('script')` (`tests/load-order.test.mjs` enforces this). Only third-party scripts loaded on demand, such as Razorpay Checkout, are injected at runtime.
- **Shared definitions:** expense categories live only in `categories.js`; full-backup and EMI validation live only in `backup-validation.js`.
- **Tests:** run `node --test tests/*.test.mjs`.
- **Environment:** besides the Google and Razorpay variables above, the chat uses `GEMINI_API_KEY` and optional `GEMINI_MODEL`.

## First-login app tour

The first time an account opens its dashboard on a browser, a guided tour highlights each tab and button one at a time: month picker, Set / add funds, balance cards, Add expense, Pay & Add Expense, spending chart, expense list, currency, Export CSV, Clear month, each category tab, Leaves (allowances and Add leave), Mini tools, EMI (Add EMI), the user profile and the help chat. Use **Next**/**Back** or the arrow keys; **Skip tour** or Escape ends it. Finishing or skipping is remembered per account in this browser (`pocket-account:<id>:data:tour-done`). Replay it any time from **User profile → Take the app tour**. Steps whose element is hidden on the current screen are skipped automatically.
