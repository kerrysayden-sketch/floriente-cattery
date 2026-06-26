// Anti-spam: honeypot + fill-time (pure), Turnstile verify (network, env-gated).
import type { RawSubmission } from './types.ts';

// Minimum plausible fill time. A human cannot complete the form in under a few
// seconds; bots submit near-instantly. Below this → silent drop.
export const MIN_FILL_MS = 3000;

export interface HoneypotResult {
  // true = the submission looks like a bot and should be SILENTLY dropped
  // (respond 200 so bots get no signal, but do not email or store).
  silentDrop: boolean;
  reason?: 'honeypot' | 'fill_time';
}

/**
 * Pure honeypot + fill-time check.
 * `now` is injected so the logic is deterministic in tests.
 */
export function checkHoneypot(raw: RawSubmission, now: number): HoneypotResult {
  const company = typeof raw.company === 'string' ? raw.company.trim() : '';
  if (company !== '') return { silentDrop: true, reason: 'honeypot' };

  const ts = typeof raw.ts === 'number' ? raw.ts : Number(raw.ts);
  // If ts is present and the elapsed time is implausibly short → drop.
  // A missing/invalid ts is NOT treated as a bot on its own (could be a
  // privacy extension); honeypot + Turnstile carry the rest.
  if (Number.isFinite(ts) && ts > 0 && now - ts < MIN_FILL_MS) {
    return { silentDrop: true, reason: 'fill_time' };
  }
  return { silentDrop: false };
}

export interface TurnstileOutcome {
  enabled: boolean; // whether a secret was configured
  ok: boolean; // verification passed (true when disabled — nothing to fail)
}

/**
 * Verify a Cloudflare Turnstile token. No-op (ok=true) when no secret is set,
 * so the form works before Turnstile is provisioned.
 */
export async function verifyTurnstile(
  secret: string | undefined,
  token: string,
  remoteIp?: string,
): Promise<TurnstileOutcome> {
  if (!secret) return { enabled: false, ok: true };
  if (!token) return { enabled: true, ok: false };

  const body = new FormData();
  body.append('secret', secret);
  body.append('response', token);
  if (remoteIp) body.append('remoteip', remoteIp);

  try {
    const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
      method: 'POST',
      body,
    });
    const data = (await res.json()) as { success?: boolean };
    return { enabled: true, ok: data.success === true };
  } catch {
    // Network failure verifying — fail closed (treat as not-verified).
    return { enabled: true, ok: false };
  }
}
