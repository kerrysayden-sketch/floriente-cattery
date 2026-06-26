// POST /api/waitlist — Cloudflare Pages Function.
// Pipeline: method guard → parse → honeypot/fill-time → Turnstile (env-gated)
// → validate + consent gate → notification email (hard) → auto-reply (soft)
// → Google Sheet append (soft/degrade) → JSON response.
//
// Hard dependency = the notification email. By DEFAULT (strict) an unconfigured
// notify path returns 500 'config' — never a false success. Degraded mode
// (skip + return 200) is opt-in via WAITLIST_ALLOW_DEGRADED='true' for
// local/preview only. Sheet + auto-reply stay soft. Production acceptance
// (notify PASS + Sheet PASS) is verified by the operator — see WAITLIST-SETUP.md.
import type { FnContext, RawSubmission } from './_lib/types.ts';
import { validateSubmission } from './_lib/validate.ts';
import { checkHoneypot, verifyTurnstile } from './_lib/antispam.ts';
import { buildSubject } from './_lib/subject.ts';
import { sendNotification, sendAutoReply } from './_lib/email.ts';
import { appendToSheet } from './_lib/sheet.ts';

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

  // Notification email — hard dependency.
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

  // Auto-reply — soft (failure must not lose the lead).
  const reply = await sendAutoReply(env, clean);
  if (reply.status === 'error') console.error(`waitlist: autoreply error — ${reply.detail}`);

  // Google Sheet — soft/degrade. Operator verifies PASS for production acceptance.
  const sheet = await appendToSheet(env, clean, now);
  if (sheet.status === 'error') console.error(`waitlist: sheet error — ${sheet.detail}`);

  console.log(
    `waitlist: ok notify=${notify.status} autoreply=${reply.status} sheet=${sheet.status} degraded=${allowDegraded} locale=${clean.locale}`,
  );
  return json(200, { ok: true });
};
