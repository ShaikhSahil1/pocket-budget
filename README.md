# Pocket Budget

A browser-based monthly budget and leave tracker with separate Google account workspaces and private Google Sheets backups.

## Leave tracking

Open **Leaves** and choose a month, then **Set monthly allowances** to set casual, medical, and comp-off days (including half days). Allowances repeat from that month until the next configured change. Unused days reset monthly and do not carry over. Add a leave for each date taken, choose its type (including comp-off), and enter details or a reason; records can be edited or deleted, and taking more than the allowance displays a negative balance.

Leaves save immediately with budget data in browser storage and use the same optional Google Sheets auto-sync and full JSON backup/restore. Older backups without leaves still load; restoring one replaces all local data, including leaves. Monthly budget CSV exports contain expenses only.

## Persistent Google Sheets connection

Sign in with Google before viewing or editing data. The server obtains the stable Google account ID from Google's UserInfo endpoint; local data, dirty flags and sync baselines use keys under `pocket-account:<id>:`. Signing out clears the displayed data and closes open forms. Other tabs lock when the active account changes, and each cloud request verifies the cookie's account before sending data. Browser storage is not encrypted; anyone with access to the browser profile or developer tools can inspect its saved local copies. Use separate OS/browser profiles for untrusted shared devices.

The app finds an owned spreadsheet tagged for this Google account through Drive `appProperties`, or creates a new private spreadsheet. It requests `openid email` and `drive.file`, limiting file access to app-created/opened files. It does not share sheets or use a common spreadsheet. Data is written to a `PocketData` tab with an account marker, and is rediscovered on other devices after sign-in. Do not manually share or change the app property on this sheet.

Existing users must reconnect to grant the new identity and Drive permissions. Previous `pocket-v1` shared-browser data is preserved but never automatically assigned to a user. After signing in, use **Import previous device data** only if it belongs to that account, or restore a full JSON backup. Previous manually selected Google Sheets remain unchanged; download their full backup using the previous app version or export the JSON from their `PocketData` column and restore it here.

Enable **Google Drive API** and **Google Sheets API** in the OAuth client's Google Cloud project. In Google Auth Platform, configure the app's Audience as **External**, complete the consent screen, and publish to **Production** to allow accounts beyond test users. Google verification or Workspace administrator approval may still be required by Google. While in Testing, only configured test users can authorize the app. Never promise public login until this configuration and a second-account sign-in have been verified.

The production site uses a Netlify Function and an encrypted, HTTP-only cookie so a Google Sheets connection can be restored after the tab or browser is closed.

Configure these environment variables in Netlify with Functions scope:

- `GOOGLE_CLIENT_ID` — the Google OAuth Web application client ID.
- `GOOGLE_CLIENT_SECRET` — the matching OAuth client secret. Never commit it.
- `COOKIE_SECRET` — a private random value of at least 32 characters. Never commit it.

Add this exact URI to the OAuth client's **Authorized redirect URIs**:

```text
https://pocketmonthlybudget.netlify.app/api/google-auth
```

The OAuth client also needs this **Authorized JavaScript origin**:

```text
https://pocketmonthlybudget.netlify.app
```

After changing Netlify environment variables, trigger a new production deploy.

When connected, changes are saved to browser storage immediately and automatically uploaded to Google Sheets after a short debounce. Pending offline changes remain marked locally and are uploaded after the Google session is restored, unless the cloud copy changed on another device; that conflict requires an explicit Load or Save choice.
