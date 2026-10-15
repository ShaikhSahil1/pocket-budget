# Pocket Budget

A browser-based monthly budget tracker with optional Google Sheets backup.

## Persistent Google Sheets connection

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
