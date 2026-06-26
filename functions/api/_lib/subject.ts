// Structured notification subject + display-label helpers. Pure.
import type { CleanSubmission, InterestClass } from './types.ts';

// Display labels (English, for Elvira's inbox triage — consistent regardless of
// the applicant's locale). "Breeding & Show" per the agreed terminology.
const CLASS_LABEL: Record<InterestClass, string> = {
  pet: 'Pet Class',
  breeding_show: 'Breeding & Show',
  not_sure: 'Not sure',
};

const BREED_LABEL: Record<string, string> = {
  oriental: 'Oriental',
  siamese: 'Siamese',
  no_pref: 'Any',
  '': 'Any',
};

export function classLabel(c: InterestClass): string {
  return CLASS_LABEL[c] ?? 'Not sure';
}

export function breedLabel(b: string): string {
  return BREED_LABEL[b] ?? b;
}

// Source-channel display labels (English, for the notification). Only values that
// benefit from a friendlier form are mapped; anything else shows its raw value.
const SOURCE_LABEL: Record<string, string> = {
  ai_assistant: 'AI assistant (ChatGPT, Claude, etc.)',
};

export function sourceLabel(s: string): string {
  return SOURCE_LABEL[s] ?? s;
}

// YYYY-MM-DD in UTC. Date injected for deterministic tests.
export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

/**
 * [WAITLIST] {Class} · {Breed} · {Country} · {Name} · {YYYY-MM-DD}
 * The `[WAITLIST]` tag is the Gmail-filter anchor; the segments let Elvira sort
 * by class/breed/country without opening each email.
 */
export function buildSubject(clean: CleanSubmission, now: Date): string {
  const parts = [
    classLabel(clean.interestClass),
    breedLabel(clean.breedPreference),
    clean.country,
    clean.name,
    isoDate(now),
  ];
  return `[WAITLIST] ${parts.join(' · ')}`;
}
