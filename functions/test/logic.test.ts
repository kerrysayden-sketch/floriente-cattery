// Pure-logic unit tests for the waitlist function. Run with:
//   npm run functions:test
// (node --experimental-strip-types --test) — no build step, no Cloudflare runtime.
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validateSubmission } from '../api/_lib/validate.ts';
import { buildSubject, classLabel, breedLabel, isoDate } from '../api/_lib/subject.ts';
import { checkHoneypot, MIN_FILL_MS } from '../api/_lib/antispam.ts';
import { autoReply } from '../api/_lib/emailCopy.ts';
import { buildRow } from '../api/_lib/sheet.ts';
import { LOCALES } from '../api/_lib/types.ts';

const validRaw = {
  locale: 'de',
  name: '  Anna K.  ',
  email: 'anna@example.com',
  preferredChannel: 'whatsapp',
  contactValue: '+49 170 1234567',
  country: 'DE',
  city: 'Berlin',
  interestClass: 'breeding_show',
  breedPreference: 'oriental',
  sexPreference: 'female',
  colorPreference: 'black',
  timing: 'flexible',
  videoCallReady: true,
  sourceChannel: 'instagram',
  homeExperience: 'First Oriental, indoor only',
  wishes: 'Prefer a vocal kitten',
  gdprConsent: true,
  company: '',
  ts: 1000,
};

test('valid submission normalizes and trims', () => {
  const r = validateSubmission(validRaw);
  assert.equal(r.ok, true);
  assert.ok(r.clean);
  assert.equal(r.clean!.name, 'Anna K.'); // trimmed
  assert.equal(r.clean!.locale, 'de');
  assert.equal(r.clean!.interestClass, 'breeding_show');
  assert.equal(r.clean!.videoCallReady, true);
  assert.equal(r.clean!.gdprConsent, true);
});

test('missing required fields are reported', () => {
  const r = validateSubmission({ gdprConsent: true });
  assert.equal(r.ok, false);
  for (const f of ['name', 'email', 'preferredChannel', 'contactValue', 'country', 'interestClass']) {
    assert.ok(r.fields.includes(f), `expected ${f} invalid`);
  }
  assert.equal(r.consentMissing, false); // consent WAS given
});

test('invalid email is rejected', () => {
  const r = validateSubmission({ ...validRaw, email: 'not-an-email' });
  assert.equal(r.ok, false);
  assert.ok(r.fields.includes('email'));
});

test('consent-only failure is flagged distinctly', () => {
  const r = validateSubmission({ ...validRaw, gdprConsent: false });
  assert.equal(r.ok, false);
  assert.deepEqual(r.fields, ['gdprConsent']);
  assert.equal(r.consentMissing, true);
});

test('invalid enum values are rejected', () => {
  const r = validateSubmission({ ...validRaw, preferredChannel: 'carrier-pigeon', interestClass: 'royalty' });
  assert.equal(r.ok, false);
  assert.ok(r.fields.includes('preferredChannel'));
  assert.ok(r.fields.includes('interestClass'));
});

test('subject matches the agreed structure', () => {
  const r = validateSubmission(validRaw);
  const subject = buildSubject(r.clean!, new Date('2026-06-26T10:00:00Z'));
  assert.equal(subject, '[WAITLIST] Breeding & Show · Oriental · DE · Anna K. · 2026-06-26');
});

test('class and breed labels (Breeding & Show, not Breed Show)', () => {
  assert.equal(classLabel('pet'), 'Pet Class');
  assert.equal(classLabel('breeding_show'), 'Breeding & Show');
  assert.equal(classLabel('not_sure'), 'Not sure');
  assert.equal(breedLabel('oriental'), 'Oriental');
  assert.equal(breedLabel('siamese'), 'Siamese');
  assert.equal(breedLabel(''), 'Any');
  assert.equal(isoDate(new Date('2026-07-01T23:59:59Z')), '2026-07-01');
});

test('honeypot field trips a silent drop', () => {
  const r = checkHoneypot({ ...validRaw, company: 'spammy' }, 100000);
  assert.equal(r.silentDrop, true);
  assert.equal(r.reason, 'honeypot');
});

test('too-fast fill trips a silent drop', () => {
  const now = 5000;
  const r = checkHoneypot({ ...validRaw, company: '', ts: now - (MIN_FILL_MS - 1) }, now);
  assert.equal(r.silentDrop, true);
  assert.equal(r.reason, 'fill_time');
});

test('a slow, clean fill is accepted', () => {
  const now = 100000;
  const r = checkHoneypot({ ...validRaw, company: '', ts: now - (MIN_FILL_MS + 1000) }, now);
  assert.equal(r.silentDrop, false);
});

test('missing ts is not treated as a bot on its own', () => {
  const r = checkHoneypot({ ...validRaw, company: '', ts: undefined }, 100000);
  assert.equal(r.silentDrop, false);
});

test('auto-reply copy exists for every locale', () => {
  for (const loc of LOCALES) {
    const c = autoReply[loc];
    assert.ok(c, `missing copy for ${loc}`);
    assert.ok(c.subject.length > 0);
    assert.ok(c.paragraphs.length >= 3);
    assert.ok(c.signature.length > 0);
  }
});

test('sheet row has 19 columns in the agreed order', () => {
  const r = validateSubmission(validRaw);
  const row = buildRow(r.clean!, new Date('2026-06-26T10:00:00Z'));
  assert.equal(row.length, 19);
  assert.equal(row[0], '2026-06-26T10:00:00.000Z'); // CreatedAt
  assert.equal(row[1], 'de'); // Locale
  assert.equal(row[2], 'Anna K.'); // Name
  assert.equal(row[8], 'Breeding & Show'); // Class
  assert.equal(row[10], 'female / black'); // SexColorPreference
  assert.equal(row[16], 'Yes'); // GDPRConsent
  assert.equal(row[17], ''); // Status (operator-owned)
  assert.equal(row[18], ''); // Notes (operator-owned)
});
