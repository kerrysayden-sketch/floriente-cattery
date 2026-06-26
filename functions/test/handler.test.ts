// Handler-level tests for the production-safety amendment. Exercises onRequest
// in Node (real Request/Response) with a mocked global fetch so no network is hit.
//   npm run functions:test  (covers this file too)
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { onRequest } from '../api/waitlist.ts';
import type { Env } from '../api/_lib/types.ts';

const VALID = {
  locale: 'en',
  name: 'Test User',
  email: 'test@example.com',
  preferredChannel: 'whatsapp',
  contactValue: '+49170',
  country: 'DE',
  interestClass: 'pet',
  gdprConsent: true,
  company: '',
  ts: 1, // far in the past → passes the fill-time check
};

function makeRequest(body: unknown): Request {
  return new Request('http://localhost/api/waitlist', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
}

// Install a fetch stub; returns a restore fn + a call counter.
function mockFetch(handler: (url: string) => Response) {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async (input: unknown) => {
    calls++;
    const url = typeof input === 'string' ? input : String((input as { url?: string }).url ?? input);
    return handler(url);
  }) as typeof fetch;
  return {
    restore: () => {
      globalThis.fetch = original;
    },
    count: () => calls,
  };
}

const RESEND_ENV: Env = {
  RESEND_API_KEY: 'test-key',
  WAITLIST_FROM: 'Floriente <waitlist@florientecattery.com>',
  WAITLIST_NOTIFY_TO: 'info@florientecattery.com',
};

test('degraded mode: valid POST returns 200 with notify skipped (no fetch)', async () => {
  const fx = mockFetch(() => new Response('should-not-be-called', { status: 500 }));
  try {
    const env: Env = { WAITLIST_ALLOW_DEGRADED: 'true' }; // no email creds
    const res = await onRequest({ request: makeRequest(VALID), env });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.equal(fx.count(), 0, 'no email send should be attempted when unconfigured');
  } finally {
    fx.restore();
  }
});

test('production (strict default): missing notify config returns 500 config', async () => {
  const fx = mockFetch(() => new Response('should-not-be-called', { status: 500 }));
  try {
    const env: Env = {}; // no flag → strict; no email creds
    const res = await onRequest({ request: makeRequest(VALID), env });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: 'config' });
    assert.equal(fx.count(), 0);
  } finally {
    fx.restore();
  }
});

test('production (strict) + notify configured: send succeeds → 200', async () => {
  const fx = mockFetch((url) => {
    assert.ok(url.includes('api.resend.com'), `unexpected fetch to ${url}`);
    return new Response(JSON.stringify({ id: 'mock-id' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
  });
  try {
    const env: Env = { ...RESEND_ENV }; // configured, strict (no degraded flag)
    const res = await onRequest({ request: makeRequest(VALID), env });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.ok(fx.count() >= 1, 'notification email should be attempted');
  } finally {
    fx.restore();
  }
});

test('production (strict) + notify configured but send fails → 500 server', async () => {
  const fx = mockFetch(() => new Response('resend down', { status: 502 }));
  try {
    const env: Env = { ...RESEND_ENV };
    const res = await onRequest({ request: makeRequest(VALID), env });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: 'server' });
  } finally {
    fx.restore();
  }
});

test('validation/consent still enforced before the mode check', async () => {
  const env: Env = {}; // strict
  const res422 = await onRequest({ request: makeRequest({ gdprConsent: true }), env });
  assert.equal(res422.status, 422); // missing required fields beats the notify gate
  const res400 = await onRequest({ request: makeRequest({ ...VALID, gdprConsent: false }), env });
  assert.equal(res400.status, 400);
  assert.deepEqual(await res400.json(), { ok: false, error: 'consent' });
});
