// POST /api/waitlist — Cloudflare Pages Function.
// Pipeline: method guard → parse → honeypot/fill-time → Turnstile (env-gated)
// → validate + consent gate → notification email (hard) → D1 insert (hard)
// → auto-reply (soft) → JSON response.
//
// Hard dependencies = notification email AND the D1 insert. By DEFAULT (strict):
//   notify unconfigured  → 500 'config'
//   notify send fails    → 500 'server'
//   D1 binding missing   → 500 'storage'
//   D1 insert fails      → 500 'storage'
//   notify PASS + D1 PASS → 200 (auto-reply failure is logged, still 200)
// Degraded mode (skip notify AND D1, return 200) is opt-in via
// WAITLIST_ALLOW_DEGRADED='true' for LOCAL development only — never Preview/Prod.
// Order is notify → D1: the flaky external call is checked first, so the common
// failure writes no partial state (minimizes duplicate rows on retry).
import type { FnContext, RawSubmission } from './_lib/types.ts';
import { validateSubmission } from './_lib/validate.ts';
import { checkHoneypot, verifyTurnstile } from './_lib/antispam.ts';
import { buildSubject } from './_lib/subject.ts';
import { sendNotification, sendAutoReply } from './_lib/email.ts';
import { insertSubmission } from './_lib/store.ts';

const MAX_BODY_BYTES = 20_000;

function json(status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
  });
}

export const onRequest = async (context: FnContext): Promise<Response> => {
  const { request, env } = context;

  if (request.method !== 'POST') {
    return json(405, { ok: false, error: 'method' });
  }

  // Parse body (size-guarded).
  let raw: RawSubmission;
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return json(413, { ok: false, error: 'too_large' });
    raw = JSON.parse(text) as RawSubmission;
  } catch {
    return json(400, { ok: false, error: 'bad_request' });
  }

  // Honeypot + fill-time → silent accept (no signal to bots, nothing sent/stored).
  const hp = checkHoneypot(raw, Date.now());
  if (hp.silentDrop) {
    console.log(`waitlist: silent-drop (${hp.reason})`);
    return json(200, { ok: true });
  }

  // Turnstile (only enforced when a secret is configured).
  const ip = request.headers.get('CF-Connecting-IP') ?? undefined;
  const turnstileToken = typeof raw.turnstileToken === 'string' ? raw.turnstileToken : '';
  const ts = await verifyTurnstile(env.TURNSTILE_SECRET_KEY, turnstileToken, ip);
  if (ts.enabled && !ts.ok) {
    return json(403, { ok: false, error: 'spam' });
  }

  // Validate + consent gate.
  const result = validateSubmission(raw);
  if (!result.ok || !result.clean) {
    if (result.fields.length === 1 && result.consentMissing) {
      return json(400, { ok: false, error: 'consent' });
    }
    return json(422, { ok: false, error: 'validation', fields: result.fields });
  }
  const clean = result.clean;

  // Degraded mode (skip unconfigured notify and still return 200) is allowed
  // ONLY when explicitly enabled. Default is STRICT — production safety.
  const allowDegraded = env.WAITLIST_ALLOW_DEGRADED === 'true';

  // 1. Notification email — hard dependency.
  const now = new Date();
  const subject = buildSubject(clean, now);
  const notify = await sendNotification(env, clean, subject);
  if (notify.status === 'error') {
    // Configured but the send failed.
    console.error(`waitlist: notify error — ${notify.detail}`);
    return json(500, { ok: false, error: 'server' });
  }
  if (notify.status === 'skipped' && !allowDegraded) {
    // Not configured + not in degraded mode → never report a false success.
    console.error('waitlist: notify not configured and degraded mode disabled → 500 config');
    return json(500, { ok: false, error: 'config' });
  }

  // 2. D1 insert — hard dependency in strict mode.
  const store = await insertSubmission(env, clean, now);
  if (store.status === 'error') {
    console.error(`waitlist: store error — ${store.detail}`);
    return json(500, { ok: false, error: 'storage' });
  }
  if (store.status === 'skipped' && !allowDegraded) {
    // Binding missing + not in degraded mode → the lead would not be stored.
    console.error('waitlist: D1 binding missing and degraded mode disabled → 500 storage');
    return json(500, { ok: false, error: 'storage' });
  }

  // 3. Auto-reply — soft (failure must not lose the lead).
  const reply = await sendAutoReply(env, clean);
  if (reply.status === 'error') console.error(`waitlist: autoreply error — ${reply.detail}`);

  console.log(
    `waitlist: ok notify=${notify.status} store=${store.status} autoreply=${reply.status} degraded=${allowDegraded} locale=${clean.locale}`,
  );
  return json(200, { ok: true });
};
