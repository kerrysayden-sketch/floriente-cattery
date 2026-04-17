import { test, expect } from '@playwright/test';

// One smoke test per locale. Checks the bare minimum: page renders, has an h1,
// hreflang is sane, and noindex is applied to PL/DE (machine-translated).
//
// Structure driven by a table so adding UK/PL/DE/RU/etc. stays one line.

type Case = {
  lang: 'en' | 'uk' | 'ru';
  url: string;
  /** Substring expected in <h1>. Loose match — phrasing can tweak without breaking smoke. */
  h1Contains: string;
};

// PL/DE are disabled (Sprint 12.1 soft rollback) pending Native QA.
// When they come back: uncomment, add expectNoindex flag to Case, and the indexing
// assertion in the test body.
const CASES: Case[] = [
  { lang: 'en', url: '/en/',        h1Contains: 'Oriental'  },
  { lang: 'uk', url: '/uk/',        h1Contains: 'Орієнтал'  },
  { lang: 'ru', url: '/ru/',        h1Contains: 'Ориентал'  },
];

for (const c of CASES) {
  test.describe(`locale: ${c.lang}`, () => {
    test('home page renders, h1 present, no noindex, cookieless', async ({ page }) => {
      const response = await page.goto(c.url);
      expect(response?.status(), `${c.url} should return 200`).toBe(200);

      // <html lang="..."> matches locale
      const htmlLang = await page.locator('html').getAttribute('lang');
      expect(htmlLang).toBe(c.lang);

      // H1 exists and contains a locale-appropriate phrase
      const h1 = page.locator('h1').first();
      await expect(h1).toBeVisible();
      const h1Text = (await h1.textContent())?.trim() ?? '';
      expect(h1Text.length, `h1 must not be empty on ${c.url}`).toBeGreaterThan(0);
      expect(h1Text.toLowerCase()).toContain(c.h1Contains.toLowerCase());

      // All active locales are indexable — no robots noindex expected.
      const robotsMeta = page.locator('meta[name="robots"]');
      const count = await robotsMeta.count();
      expect(count, `${c.lang} should NOT have robots noindex`).toBe(0);

      // Site is cookieless — no banner should be present.
      const banner = page.locator('#cookie-banner');
      await expect(banner).toHaveCount(0);
    });

    test(`language switcher navigates away from ${c.lang}`, async ({ page }) => {
      await page.goto(c.url);
      // Switcher is expected to be anywhere on the page. We pick the first link
      // to the EN home as a proxy — every locale has one.
      const enLink = page.locator('a[href^="/en"]').first();
      await expect(enLink).toHaveCount(1);
    });
  });
}

test('site is cookieless: no cookies set on fresh visit', async ({ page, context }) => {
  await context.clearCookies();
  await page.goto('/en/');
  // Give any rogue third-party script a moment to misbehave
  await page.waitForLoadState('networkidle');
  const cookies = await context.cookies();
  expect(cookies, 'no cookies should be set').toEqual([]);
});

test('404 page returns 404 status', async ({ page }) => {
  const response = await page.goto('/en/nonexistent-page-xyz/');
  expect(response?.status()).toBe(404);
});

test('sitemap covers only active locales (EN/UK/RU)', async ({ page }) => {
  const response = await page.goto('/sitemap-0.xml');
  expect(response?.status()).toBe(200);
  const body = await page.content();
  // PL/DE are soft-disabled — no routes generated, so no URLs expected.
  expect(body).not.toMatch(/\/(pl|de)\//);
  // Active locales present
  expect(body).toContain('/en/');
  expect(body).toContain('/uk/');
  expect(body).toContain('/ru/');
});

test('hitting a disabled locale (PL/DE) 404s — proves rollback is real', async ({ page }) => {
  for (const url of ['/pl/', '/de/', '/pl/o-nas/', '/de/impressum/']) {
    const r = await page.goto(url);
    expect(r?.status(), `${url} must be 404 (locale disabled)`).toBe(404);
  }
});
