# Waitlist — Operator Execution Pack (Preview)

Ordered, check-off runbook for standing up the **live/strict Preview** of the waitlist flow.
Reference doc (source of truth for values/columns): **[WAITLIST-SETUP.md](WAITLIST-SETUP.md)**.

Storage is **Cloudflare D1** (no Google Cloud). Notification email **and** the D1 insert
are **hard dependencies** in strict mode.

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
  - [ ] DKIM record(s) (CNAME/TXT) — in Cloudflare DNS set CNAMEs to **DNS only** (grey cloud)
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

## 2. Cloudflare D1 (storage)

No Google Cloud, no service account, no private key — D1 is a binding.

- [ ] **2.1** `npx wrangler login`.
- [ ] **2.2** Create both databases:
  ```bash
  npx wrangler d1 create floriente-waitlist-preview
  npx wrangler d1 create floriente-waitlist-prod
  ```
  Record the **preview** `database_id` → put it in `wrangler.toml` `[[d1_databases]].database_id`
  (identifier, not a secret). Preview id: `__________________________`
- [ ] **2.3** Apply the schema (`db/schema.sql`) — local for dev, remote for the preview DB:
  ```bash
  npx wrangler d1 execute floriente-waitlist-preview --local  --file=db/schema.sql
  npx wrangler d1 execute floriente-waitlist-preview --remote --file=db/schema.sql
  ```
- [ ] **2.4** *(prod DB, for later)* `npx wrangler d1 execute floriente-waitlist-prod --remote --file=db/schema.sql`

**Viewing rows (MVP — no spreadsheet UI):** Cloudflare dashboard → Workers & Pages → D1 →
database → **Console**, or:
```bash
npx wrangler d1 execute floriente-waitlist-preview --remote \
  --command "SELECT created_at, name, country, interest_class, status FROM waitlist ORDER BY created_at DESC"
```
*(A read-only admin view / CSV export is deferred — not this gate.)*

✅ Produces the `WAITLIST_DB` binding target. No secret, no service account, no sharing.

---

## 3. Cloudflare Pages — Preview env + D1 binding

**3a. D1 binding** — Pages project → **Settings → Functions → D1 database bindings**:
- [ ] **3.1** **Preview** environment → variable name **`WAITLIST_DB`** → database `floriente-waitlist-preview`.
- [ ] **3.2** *(later)* **Production** environment → `WAITLIST_DB` → `floriente-waitlist-prod`.

**3b. Environment variables** — Pages project → **Settings → Environment variables → Preview**:

| Variable | Build-time / Runtime | Secret / Plain | Preview value |
|---|---|---|---|
| `STORYBLOK_TOKEN` | build-time | secret | existing |
| `RESEND_API_KEY` | runtime | **secret** | from §1.5 |
| `WAITLIST_FROM` | runtime | plain | `Floriente Cattery <waitlist@florientecattery.com>` |
| `WAITLIST_NOTIFY_TO` | runtime | plain | **test inbox (§1.7)** ← Preview-only |
| `WAITLIST_ALLOW_DEGRADED` | — | — | **DO NOT SET** ⚠️ |
| `PUBLIC_TURNSTILE_SITE_KEY` | build-time | plain | **deferred** (Turnstile off) |
| `TURNSTILE_SECRET_KEY` | runtime | secret | **deferred** (Turnstile off) |

(`WAITLIST_DB` is a **binding**, set in 3a — not an env var here. No `GOOGLE_*` anymore.)

- [ ] **3.3** Set the runtime rows above in **Preview** (secrets encrypted).
- [ ] **3.4** Confirm `STORYBLOK_TOKEN` present for the Preview **build**.
- [ ] **3.5** **Confirm `WAITLIST_ALLOW_DEGRADED` is UNSET** in Preview (and Production). ⚠️ Live preview must fail loudly.
- [ ] **3.6** Leave both Turnstile vars **unset** for now (honeypot + fill-time remain active).

> Why it matters: with `WAITLIST_ALLOW_DEGRADED` unset, a missing notify config → **500 `config`**,
> and a missing/failed D1 → **500 `storage`**. Both are intended loud failures, never a false 200.

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

- [ ] **5.1** Create branch **`preview/waitlist`** from the approved local state (latest waitlist commit, incl. the D1 swap). **Push only after approval.**
- [ ] **5.2** Trigger the Cloudflare **Preview** deployment and capture the URL.
  - **Deploy mechanism note:** Cloudflare Pages git-integration auto-previews work for GitHub/GitLab. This repo's remote is **Codeberg** — if the Pages project is **not** git-connected to it, use direct upload instead:
    `npm run build && npx wrangler pages deploy dist --branch=preview/waitlist`
    (Use whichever matches how this Pages project is wired. Either yields a Preview URL.)
  - Preview URL: `__________________________`
- [ ] **5.3** Submit **one valid** test application via the form at `/<lang>/kittens/waitlist/`.
- [ ] **5.4** Verify **HTTP 200** + success panel.
- [ ] **5.5** Verify **notification email** arrived at the §1.7 test inbox (`reply_to` = applicant).
- [ ] **5.6** Verify **applicant auto-reply** arrived (localized to the submitted locale).
- [ ] **5.7** Verify a **new row in the preview D1**:
  ```bash
  npx wrangler d1 execute floriente-waitlist-preview --remote \
    --command "SELECT count(*) AS n, max(created_at) AS latest FROM waitlist"
  ```
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
- [ ] **5.10** *(optional, proves fail-loud)* Before `RESEND_*` / `WAITLIST_DB` are set in Preview, a valid submit should return **500** (`config` for notify, `storage` for D1). Confirm if convenient.
- [ ] **5.11** **Record results** below, then delete the test row + test emails.

**Results log:**

| Check | Expected | Actual | Pass? |
|---|---|---|---|
| 5.4 valid submit | 200 | | ☐ |
| 5.5 notification email | received | | ☐ |
| 5.6 auto-reply | received | | ☐ |
| 5.7 D1 row | count +1, latest = now | | ☐ |
| 5.8 Gmail label | `Waitlist` | | ☐ |
| 5.9 bad JSON | 400 bad_request | | ☐ |
| 5.9 missing consent | 400 consent | | ☐ |
| 5.9 empty body | 422 validation | | ☐ |

---

## 6. Production gate (NOT approved)

- [ ] **Production is NOT approved.** It requires **separate explicit operator approval** *after* the §5 Preview e2e passes.
- When approved, production differs from the validated Preview only by:
  - `WAITLIST_DB` binding → **`floriente-waitlist-prod`** (schema already applied in §2.4)
  - `WAITLIST_NOTIFY_TO` = **`info@florientecattery.com`**
  - `WAITLIST_ALLOW_DEGRADED` = **unset** (strict, no degraded mode)
- Production acceptance still requires: notification email PASS, auto-reply PASS, **D1 insert PASS** (or recorded waiver), Gmail filter PASS, no secrets in repo.
- Production deploy is a **separate gate** — do not deploy to production from this runbook.
