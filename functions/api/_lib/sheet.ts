// Google Sheets append via a service account (JWT → access token → values.append).
// Uses WebCrypto (RS256), so it runs in both the Workers runtime and Node 22+.
// Degrades to { status: 'skipped' } when credentials are absent — the form still
// works in dev/preview. Production acceptance requires this to PASS (or an
// explicit email-only waiver). See WAITLIST-SETUP.md.
import type { Env, CleanSubmission } from './types.ts';
import type { SendResult } from './email.ts';
import { classLabel, breedLabel } from './subject.ts';

const DEFAULT_RANGE = 'Waitlist!A:S';
const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const SCOPE = 'https://www.googleapis.com/auth/spreadsheets';

function b64urlFromBytes(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function b64urlFromString(s: string): string {
  return b64urlFromBytes(new TextEncoder().encode(s));
}

// PEM (PKCS#8) → DER as an ArrayBuffer (valid BufferSource for importKey).
// Tolerates env values where newlines are stored as "\n".
function pemToArrayBuffer(pem: string): ArrayBuffer {
  const normalized = pem.replace(/\\n/g, '\n');
  const body = normalized
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '');
  const raw = atob(body);
  const buf = new ArrayBuffer(raw.length);
  const view = new Uint8Array(buf);
  for (let i = 0; i < raw.length; i++) view[i] = raw.charCodeAt(i);
  return buf;
}

async function signJwt(email: string, privateKeyPem: string, now: Date): Promise<string> {
  const iat = Math.floor(now.getTime() / 1000);
  const exp = iat + 3600;
  const header = { alg: 'RS256', typ: 'JWT' };
  const claims = { iss: email, scope: SCOPE, aud: TOKEN_URL, iat, exp };
  const signingInput = `${b64urlFromString(JSON.stringify(header))}.${b64urlFromString(
    JSON.stringify(claims),
  )}`;

  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToArrayBuffer(privateKeyPem),
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(signingInput));
  return `${signingInput}.${b64urlFromBytes(new Uint8Array(sig))}`;
}

async function getAccessToken(env: Env, now: Date): Promise<string> {
  const jwt = await signJwt(env.GOOGLE_SERVICE_ACCOUNT_EMAIL!, env.GOOGLE_PRIVATE_KEY!, now);
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`token ${res.status}: ${detail.slice(0, 200)}`);
  }
  const data = (await res.json()) as { access_token?: string };
  if (!data.access_token) throw new Error('no access_token in token response');
  return data.access_token;
}

// Column order MUST match WAITLIST-SETUP.md:
// CreatedAt, Locale, Name, Email, PreferredChannel, ContactValue, Country, City,
// Class, BreedPreference, SexColorPreference, Timing, VideoCallReady,
// SourceChannel, HomeExperience, Wishes, GDPRConsent, Status, Notes
export function buildRow(c: CleanSubmission, now: Date): string[] {
  const sexColor = [c.sexPreference, c.colorPreference].filter(Boolean).join(' / ');
  return [
    now.toISOString(),
    c.locale,
    c.name,
    c.email,
    c.preferredChannel,
    c.contactValue,
    c.country,
    c.city,
    classLabel(c.interestClass),
    breedLabel(c.breedPreference),
    sexColor,
    c.timing,
    c.videoCallReady ? 'Yes' : 'No',
    c.sourceChannel,
    c.homeExperience,
    c.wishes,
    'Yes', // GDPRConsent (validated true before reaching here)
    '', // Status — Elvira owns
    '', // Notes — Elvira owns
  ];
}

export async function appendToSheet(env: Env, clean: CleanSubmission, now: Date): Promise<SendResult> {
  if (!env.GOOGLE_SERVICE_ACCOUNT_EMAIL || !env.GOOGLE_PRIVATE_KEY || !env.GOOGLE_SHEET_ID) {
    return { status: 'skipped', reason: 'google sheet not configured' };
  }
  try {
    const token = await getAccessToken(env, now);
    const range = env.GOOGLE_SHEET_RANGE || DEFAULT_RANGE;
    const url =
      `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(env.GOOGLE_SHEET_ID)}` +
      `/values/${encodeURIComponent(range)}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: [buildRow(clean, now)] }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { status: 'error', detail: `sheets ${res.status}: ${detail.slice(0, 300)}` };
    }
    return { status: 'ok' };
  } catch (err) {
    return { status: 'error', detail: `sheet append failed: ${String(err).slice(0, 200)}` };
  }
}
