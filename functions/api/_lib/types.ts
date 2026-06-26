// Shared types for the waitlist Pages Function.
// Self-contained — no @cloudflare/workers-types dependency. We type only the
// slice of the Pages context we actually use (request + env), plus our own
// payload/result shapes. Web globals (Request, Response, fetch, crypto) come
// from lib.dom in functions/tsconfig.json.

export type Locale = 'en' | 'uk' | 'pl' | 'de' | 'ru';

export const LOCALES: Locale[] = ['en', 'uk', 'pl', 'de', 'ru'];

export type InterestClass = 'pet' | 'breeding_show' | 'not_sure';
export type PreferredChannel = 'whatsapp' | 'telegram' | 'instagram' | 'email' | 'phone';

// Minimal Cloudflare D1 surface (only what the storage layer uses). Avoids a
// dependency on @cloudflare/workers-types.
export interface D1Result {
  success: boolean;
  error?: string;
}
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement;
  run(): Promise<D1Result>;
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement;
}

// Result of an external/storage operation (email send, D1 insert).
//   ok      → succeeded
//   skipped → not configured (only tolerated in local degraded mode)
//   error   → configured but failed
export type OpResult =
  | { status: 'ok'; id?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; detail: string };

// Runtime environment (Cloudflare Pages env / bindings, wrangler .dev.vars).
export interface Env {
  // Safety mode. Degraded mode (skip unconfigured notify AND D1, still return
  // 200) is allowed ONLY when this equals the string 'true', and ONLY locally.
  // Default (unset) is STRICT: missing notify config OR missing/failed D1 fails
  // with 500 rather than silently accepting and losing the lead.
  // Leave UNSET in Preview and Production.
  WAITLIST_ALLOW_DEGRADED?: string;
  // Notification email (Resend) — hard dependency.
  RESEND_API_KEY?: string;
  WAITLIST_FROM?: string; // verified sender, e.g. "Floriente <waitlist@florientecattery.com>"
  WAITLIST_NOTIFY_TO?: string; // e.g. "info@florientecattery.com"
  // Anti-spam (optional)
  TURNSTILE_SECRET_KEY?: string;
  // Storage — Cloudflare D1 binding. Hard dependency in strict mode.
  WAITLIST_DB?: D1Database;
}

// Minimal Pages-function context (only what we use).
export interface FnContext {
  request: Request;
  env: Env;
}

// The raw, parsed JSON body as received from the client (all untrusted).
export interface RawSubmission {
  locale?: unknown;
  name?: unknown;
  email?: unknown;
  preferredChannel?: unknown;
  contactValue?: unknown;
  country?: unknown;
  city?: unknown;
  interestClass?: unknown;
  breedPreference?: unknown;
  sexPreference?: unknown;
  colorPreference?: unknown;
  timing?: unknown;
  videoCallReady?: unknown;
  sourceChannel?: unknown;
  homeExperience?: unknown;
  wishes?: unknown;
  gdprConsent?: unknown;
  company?: unknown; // honeypot
  ts?: unknown; // client render timestamp (ms)
  turnstileToken?: unknown;
}

// A validated, normalized submission (safe to email / store).
export interface CleanSubmission {
  locale: Locale;
  name: string;
  email: string;
  preferredChannel: PreferredChannel;
  contactValue: string;
  country: string;
  city: string;
  interestClass: InterestClass;
  breedPreference: string;
  sexPreference: string;
  colorPreference: string;
  timing: string;
  videoCallReady: boolean;
  sourceChannel: string;
  homeExperience: string;
  wishes: string;
  gdprConsent: true;
}

export interface ValidationResult {
  ok: boolean;
  fields: string[]; // invalid required field names (for the client to highlight)
  consentMissing: boolean; // distinguishes the consent-specific error
  clean?: CleanSubmission;
}
