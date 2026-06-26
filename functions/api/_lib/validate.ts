// Pure validation + normalization. No I/O — fully unit-testable.
import type {
  RawSubmission,
  CleanSubmission,
  ValidationResult,
  Locale,
  InterestClass,
  PreferredChannel,
} from './types.ts';
import { LOCALES } from './types.ts';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Length caps — defensive against oversized payloads reaching email/Sheet.
const MAX = {
  name: 120,
  email: 160,
  contactValue: 160,
  country: 80,
  city: 80,
  short: 120, // color
  long: 2000, // homeExperience, wishes
};

const CHANNELS: PreferredChannel[] = ['whatsapp', 'telegram', 'instagram', 'email', 'phone'];
const CLASSES: InterestClass[] = ['pet', 'breeding_show', 'not_sure'];

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : '';
}

function clamp(v: string, max: number): string {
  return v.length > max ? v.slice(0, max) : v;
}

function asBool(v: unknown): boolean {
  return v === true || v === 'true' || v === 1 || v === '1';
}

function asLocale(v: unknown): Locale {
  const s = str(v);
  return (LOCALES as string[]).includes(s) ? (s as Locale) : 'en';
}

/**
 * Required-minimal validation (matches Gate 1 form):
 *   name, email, preferredChannel, contactValue, country, interestClass, gdprConsent.
 * City is optional. All preference fields are optional.
 * Returns the list of invalid required fields and a normalized payload when valid.
 */
export function validateSubmission(raw: RawSubmission): ValidationResult {
  const fields: string[] = [];

  const name = clamp(str(raw.name), MAX.name);
  if (!name) fields.push('name');

  const email = clamp(str(raw.email), MAX.email);
  if (!email || !EMAIL_RE.test(email)) fields.push('email');

  const channelRaw = str(raw.preferredChannel) as PreferredChannel;
  const preferredChannel = CHANNELS.includes(channelRaw) ? channelRaw : ('' as PreferredChannel);
  if (!preferredChannel) fields.push('preferredChannel');

  const contactValue = clamp(str(raw.contactValue), MAX.contactValue);
  if (!contactValue) fields.push('contactValue');

  const country = clamp(str(raw.country), MAX.country);
  if (!country) fields.push('country');

  const classRaw = str(raw.interestClass) as InterestClass;
  const interestClass = CLASSES.includes(classRaw) ? classRaw : ('' as InterestClass);
  if (!interestClass) fields.push('interestClass');

  const gdprConsent = asBool(raw.gdprConsent);
  const consentMissing = !gdprConsent;
  if (consentMissing) fields.push('gdprConsent');

  if (fields.length > 0) {
    return { ok: false, fields, consentMissing };
  }

  const clean: CleanSubmission = {
    locale: asLocale(raw.locale),
    name,
    email,
    preferredChannel,
    contactValue,
    country,
    city: clamp(str(raw.city), MAX.city),
    interestClass,
    breedPreference: clamp(str(raw.breedPreference), MAX.short),
    sexPreference: clamp(str(raw.sexPreference), MAX.short),
    colorPreference: clamp(str(raw.colorPreference), MAX.short),
    timing: clamp(str(raw.timing), MAX.short),
    videoCallReady: asBool(raw.videoCallReady),
    sourceChannel: clamp(str(raw.sourceChannel), MAX.short),
    homeExperience: clamp(str(raw.homeExperience), MAX.long),
    wishes: clamp(str(raw.wishes), MAX.long),
    gdprConsent: true,
  };

  return { ok: true, fields: [], consentMissing: false, clean };
}
