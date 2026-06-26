// Resend email: notification to Elvira + localized auto-reply to the applicant.
import type { Env, CleanSubmission } from './types.ts';
import { classLabel, breedLabel } from './subject.ts';
import { autoReply } from './emailCopy.ts';

// Outcome shared by notify / autoreply / sheet so the handler can decide:
//   ok      → succeeded
//   skipped → not configured (degrade in dev/preview)
//   error   → configured but failed (notify=error → 500)
export type SendResult =
  | { status: 'ok'; id?: string }
  | { status: 'skipped'; reason: string }
  | { status: 'error'; detail: string };

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

interface ResendMessage {
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  reply_to?: string;
}

async function sendViaResend(apiKey: string, msg: ResendMessage): Promise<SendResult> {
  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(msg),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => '');
      return { status: 'error', detail: `resend ${res.status}: ${detail.slice(0, 300)}` };
    }
    const data = (await res.json().catch(() => ({}))) as { id?: string };
    return { status: 'ok', id: data.id };
  } catch (err) {
    return { status: 'error', detail: `resend fetch failed: ${String(err).slice(0, 200)}` };
  }
}

// Build the notification body — a labelled table of every field for triage.
function notificationHtml(c: CleanSubmission): string {
  const rows: [string, string][] = [
    ['Name', c.name],
    ['Email', c.email],
    ['Preferred channel', c.preferredChannel],
    ['Contact', c.contactValue],
    ['Country', c.country],
    ['City', c.city],
    ['Class', classLabel(c.interestClass)],
    ['Breed preference', breedLabel(c.breedPreference)],
    ['Sex preference', c.sexPreference],
    ['Colour preference', c.colorPreference],
    ['Timing', c.timing],
    ['Video call ready', c.videoCallReady ? 'Yes' : 'No'],
    ['Source channel', c.sourceChannel],
    ['Experience / home', c.homeExperience],
    ['Wishes', c.wishes],
    ['Locale', c.locale],
    ['GDPR consent', 'Yes'],
  ];
  const body = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#666;vertical-align:top;white-space:nowrap">${escapeHtml(
          k,
        )}</td><td style="padding:4px 0">${escapeHtml(v) || '—'}</td></tr>`,
    )
    .join('');
  return `<div style="font-family:system-ui,Arial,sans-serif;font-size:14px;color:#222"><table style="border-collapse:collapse">${body}</table></div>`;
}

function notificationText(c: CleanSubmission): string {
  return [
    `Name: ${c.name}`,
    `Email: ${c.email}`,
    `Preferred channel: ${c.preferredChannel}`,
    `Contact: ${c.contactValue}`,
    `Country: ${c.country}`,
    `City: ${c.city}`,
    `Class: ${classLabel(c.interestClass)}`,
    `Breed preference: ${breedLabel(c.breedPreference)}`,
    `Sex preference: ${c.sexPreference}`,
    `Colour preference: ${c.colorPreference}`,
    `Timing: ${c.timing}`,
    `Video call ready: ${c.videoCallReady ? 'Yes' : 'No'}`,
    `Source channel: ${c.sourceChannel}`,
    `Experience / home: ${c.homeExperience}`,
    `Wishes: ${c.wishes}`,
    `Locale: ${c.locale}`,
    `GDPR consent: Yes`,
  ].join('\n');
}

export async function sendNotification(
  env: Env,
  clean: CleanSubmission,
  subject: string,
): Promise<SendResult> {
  if (!env.RESEND_API_KEY || !env.WAITLIST_FROM || !env.WAITLIST_NOTIFY_TO) {
    return { status: 'skipped', reason: 'resend not configured' };
  }
  return sendViaResend(env.RESEND_API_KEY, {
    from: env.WAITLIST_FROM,
    to: [env.WAITLIST_NOTIFY_TO],
    subject,
    html: notificationHtml(clean),
    text: notificationText(clean),
    reply_to: clean.email, // Elvira can reply straight to the applicant
  });
}

export async function sendAutoReply(env: Env, clean: CleanSubmission): Promise<SendResult> {
  if (!env.RESEND_API_KEY || !env.WAITLIST_FROM) {
    return { status: 'skipped', reason: 'resend not configured' };
  }
  const copy = autoReply[clean.locale];
  const text = `${copy.paragraphs.join('\n\n')}\n\n${copy.signature}`;
  const html = `<div style="font-family:system-ui,Arial,sans-serif;font-size:15px;color:#222;line-height:1.5">${copy.paragraphs
    .map((p) => `<p>${escapeHtml(p)}</p>`)
    .join('')}<p style="white-space:pre-line">${escapeHtml(copy.signature)}</p></div>`;
  return sendViaResend(env.RESEND_API_KEY, {
    from: env.WAITLIST_FROM,
    to: [clean.email],
    subject: copy.subject,
    html,
    text,
  });
}
