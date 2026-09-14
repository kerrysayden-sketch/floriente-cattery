import { getCollection, getEntry, type CollectionEntry } from 'astro:content';
import { t, getLocalizedPath, locales } from '../i18n/utils';
import type { Lang } from '../i18n/utils';

export type KittenEntry = CollectionEntry<'kittens'>;
export type KittenCopyEntry = CollectionEntry<'kittenCopy'>;
export type CommercialStatus = NonNullable<KittenEntry['data']['commercialStatus']>;

/**
 * Kitten runtime gateway.
 *
 * Every public kitten path goes through this module. The publication filter
 * lives here once, so no component can forget it: `getPublishedKittens()` is
 * the only exported way to reach kitten data, and a `draft` entity never
 * leaves it. Nothing else in the codebase calls `getCollection('kittens')`.
 *
 * The three state dimensions stay independent:
 *   publicationState  — the ONLY thing that decides whether a kitten exists publicly
 *   commercialStatus  — presentation only; never gates routing or exposure
 *   featuredInKittensPreview — the ONLY thing that decides KittensPreview membership
 */

/** Every published kitten, in deterministic workbook order. Drafts never escape. */
export async function getPublishedKittens(): Promise<KittenEntry[]> {
  const all = await getCollection('kittens');
  return all
    .filter((k) => k.data.publicationState === 'published')
    .sort((a, b) =>
      a.data.litter.localeCompare(b.data.litter) ||
      a.data.source.workbookRow - b.data.source.workbookRow);
}

/** Published kittens of one litter, e.g. the Litter C block on the listing page. */
export async function getPublishedKittensByLitter(litter: KittenEntry['data']['litter']) {
  return (await getPublishedKittens()).filter((k) => k.data.litter === litter);
}

/**
 * Members of the optional KittensPreview block on the kittens listing page.
 *
 * Despite its name and its `components/home/` location, KittensPreview is not
 * rendered by HomePage.astro — its only mount point is KittensListPage. The
 * field is named accordingly.
 *
 * `featuredInKittensPreview` is the only editorial switch; publication is a
 * precondition, never a trigger. Commercial status is deliberately not
 * consulted — a reserved kitten may be featured, an available one may not be.
 */
export async function getPreviewFeaturedKittens(): Promise<KittenEntry[]> {
  return (await getPublishedKittens()).filter((k) => k.data.featuredInKittensPreview);
}

/** Localized copy for one kitten, or undefined when it has not been written. */
export async function getKittenCopy(kittenId: string, lang: Lang): Promise<KittenCopyEntry | undefined> {
  return await getEntry('kittenCopy', `${kittenId}-${lang}`);
}

/**
 * Build-time publication gate. A published kitten must have copy in all five
 * locales: this site has no silent English fallback, and a half-translated
 * kitten page is worse than a build that says exactly what is missing.
 * Mirrors `npm run kittens:check -- --require-copy`.
 */
export async function assertPublishedKittensHaveCopy(kittens: KittenEntry[]): Promise<void> {
  const missing: string[] = [];
  for (const kitten of kittens) {
    for (const lang of locales) {
      if (!(await getKittenCopy(kitten.data.kittenId, lang))) missing.push(`${kitten.data.kittenId}-${lang}`);
    }
  }
  if (missing.length) {
    throw new Error(
      `Published kitten(s) missing localized copy (${missing.length}): ${missing.join(', ')}.\n` +
      `Add src/content/kitten-copy/<kittenId>-<lang>.md for each, or set publicationState back to "draft".\n` +
      `Placeholder or machine-translated filler is not an acceptable fix.`,
    );
  }
}

/** Locale-invariant kitten sub-slug under the localized kittens route. */
export function kittenDetailPath(kittenId: string, lang: Lang): string {
  return getLocalizedPath(`/kittens/${kittenId}/`, lang);
}

/** The kitten's owner-chosen hero frame, with the first image as a structural fallback. */
export function kittenHeroImage(kitten: KittenEntry) {
  const n = kitten.data.heroImage;
  return kitten.data.images.find((i) => i.n === n) ?? kitten.data.images[0];
}

/**
 * Name Strategy C: the primary customer-facing name in every locale is the
 * Latin passport FIRST name — Chanel, Churchill, Cai, Cia, Caramel, Chipa.
 *
 * Derived from `passportName` rather than stored twice, so there is one source
 * of truth. The schema refines that this first word equals `kittenId`, so a
 * future mismatch fails the build instead of rendering the wrong name.
 */
export function kittenDisplayName(kitten: KittenEntry): string {
  return kitten.data.passportName.trim().split(/\s+/)[0];
}

// Normalized documents labels. The verbatim workbook wording (which carries an
// internal breeder reference and the pet/breeding restriction) stays in
// `source.documentRaw` and is never rendered.
const DOCUMENTS_KEY = {
  metrics: 'kittens.docMetrics',
  pedigree: 'kittens.docPedigree',
} as const;

/** Localized documents label, or null when not stated — null renders no line. */
export function documentsLabel(
  documents: KittenEntry['data']['documents'],
  lang: Lang,
): string | null {
  return documents ? t(lang, DOCUMENTS_KEY[documents]) : null;
}

// Commercial status labels resolve through the normal i18n mechanism, so
// `npm run i18n:check` enforces all five locales and a raw token such as
// "at_new_home" can never reach a visitor.
const STATUS_KEY: Record<CommercialStatus, string> = {
  available: 'kittens.statusAvailableSingle',
  reserved: 'kittens.statusReservedSingle',
  evaluation: 'kittens.statusEvaluation',
  at_new_home: 'kittens.atNewHome',
};

const STATUS_COLOR: Record<CommercialStatus, string> = {
  available: 'bg-status-available',
  reserved: 'bg-status-reserved',
  evaluation: 'bg-status-evaluation',
  at_new_home: 'bg-status-home',
};

/** Localized label, or null when no status is stated — null renders no badge. */
export function commercialStatusLabel(status: CommercialStatus | null | undefined, lang: Lang): string | null {
  return status ? t(lang, STATUS_KEY[status]) : null;
}

export function commercialStatusColor(status: CommercialStatus | null | undefined): string {
  return status ? STATUS_COLOR[status] : 'bg-gray-medium';
}
