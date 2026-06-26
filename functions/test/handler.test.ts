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

// Fake D1 binding: records bound values; run() succeeds unless { fail: true }.
function fakeDb(opts: { fail?: boolean } = {}) {
  const calls: unknown[][] = [];
  const stmt = {
    bind(...vals: unknown[]) {
      calls.push(vals);
      return stmt;
    },
    async run() {
      return opts.fail ? { success: false, error: 'boom' } : { success: true };
    },
  };
  return { db: { prepare: (_sql: string) => stmt }, calls };
}

const okResend = () =>
  new Response(JSON.stringify({ id: 'mock-id' }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });

test('degraded mode: valid POST returns 200 with notify + store skipped (no fetch)', async () => {
  const fx = mockFetch(() => new Response('should-not-be-called', { status: 500 }));
  try {
    const env: Env = { WAITLIST_ALLOW_DEGRADED: 'true' }; // no email creds, no D1 binding
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

test('production (strict) + notify configured + D1 bound: → 200, insert attempted', async () => {
  const fx = mockFetch((url) => {
    assert.ok(url.includes('api.resend.com'), `unexpected fetch to ${url}`);
    return okResend();
  });
  const db = fakeDb();
  try {
    const env: Env = { ...RESEND_ENV, WAITLIST_DB: db.db }; // configured, strict, D1 bound
    const res = await onRequest({ request: makeRequest(VALID), env });
    assert.equal(res.status, 200);
    assert.deepEqual(await res.json(), { ok: true });
    assert.ok(fx.count() >= 1, 'notification email should be attempted');
    assert.equal(db.calls.length, 1, 'exactly one D1 insert');
    assert.equal(db.calls[0].length, 20, 'D1 insert binds 20 values');
  } finally {
    fx.restore();
  }
});

test('production (strict) + notify ok + D1 binding MISSING → 500 storage', async () => {
  const fx = mockFetch(okResend);
  try {
    const env: Env = { ...RESEND_ENV }; // notify configured, NO D1 binding, strict
    const res = await onRequest({ request: makeRequest(VALID), env });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: 'storage' });
  } finally {
    fx.restore();
  }
});

test('production (strict) + notify ok + D1 insert FAILS → 500 storage', async () => {
  const fx = mockFetch(okResend);
  const db = fakeDb({ fail: true });
  try {
    const env: Env = { ...RESEND_ENV, WAITLIST_DB: db.db };
    const res = await onRequest({ request: makeRequest(VALID), env });
    assert.equal(res.status, 500);
    assert.deepEqual(await res.json(), { ok: false, error: 'storage' });
    assert.equal(db.calls.length, 1, 'insert was attempted');
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
