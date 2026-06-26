// Storage layer — Cloudflare D1 insert. Replaces the Google Sheets path.
// `buildValues` is pure (unit-testable); `insertSubmission` is the thin I/O.
// Raw enum values are stored (e.g. interest_class='breeding_show') — the human
// labels live in the notification email; the DB keeps clean, queryable values.
import type { Env, CleanSubmission, OpResult } from './types.ts';

// Column order MUST match db/schema.sql (20 columns).
const INSERT_SQL =
  'INSERT INTO waitlist (' +
  'created_at, locale, name, email, preferred_channel, contact_value, country, city, ' +
  'interest_class, breed_preference, sex_preference, color_preference, timing, ' +
  'video_call_ready, source_channel, home_experience, wishes, gdpr_consent, status, notes' +
  ') VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)';

export function buildValues(c: CleanSubmission, now: Date): unknown[] {
  return [
    now.toISOString(), // created_at
    c.locale,
    c.name,
    c.email,
    c.preferredChannel,
    c.contactValue,
    c.country,
    c.city,
    c.interestClass,
    c.breedPreference,
    c.sexPreference,
    c.colorPreference,
    c.timing,
    c.videoCallReady ? 1 : 0,
    c.sourceChannel,
    c.homeExperience,
    c.wishes,
    1, // gdpr_consent (validated true before reaching here)
    'new', // status — operator workflow
    '', // notes — operator-owned
  ];
}

export async function insertSubmission(
  env: Env,
  clean: CleanSubmission,
  now: Date,
): Promise<OpResult> {
  if (!env.WAITLIST_DB) {
    return { status: 'skipped', reason: 'D1 binding WAITLIST_DB missing' };
  }
  try {
    const res = await env.WAITLIST_DB.prepare(INSERT_SQL)
      .bind(...buildValues(clean, now))
      .run();
    if (!res.success) {
      return { status: 'error', detail: `D1 run unsuccessful: ${res.error ?? 'unknown'}` };
    }
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', detail: `D1 insert failed: ${String(err).slice(0, 200)}` };
  }
}
