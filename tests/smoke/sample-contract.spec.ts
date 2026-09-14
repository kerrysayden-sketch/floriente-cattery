import { test, expect } from '@playwright/test';

// Smoke coverage for the Sample Pet-Class Contract page and its PDF.
//
// The page is the only surface that links directly to the PDF; every other
// surface links to the page. The PDF is noindex (public/_headers) so it can
// never outrank the page it belongs to — that header is served by Cloudflare
// Pages and is therefore asserted in the deployed-preview check, not here.

type Case = {
  lang: 'en' | 'uk' | 'pl' | 'de' | 'ru';
  /** Localized slug, as declared in src/i18n/slugs.ts. */
  slug: string;
  /** Substring expected in the <h1>. Loose match — phrasing can tweak. */
  h1Contains: string;
};

const CASES: Case[] = [
  { lang: 'en', slug: 'sample-contract',   h1Contains: 'Sample Pet-Class' },
  { lang: 'uk', slug: 'zrazok-dohovoru',   h1Contains: 'Зразок договору'  },
  { lang: 'pl', slug: 'wzor-umowy',        h1Contains: 'Wzór umowy'       },
  { lang: 'de', slug: 'mustervertrag',     h1Contains: 'Muster-Kaufvertrag' },
  { lang: 'ru', slug: 'obrazets-dogovora', h1Contains: 'Образец договора' },
];

const PDF_PATH = '/documents/floriente-sample-pet-class-kitten-sale-contract.pdf';

for (const c of CASES) {
  const url = `/${c.lang}/${c.slug}/`;

  test(`sample contract ${c.lang}: 200, correct h1, indexable`, async ({ page }) => {
    const response = await page.goto(url);
    expect(response?.status(), `${url} should return 200`).toBe(200);

    expect(await page.locator('html').getAttribute('lang')).toBe(c.lang);

    const h1 = page.locator('h1').first();
    await expect(h1).toBeVisible();
    expect((await h1.textContent())?.trim()).toContain(c.h1Contains);

    // The PAGE must be indexable — only the PDF is noindex.
    await expect(page.locator('meta[name="robots"]')).toHaveCount(0);

    // Self-canonical.
    const canonical = await page.locator('link[rel="canonical"]').getAttribute('href');
    expect(canonical).toBe(`https://florientecattery.com${url}`);
  });

  test(`sample contract ${c.lang}: hreflang 5 locales + x-default`, async ({ page }) => {
    await page.goto(url);
    for (const other of CASES) {
      const href = await page
        .locator(`link[rel="alternate"][hreflang="${other.lang}"]`)
        .getAttribute('href');
      expect(href, `${c.lang} page must point hreflang=${other.lang} at its own slug`)
        .toBe(`https://florientecattery.com/${other.lang}/${other.slug}/`);
    }
    const xdefault = await page
      .locator('link[rel="alternate"][hreflang="x-default"]')
      .getAttribute('href');
    expect(xdefault).toBe('https://florientecattery.com/en/sample-contract/');
  });

  test(`sample contract ${c.lang}: links to the PDF exactly once`, async ({ page }) => {
    await page.goto(url);
    await expect(page.locator(`a[href="${PDF_PATH}"]`)).toHaveCount(1);
  });
}

test('language switcher preserves page identity across all five slugs', async ({ page }) => {
  // Start on EN and walk every locale via its own alternate, confirming the
  // switcher keeps the visitor on the Sample Contract page rather than dropping
  // them on the home page.
  for (const c of CASES) {
    await page.goto('/en/sample-contract/');
    const href = await page
      .locator(`link[rel="alternate"][hreflang="${c.lang}"]`)
      .getAttribute('href');
    const path = new URL(href!).pathname;
    expect(path).toBe(`/${c.lang}/${c.slug}/`);

    const response = await page.goto(path);
    expect(response?.status(), `${path} must resolve`).toBe(200);
    expect(await page.locator('html').getAttribute('lang')).toBe(c.lang);
  }
});

