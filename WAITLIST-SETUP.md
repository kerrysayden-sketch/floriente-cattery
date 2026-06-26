# Waitlist — Operator Setup Checklist

External setup the **operator** performs before the waitlist backend is production-ready.
None of this lives in the repo (no secrets committed). Work top to bottom; each
section says where the value goes.

Storage is **Cloudflare D1** (no Google Cloud, no service accounts, no private keys).
Behaviour is **strict by default**: notification email **and** the D1 insert are
**hard dependencies** — if either is missing/failing the request returns 500, never
a false success. Degraded mode (skip them, return 200) is **local development only**.

---

## 0. Where values go

| Place | What | Notes |
|---|---|---|
| `.dev.vars` (local, gitignored) | runtime function secrets (Resend, optional Turnstile) | copy from `.dev.vars.example`; for `wrangler pages dev` |
| `wrangler.toml` `[[d1_databases]]` | local D1 binding | identifiers only, not secrets |
| Cloudflare Pages → Settings → Environment variables | runtime secrets **+** `PUBLIC_TURNSTILE_SITE_KEY` | set for **Production** and **Preview** separately |
| Cloudflare Pages → Settings → Functions → **D1 bindings** | `WAITLIST_DB` per environment | Preview → preview DB, Production → prod DB |
| Cloudflare Pages → build env | `PUBLIC_TURNSTILE_SITE_KEY`, `STORYBLOK_TOKEN` | `PUBLIC_*` is baked at build time |

---

## 1. Resend — sender + domain

