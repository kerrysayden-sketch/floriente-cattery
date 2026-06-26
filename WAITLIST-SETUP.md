# Waitlist — Operator Setup Checklist

External setup the **operator** performs before the waitlist backend is production-ready.
None of this lives in the repo (no secrets committed). Work top to bottom; each
section says where the value goes.

The code degrades gracefully: with **no** secrets configured the form still
returns success but only validates + anti-spams (no email, no Sheet). Each
capability switches on as you provide its credentials.

---

## 0. Where values go

| Place | What | Notes |
|---|---|---|
| `.dev.vars` (local, gitignored) | runtime function secrets | copy from `.dev.vars.example`; for `wrangler pages dev` |
| Cloudflare Pages → Settings → Environment variables | runtime secrets **+** `PUBLIC_TURNSTILE_SITE_KEY` | set for **Production** and **Preview** separately |
| Cloudflare Pages → build env | `PUBLIC_TURNSTILE_SITE_KEY`, `STORYBLOK_TOKEN` | `PUBLIC_*` is baked at build time |

---

## 1. Resend — sender + domain

1. Create a [Resend](https://resend.com) account.
2. **Add & verify the domain** `florientecattery.com` (Resend → Domains → Add).
3. Create an **API key** (Resend → API Keys). → `RESEND_API_KEY`
4. Decide the sender address, e.g. `waitlist@florientecattery.com`.
   → `WAITLIST_FROM="Floriente Cattery <waitlist@florientecattery.com>"`
5. Set the notification recipient → `WAITLIST_NOTIFY_TO=info@florientecattery.com`

## 2. SPF / DKIM (deliverability)

Resend's domain verification gives you DNS records to add at the domain registrar:

- [ ] **DKIM** CNAME/TXT records from Resend — added & verified (green in Resend).
- [ ] **SPF**: ensure the domain's TXT SPF record includes Resend (`include:resend.com` or as Resend instructs). If an SPF record already exists, **merge**, don't add a second one.
- [ ] (Recommended) **DMARC** TXT record (`v=DMARC1; p=none; rua=...`) to monitor.

Without this, notifications and auto-replies may land in spam. Test in §6.

## 3. Google Sheet

1. Create a Google Sheet, e.g. "Floriente Waitlist".
2. First tab name = **`Waitlist`** (matches `GOOGLE_SHEET_RANGE=Waitlist!A:S`).
3. Add this header row in **row 1**, columns A–S (exact order — the function appends rows in this order):

   ```
   CreatedAt | Locale | Name | Email | PreferredChannel | ContactValue | Country | City |
   Class | BreedPreference | SexColorPreference | Timing | VideoCallReady | SourceChannel |
   HomeExperience | Wishes | GDPRConsent | Status | Notes
   ```

4. `Status` and `Notes` are **yours** to fill (suggested flow: New → Contacted → Video-call → Reserved → Declined).
5. From the sheet URL copy the ID: `https://docs.google.com/spreadsheets/d/`**`<THIS>`**`/edit`. → `GOOGLE_SHEET_ID`

## 4. Google service account

1. [Google Cloud Console](https://console.cloud.google.com) → create/select a project.
2. **Enable the Google Sheets API** (APIs & Services → Library → Google Sheets API → Enable).
3. APIs & Services → Credentials → **Create credentials → Service account**.
4. On the service account → **Keys → Add key → JSON**. Download the JSON.
5. From the JSON:
   - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL`
   - `private_key` → `GOOGLE_PRIVATE_KEY` (keep the `\n` sequences; the code normalizes them)

## 5. Service account access to the Sheet

- [ ] Open the Sheet → **Share** → paste the service account's `client_email` → give **Editor** → Send.

Without this the append returns a 403 (`The caller does not have permission`).

## 6. Cloudflare Pages env / secrets

In the Pages project → Settings → Environment variables, set for **Production** (and **Preview** if you want preview to be live):

| Variable | Type | Value |
|---|---|---|
| `RESEND_API_KEY` | secret | from §1 |
| `WAITLIST_FROM` | plain | from §1 |
| `WAITLIST_NOTIFY_TO` | plain | `info@florientecattery.com` |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | plain | from §4 |
| `GOOGLE_PRIVATE_KEY` | secret | from §4 (full PEM) |
| `GOOGLE_SHEET_ID` | plain | from §3 |
| `GOOGLE_SHEET_RANGE` | plain | `Waitlist!A:S` |
| `TURNSTILE_SECRET_KEY` | secret | optional (§8) |
| `PUBLIC_TURNSTILE_SITE_KEY` | plain (build) | optional (§8) — must also be in **build** env |
| `WAITLIST_ALLOW_DEGRADED` | plain | **Production & Preview: leave UNSET.** Local dev only: `true`. |

> **Production safety:** `WAITLIST_ALLOW_DEGRADED` is unset by default = **strict mode**.
> In strict mode, if the Resend notification is not fully configured, the function
> returns **500 `config`** instead of a false `200` — so a misconfigured environment
> can never accept a submission and silently lose the lead. **Preview runs live**
> (real credentials, strict) just like production; set `true` **only** for local
> development where you intentionally test without sending email.

## 7. Gmail filter (triage)

So every application self-files for processing:

1. Gmail → Search options → **Subject contains:** `[WAITLIST]`
2. **Create filter** → check:
   - **Apply the label:** `Waitlist` (create it)
   - (optional) **Star it** / **Mark as important**
   - (optional) **Never send to Spam**
3. Triage tips: search `subject:[WAITLIST] Breeding` for breeding/show only; sort by date for queue order. The subject is `[WAITLIST] {Class} · {Breed} · {Country} · {Name} · {YYYY-MM-DD}`.

## 8. Turnstile (optional anti-spam hardening)

Honeypot + fill-time are always on. To add Cloudflare Turnstile:

1. Cloudflare dashboard → Turnstile → add a widget for `florientecattery.com`.
2. **Site key** → `PUBLIC_TURNSTILE_SITE_KEY` (Pages **build** env + local `.env`/keychain). The form renders the widget only when this is set.
3. **Secret key** → `TURNSTILE_SECRET_KEY` (Pages runtime secret + `.dev.vars`). The function enforces verification only when this is set.

---

## Local validation (`wrangler pages dev`)

```bash
cp .dev.vars.example .dev.vars     # fill with real values for full e2e
npm run build                      # produces dist/ (needs STORYBLOK_TOKEN)
npm run pages:dev                  # serves dist/ + runs /api/waitlist with .dev.vars
```

Then submit the form at `http://localhost:8788/en/kittens/waitlist/` (wrangler's port)
and confirm: 200 response, email received, Sheet row appended.

Static checks (no secrets needed):
```bash
npm run functions:check            # typecheck the function
npm run functions:test             # pure-logic unit tests
```

---

## Production acceptance rule

Production is **not** accepted unless, on a real test submission:

- [ ] **Notification email** to `info@florientecattery.com` — **PASS**, and
- [ ] **Google Sheet row appended** — **PASS**

…**or** the operator explicitly accepts an **email-only fallback** (Sheet deferred).
Email-only is a conscious waiver, not "done" — record it.

### Final test submission (Gate 3, on a Cloudflare preview or production)

1. Open the live waitlist page, submit a real test entry.
2. Confirm the `[WAITLIST] …` email arrived and the Gmail filter labelled it.
3. Confirm the auto-reply arrived at the applicant address.
4. Confirm a new row appeared in the Sheet with all columns populated.
5. Delete the test row when done.
