// Shared types for the waitlist Pages Function.
// Self-contained — no @cloudflare/workers-types dependency. We type only the
// slice of the Pages context we actually use (request + env), plus our own
// payload/result shapes. Web globals (Request, Response, fetch, crypto) come
// from lib.dom in functions/tsconfig.json.

export type Locale = 'en' | 'uk' | 'pl' | 'de' | 'ru';

export const LOCALES: Locale[] = ['en', 'uk', 'pl', 'de', 'ru'];

export type InterestClass = 'pet' | 'breeding_show' | 'not_sure';
export type PreferredChannel = 'whatsapp' | 'telegram' | 'instagram' | 'email' | 'phone';

// Runtime environment (Cloudflare Pages env / wrangler .dev.vars).
// Every value is optional so the function degrades gracefully when a feature
// (Turnstile, Sheet) is not yet configured.
export interface Env {
  // Safety mode. Degraded mode (skip unconfigured notify/sheet and still return
  // 200) is allowed ONLY when this equals the string 'true'. Default (unset)
  // is STRICT: if notification email is not configured, the request fails with
  // 500 'config' rather than silently accepting and losing the lead.
  // Set 'true' for local/preview only; leave UNSET in production.
  WAITLIST_ALLOW_DEGRADED?: string;
  // Notification email (Resend)
  RESEND_API_KEY?: string;
  WAITLIST_FROM?: string; // verified sender, e.g. "Floriente <waitlist@florientecattery.com>"
  WAITLIST_NOTIFY_TO?: string; // e.g. "info@florientecattery.com"
  // Anti-spam (optional)
  TURNSTILE_SECRET_KEY?: string;
  // Google Sheet (optional in dev/preview; required for production acceptance)
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_PRIVATE_KEY?: string;
  GOOGLE_SHEET_ID?: string;
  GOOGLE_SHEET_RANGE?: string; // default "Waitlist!A:S"
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