test('sample contract PDF: 200 and application/pdf', async ({ request }) => {
  const response = await request.get(PDF_PATH);
  expect(response.status()).toBe(200);
  expect(response.headers()['content-type']).toContain('application/pdf');
});

test('sample contract PDF: privacy guard — no private data in the served file', async ({ request }) => {
  const response = await request.get(PDF_PATH);
  expect(response.status()).toBe(200);
  const body = await response.body();
  // Raw bytes, not just the text layer: catches metadata and any uncompressed
  // string. These four must never ship in a public sample.
  for (const forbidden of ['UA94', '3346915969', 'Aviator', 'Авіатор']) {
    expect(
      body.includes(Buffer.from(forbidden, 'utf-8')),
      `served PDF must not contain ${forbidden}`,
    ).toBe(false);
  }
});

test('sitemap contains all five sample-contract URLs', async ({ request }) => {
  const response = await request.get('/sitemap-0.xml');
  expect(response.status()).toBe(200);
  const xml = await response.text();
  for (const c of CASES) {
    expect(xml, `sitemap must list /${c.lang}/${c.slug}/`)
      .toContain(`https://florientecattery.com/${c.lang}/${c.slug}/`);
  }
  // The PDF is not a sitemap target.
  expect(xml).not.toContain(PDF_PATH);
});

test('inbound links resolve to the localized page, never straight to the PDF', async ({ page }) => {
  // How to Buy carries the two primary entry points; neither may link the file.
  const howToBuy: Record<string, string> = {
    en: '/en/how-to-buy/',
    uk: '/uk/yak-prydbanty/',
    pl: '/pl/jak-kupic/',
    de: '/de/kitten-kaufen/',
    ru: '/ru/kak-kupit/',
  };
  for (const c of CASES) {
    await page.goto(howToBuy[c.lang]);
    // Scoped to <main>: the footer carries a site-wide link on every page.
    await expect(
      page.locator(`main a[href="/${c.lang}/${c.slug}/"]`),
      `${c.lang} How to Buy should carry both sample-contract links`,
    ).toHaveCount(2);
    await expect(
      page.locator(`a[href="${PDF_PATH}"]`),
      `${c.lang} How to Buy must not link the PDF directly`,
    ).toHaveCount(0);
  }
});

test('footer, FAQ, kitten detail and the verify article link to the page', async ({ page }) => {
  // Footer (present on every page) — checked on the EN home.
  await page.goto('/en/');
  await expect(page.locator('footer a[href="/en/sample-contract/"]')).toHaveCount(1);

  // The three remaining surfaces are scoped to <main>, since the site-wide
  // footer link would otherwise inflate every count by one.

  // FAQ — link appended to the corrected deposit answer.
  await page.goto('/en/faq/');
  await expect(page.locator('main a[href="/en/sample-contract/"]')).toHaveCount(1);

  // Kitten detail — one muted secondary link, additive to the existing CTA.
  await page.goto('/en/kittens/chanel/');
  await expect(page.locator('main a[href="/en/sample-contract/"]')).toHaveCount(1);

  // Blog verification article — link added with the corrected claim.
  await page.goto('/en/blog/how-to-verify-cattery/');
  await expect(page.locator('main a[href="/en/sample-contract/"]')).toHaveCount(1);
});

test('no sample-contract link on the excluded surfaces', async ({ page }) => {
  // Homepage, kittens listing, waitlist and contact must carry no link in the
  // page body. The footer link is site-wide and is excluded from the count.
  for (const path of ['/en/', '/en/kittens/', '/en/kittens/waitlist/', '/en/contact/']) {
    await page.goto(path);
    const inBody = page.locator('main a[href="/en/sample-contract/"]');
    await expect(inBody, `${path} must not link the sample contract outside the footer`).toHaveCount(0);
  }
});
