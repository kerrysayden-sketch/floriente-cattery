import { test, expect } from '@playwright/test';

// Smoke for the waitlist page. Checks each localized route renders, the form
// and its required controls are present, the GDPR consent links to the legal
// page, and the honeypot is hidden. One row per locale keeps it cheap to extend.

type Case = {
  lang: 'en' | 'uk' | 'pl' | 'de' | 'ru';
  url: string;
  /** Localized legal slug the consent link should point at. */
  legalSlug: string;
};

const CASES: Case[] = [
  { lang: 'en', url: '/en/kittens/waitlist/', legalSlug: 'legal' },
  { lang: 'uk', url: '/uk/koshenyata/waitlist/', legalSlug: 'legal' },
  { lang: 'pl', url: '/pl/kocieta/waitlist/', legalSlug: 'regulamin' },
  { lang: 'de', url: '/de/kitten/waitlist/', legalSlug: 'impressum' },
  { lang: 'ru', url: '/ru/kotyata/waitlist/', legalSlug: 'pravila' },
];

const REQUIRED_CONTROLS = [
  'name',
  'email',
  'preferredChannel',
  'contactValue',
  'country',
  'interestClass',
  'gdprConsent',
];

for (const c of CASES) {
  test.describe(`waitlist: ${c.lang}`, () => {
    test('page renders with form, required fields, consent link, hidden honeypot', async ({ page }) => {
      const response = await page.goto(c.url);
      expect(response?.status(), `${c.url} should return 200`).toBe(200);

      expect(await page.locator('html').getAttribute('lang')).toBe(c.lang);
      await expect(page.locator('h1').first()).toBeVisible();

      // Form present
      const form = page.locator('#waitlist-form');
      await expect(form).toBeAttached();

      // Every required control exists
      for (const name of REQUIRED_CONTROLS) {
        await expect(
          form.locator(`[name="${name}"]`).first(),
          `required control "${name}" must exist`,
        ).toBeAttached();
      }

      // GDPR consent links to the localized legal page
      const consentLink = form.locator(`a[href*="/${c.lang}/${c.legalSlug}/"]`);
      await expect(consentLink).toBeAttached();

      // Honeypot is present but off-screen (standard technique: NOT display:none,
      // so bots that fill all rendered fields still trip it — hence "not in viewport"
      // rather than "hidden").
      const honeypot = form.locator('[data-honeypot]');
      await expect(honeypot).toBeAttached();
      await expect(honeypot).not.toBeInViewport();

      // Submit button present
      await expect(page.locator('#waitlist-submit')).toBeVisible();
    });
  });
}