1. Create a [Resend](https://resend.com) account.
2. **Add & verify the domain** `florientecattery.com` (Resend → Domains → Add).
3. Create an **API key** (Resend → API Keys). → `RESEND_API_KEY`
4. Decide the sender address, e.g. `waitlist@florientecattery.com`.
   → `WAITLIST_FROM="Floriente Cattery <waitlist@florientecattery.com>"`
5. Set the notification recipient:
   - **Preview:** a test inbox you control (e.g. `you+waitlist-preview@gmail.com`).
   - **Production:** `info@florientecattery.com`.
   → `WAITLIST_NOTIFY_TO`

## 2. SPF / DKIM (deliverability)

Resend's domain verification gives you DNS records to add wherever the domain's DNS lives (likely Cloudflare DNS):

- [ ] **DKIM** CNAME/TXT records from Resend — added & verified (green in Resend). In Cloudflare DNS set CNAMEs to **DNS only** (grey cloud), not proxied.
- [ ] **SPF**: ensure the domain's TXT SPF record includes Resend as Resend instructs. If an SPF record already exists, **merge**, don't add a second one.
- [ ] (Recommended) **DMARC** TXT record (`v=DMARC1; p=none; rua=...`) to monitor.

Without this, notifications and auto-replies may land in spam.

## 3. Cloudflare D1 (storage)

D1 is Cloudflare's serverless SQLite. The function writes one row per submission via
the `WAITLIST_DB` binding. **Separate databases per environment**, same binding name.

1. Authenticate: `npx wrangler login`.
2. Create the databases:
   ```bash
   npx wrangler d1 create floriente-waitlist-preview
   npx wrangler d1 create floriente-waitlist-prod
   ```
   Each prints a `database_id`. Put the **preview** one into `wrangler.toml`
   (`[[d1_databases]].database_id`) for local dev. (Identifiers, not secrets.)
3. Apply the schema (`db/schema.sql`) to each — local + remote as needed:
   ```bash
   npx wrangler d1 execute floriente-waitlist-preview --local  --file=db/schema.sql
   npx wrangler d1 execute floriente-waitlist-preview --remote --file=db/schema.sql
   npx wrangler d1 execute floriente-waitlist-prod    --remote --file=db/schema.sql
   ```
4. Columns (created by the schema, 20 cols incl. `id`): `created_at, locale, name, email,
   preferred_channel, contact_value, country, city, interest_class, breed_preference,
   sex_preference, color_preference, timing, video_call_ready, source_channel,
   home_experience, wishes, gdpr_consent, status, notes`. `status` (default `new`) and
   `notes` are **yours** to manage (New → Contacted → Video-call → Reserved → Declined).

**Viewing / managing rows (MVP):** there is **no spreadsheet UI**. Query via the
Cloudflare dashboard **D1 console** (Workers & Pages → D1 → database → Console) or:
```bash
npx wrangler d1 execute floriente-waitlist-preview --remote \
  --command "SELECT created_at, name, country, interest_class, status FROM waitlist ORDER BY created_at DESC"
```
Update a status:
```bash
npx wrangler d1 execute floriente-waitlist-prod --remote \
  --command "UPDATE waitlist SET status='contacted' WHERE id=123"
```
> **Follow-up (deferred):** a small read-only admin view and/or CSV export are *not*
> in this gate — flagged for later.

## 4. Bind D1 in Cloudflare Pages

Pages project → **Settings → Functions → D1 database bindings**:

- **Preview** environment → variable name `WAITLIST_DB` → database `floriente-waitlist-preview`.
- **Production** environment → variable name `WAITLIST_DB` → database `floriente-waitlist-prod`.

Same binding name in both; the code is environment-agnostic.

## 5. Cloudflare Pages env / secrets

Pages project → Settings → Environment variables. Set per environment (Preview first):

| Variable | Type | Preview value | Production value |
|---|---|---|---|
| `RESEND_API_KEY` | secret | from §1 | from §1 |
| `WAITLIST_FROM` | plain | from §1 | from §1 |
| `WAITLIST_NOTIFY_TO` | plain | **test inbox** | `info@florientecattery.com` |
| `STORYBLOK_TOKEN` | secret (build) | existing | existing |
| `TURNSTILE_SECRET_KEY` | secret | optional (§7) | optional (§7) |
| `PUBLIC_TURNSTILE_SITE_KEY` | plain (build) | optional (§7) | optional (§7) |
| `WAITLIST_ALLOW_DEGRADED` | — | **DO NOT SET** | **DO NOT SET** |

D1 is a **binding** (§4), not an env var here.

> **Production safety:** `WAITLIST_ALLOW_DEGRADED` unset = **strict mode**. In strict
> mode a missing notify config (→ 500 `config`), a notify send failure (→ 500 `server`),
> or a missing/failed D1 insert (→ 500 `storage`) all fail loudly instead of a false
> `200`. **Preview runs live/strict** just like production; set `true` **only** for
> local development.

## 6. Gmail filter (triage)

On the inbox that receives notifications (Preview test inbox; replicate on `info@` for prod):

1. Gmail → Search options → **Subject contains:** `[WAITLIST]`
2. **Create filter** → check:
   - **Apply the label:** `Waitlist` (create it)
   - (optional) **Star it** / **Mark as important**
   - (optional) **Never send to Spam**
3. Triage tips: search `subject:[WAITLIST] Breeding` for breeding/show only; sort by date for queue order. Subject is `[WAITLIST] {Class} · {Breed} · {Country} · {Name} · {YYYY-MM-DD}`.

## 7. Turnstile (optional anti-spam hardening — deferred)

Honeypot + fill-time are always on. To add Cloudflare Turnstile later:

1. Cloudflare dashboard → Turnstile → add a widget for `florientecattery.com`.
2. **Site key** → `PUBLIC_TURNSTILE_SITE_KEY` (Pages **build** env). The form renders the widget only when this is set.
3. **Secret key** → `TURNSTILE_SECRET_KEY` (Pages runtime secret + `.dev.vars`). The function enforces verification only when this is set.

---

## Local validation (`wrangler pages dev`)

```bash
cp .dev.vars.example .dev.vars       # set RESEND_* for full e2e (or leave empty + degraded)
npx wrangler d1 execute floriente-waitlist-preview --local --file=db/schema.sql
npm run build                        # produces dist/ (needs STORYBLOK_TOKEN)
npm run pages:dev                    # serves dist/ + runs /api/waitlist with the local D1
```

Submit at `http://localhost:8788/en/kittens/waitlist/`, then confirm the row:
```bash
npx wrangler d1 execute floriente-waitlist-preview --local --command "SELECT * FROM waitlist"
```

Static checks (no secrets needed):
```bash
npm run functions:check              # typecheck the function
npm run functions:test               # pure-logic + handler unit tests
```

---

## Production acceptance rule

Production is **not** accepted unless, on a real test submission:

- [ ] **Notification email** to `info@florientecattery.com` — **PASS**, and
- [ ] **Auto-reply** to the applicant — **PASS**, and
- [ ] **D1 row inserted** in `floriente-waitlist-prod` — **PASS**

…**or** the operator explicitly accepts a documented waiver. Email + D1 are hard
dependencies in strict mode, so a 200 already implies both passed — but verify a real
submission end-to-end before accepting production.

### Final test submission (on a Cloudflare preview, then production)

1. Open the live waitlist page, submit a real test entry → expect **HTTP 200**.
2. Confirm the `[WAITLIST] …` email arrived and the Gmail filter labelled it.
3. Confirm the auto-reply arrived at the applicant address.
4. Confirm a new row in D1 (`SELECT … ORDER BY created_at DESC`).
5. Delete the test row when done.
