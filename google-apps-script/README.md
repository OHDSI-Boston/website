# Signup endpoint (Google Apps Script)

Not part of the website. `Code.gs` runs on Google and appends each signup to a Google Sheet.

```
browser ──POST form fields──▶ Apps Script /exec ──▶ Google Sheet
```

Columns: `timestamp, name, email, institution, hasData`. The header row is added on first write.

## Setup

1. Open the Sheet → **Extensions → Apps Script**. Replace the editor's `Code.gs` with this `Code.gs`. Save.
2. Select `testWrite` in the function dropdown → **Run** → allow the permissions. A `setup test` row should appear in the first tab. Delete it.
3. **Deploy → Manage deployments → Edit (pencil) → Version: New version → Deploy.** This keeps the existing `/exec` URL. (First time: **New deployment → Web app**, Execute as **Me**, Who has access **Anyone**, then put the URL in `docs/js/config.js`.)
4. Open the `/exec` URL in a browser. Expect `{"ok":true,"service":"ohdsi-boston-signup"}`.
5. Submit the live form and check the Sheet.

Every code change needs step 3. Apps Script serves the last deployed version, not the last saved one.

## Debugging

The site uses `no-cors`, so the page always shows success. To see the real reply:

```sh
curl -sL -F name=test -F email=test@example.org -F institution= -F hasData= -F website= "<exec URL>"
```

`{"ok":false,"error":"Unable to save signup."}` means an exception; the stack trace is under **Executions** in the Apps Script editor.

## Limits

The endpoint is public. The honeypot, validation and 30 writes/minute cap stop naive bots, not a determined abuser. Never put a secret in `config.js`.
