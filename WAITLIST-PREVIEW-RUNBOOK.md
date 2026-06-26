# Waitlist — Gate 3A Operator Execution Pack (Preview)

Ordered, check-off runbook for standing up the **live/strict Preview** of the waitlist flow.
Reference doc (source of truth for values/columns): **[WAITLIST-SETUP.md](WAITLIST-SETUP.md)**.

**Scope guards (do not violate):**
- Preview is **live/strict**. **Do NOT set `WAITLIST_ALLOW_DEGRADED`** in Preview or Production.
- Defer Turnstile — validate the core flow first.
- **No push / no preview deploy** until you explicitly approve the §5 execution step.
- **Production is NOT approved** (see §6).

Fill the blanks as you go. Nothing here contains real secrets — keep it that way.

---

## 1. Resend setup

- [ ] **1.1** Create/sign in to [Resend](https://resend.com); verify the account email.
- [ ] **1.2** Domains → **Add domain** → `florientecattery.com`.
- [ ] **1.3** Add the **exact DNS records Resend displays** to the domain's DNS (do not hand-author):
  - [ ] DKIM record(s) (CNAME/TXT)
  - [ ] SPF / Return-Path (TXT + the bounce-subdomain MX)
  - [ ] *(optional)* DMARC TXT: `v=DMARC1; p=none; rua=mailto:<you>`
- [ ] **1.4** Confirm the domain shows **Verified** (all records green) in Resend.
- [ ] **1.5** API Keys → **Create** (sending scope). Store as the secret value for `RESEND_API_KEY`.
      → key created: ☐  (value goes only into Cloudflare/`.dev.vars`, never the repo)
- [ ] **1.6** Define the sender (must be on the verified domain):
      `WAITLIST_FROM = "Floriente Cattery <waitlist@florientecattery.com>"`
- [ ] **1.7** Define the **Preview** notification recipient — a **test inbox you control**,
      not `info@`. Suggested Gmail alias: `__________________________` (e.g. `you+waitlist-preview@gmail.com`)
      → `WAITLIST_NOTIFY_TO` (Preview) = `__________________________`

**Env vars produced:** `RESEND_API_KEY` (secret), `WAITLIST_FROM` (plain), `WAITLIST_NOTIFY_TO` (plain, Preview = test inbox).

---

## 2. Google Sheet setup

- [ ] **2.1** Create a Google Sheet (e.g. "Floriente Waitlist"). Record the ID from the URL
      `https://docs.google.com/spreadsheets/d/`**`<ID>`**`/edit` → `GOOGLE_SHEET_ID` = `__________________________`
- [ ] **2.2** Create a tab named exactly **`Preview`** (Preview writes here; the prod `Waitlist` tab comes later).
- [ ] **2.3** Put the **exact A:S header row** in **row 1** of the `Preview` tab:

  ```
  CreatedAt | Locale | Name | Email | PreferredChannel | ContactValue | Country | City |
  Class | BreedPreference | SexColorPreference | Timing | VideoCallReady | SourceChannel |
  HomeExperience | Wishes | GDPRConsent | Status | Notes
  ```
  (19 columns, A→S. `Status` and `Notes` stay empty — operator-owned.)

- [ ] **2.4** [Google Cloud Console](https://console.cloud.google.com) → create/select a project.
- [ ] **2.5** APIs & Services → Library → **Google Sheets API** → **Enable**.
- [ ] **2.6** APIs & Services → Credentials → **Create credentials → Service account**.
- [ ] **2.7** Service account → **Keys → Add key → JSON** → download the JSON. From it:
  - `client_email` → `GOOGLE_SERVICE_ACCOUNT_EMAIL` = `__________________________`
  - `private_key` → `GOOGLE_PRIVATE_KEY` (secret; handle per the newline note below)
- [ ] **2.8** Open the Sheet → **Share** → paste the service account `client_email` → **Editor** → Send.
      *(Skip this and the append returns 403.)*

**Private-key newline handling (safe):**
- **Preferred:** paste the PEM into the Cloudflare **secret** field **with real newlines** (the full `-----BEGIN PRIVATE KEY-----` … block).
- **Alternative:** if forced single-line, replace newlines with the literal `\n` — the function normalizes `\n` at runtime ([sheet.ts](functions/api/_lib/sheet.ts) `pemToArrayBuffer`).
- Never place the key in the repo.

**Env vars produced:** `GOOGLE_SERVICE_ACCOUNT_EMAIL` (plain), `GOOGLE_PRIVATE_KEY` (secret), `GOOGLE_SHEET_ID` (plain), `GOOGLE_SHEET_RANGE` (plain) = **`Preview!A:S`**.

---

## 3. Cloudflare Pages — Preview env / secrets

Pages project → **Settings → Environment variables → Preview** environment.

**Classification & values to set:**

| Variable | Build-time / Runtime | Secret / Plain | Preview value |
|---|---|---|---|
| `STORYBLOK_TOKEN` | build-time | secret | existing |
| `RESEND_API_KEY` | runtime | **secret** | from §1.5 |
| `WAITLIST_FROM` | runtime | plain | `Floriente Cattery <waitlist@florientecattery.com>` |
| `WAITLIST_NOTIFY_TO` | runtime | plain | **test inbox (§1.7)** ← Preview-only |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | runtime | plain | from §2.7 |
| `GOOGLE_PRIVATE_KEY` | runtime | **secret** | from §2.7 |
| `GOOGLE_SHEET_ID` | runtime | plain | from §2.1 |
| `GOOGLE_SHEET_RANGE` | runtime | plain | **`Preview!A:S`** ← Preview-only |
| `WAITLIST_ALLOW_DEGRADED` | — | — | **DO NOT SET** ⚠️ |
| `PUBLIC_TURNSTILE_SITE_KEY` | build-time | plain | **deferred** (Turnstile off) |
| `TURNSTILE_SECRET_KEY` | runtime | secret | **deferred** (Turnstile off) |

- [ ] **3.1** Set all "runtime" rows above in the **Preview** environment (secrets as encrypted).
- [ ] **3.2** Confirm `STORYBLOK_TOKEN` is present for the Preview **build**.
- [ ] **3.3** **Confirm `WAITLIST_ALLOW_DEGRADED` is UNSET** in Preview (and Production). ⚠️ Live preview must fail loudly.
- [ ] **3.4** Leave both Turnstile vars **unset** for now (honeypot + fill-time remain active).

> Why it matters: build-time vars (`STORYBLOK_TOKEN`, and `PUBLIC_*` if ever used) are baked during `astro build`; runtime vars (`RESEND_*`, `GOOGLE_*`) are read by the Function per request. With `WAITLIST_ALLOW_DEGRADED` unset, an unconfigured notify path returns **500 `config`** — the intended loud failure.

---

## 4. Gmail filter

On the inbox receiving Preview notifications (the §1.7 test inbox; replicate on `info@` for production later):

- [ ] **4.1** Gmail → search options → **Subject contains:** `[WAITLIST]` → **Create filter**.
- [ ] **4.2** **Apply the label:** `Waitlist` (create it).
- [ ] **4.3** *(optional)* **Star it** / **Mark as important**; *(optional)* **Never send to Spam** while DKIM/DMARC settle.

Subject shape for reference: `[WAITLIST] {Class} · {Breed} · {Country} · {Name} · {YYYY-MM-DD}`.

---

## 5. Preview e2e runbook

> ⛔ **Do not start §5 until the operator explicitly approves the preview execution step.**

- [ ] **5.1** Create branch **`preview/waitlist`** from the approved local state (`aafd0e9`). **Push only after approval.**
- [ ] **5.2** Trigger the Cloudflare **Preview** deployment and capture the URL.
  - **Deploy mechanism note:** Cloudflare Pages git-integration auto-previews work for GitHub/GitLab. This repo's remote is **Codeberg** — if the Pages project is **not** git-connected to it, use direct upload instead:
    `npm run build && npx wrangler pages deploy dist --branch=preview/waitlist`
    (Use whichever matches how this Pages project is wired. Either yields a Preview URL.)
  - Preview URL: `__________________________`
- [ ] **5.3** Submit **one valid** test application via the form at `/<lang>/kittens/waitlist/`.
- [ ] **5.4** Verify **HTTP 200** + success panel.
- [ ] **5.5** Verify **notification email** arrived at the §1.7 test inbox (`reply_to` = applicant).
- [ ] **5.6** Verify **applicant auto-reply** arrived (localized to the submitted locale).
- [ ] **5.7** Verify a **new row in the `Preview` tab**, all 19 columns populated, `Status`/`Notes` empty.
- [ ] **5.8** Verify the email is **auto-labelled `Waitlist`** (§4).
- [ ] **5.9** **Negative tests** against `<PreviewURL>/api/waitlist`:
  ```bash
  U=<PreviewURL>/api/waitlist
  # bad JSON → 400 bad_request
  curl -s -o /dev/null -w "bad-json: %{http_code}\n" -X POST -H 'content-type: application/json' --data 'x' $U
  # missing consent → 400 consent
  curl -s -w "\nconsent: " -X POST -H 'content-type: application/json' \
    --data '{"locale":"en","name":"T","email":"t@e.com","preferredChannel":"whatsapp","contactValue":"x","country":"DE","interestClass":"pet","gdprConsent":false,"ts":1}' $U; echo
  # empty body → 422 validation
  curl -s -w "\nempty: " -X POST -H 'content-type: application/json' --data '{}' $U; echo
  ```
- [ ] **5.10** *(optional, proves fail-loud)* Before `RESEND_*` is set in Preview, a valid submit should return **500 `config`**. Confirm if convenient.
- [ ] **5.11** **Record results** below, then delete the test row + test emails.

**Results log:**

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| 5.4 valid submit | 200 | | ☐ |
| 5.5 notification email | received | | ☐ |
| 5.6 auto-reply | received | | ☐ |
| 5.7 Preview row | 1 row, 19 cols | | ☐ |
| 5.8 Gmail label | `Waitlist` | | ☐ |
| 5.9 bad JSON | 400 bad_request | | ☐ |
| 5.9 missing consent | 400 consent | | ☐ |
| 5.9 empty body | 422 validation | | ☐ |

---

## 6. Production gate (NOT approved)

- [ ] **Production is NOT approved.** It requires **separate explicit operator approval** *after* the §5 Preview e2e passes.
- When approved, production differs from the validated Preview only by:
  - `WAITLIST_NOTIFY_TO` = **`info@florientecattery.com`**
  - `GOOGLE_SHEET_RANGE` = **`Waitlist!A:S`** (prod `Waitlist` tab, with the same A:S header row)
  - `WAITLIST_ALLOW_DEGRADED` = **unset** (strict, no degraded mode)
- Production acceptance still requires: notification email PASS, auto-reply PASS, Sheet append PASS (or recorded email-only waiver), Gmail filter PASS, no secrets in repo.
- Production deploy is a **separate gate** — do not deploy to production from this runbook.
