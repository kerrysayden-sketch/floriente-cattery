import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const cats = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/cats' }),
  schema: z.object({
    catId: z.string(),
    lang: z.enum(['en', 'uk', 'pl', 'de', 'ru']),
    name: z.string(),
    fullName: z.string(),
    role: z.enum(['king', 'queen']),
    titles: z.string().default(''),
    breed: z.string(),
    ems: z.string(),
    dob: z.string(),
    breeder: z.string().default(''),
    pedigree: z.string().default(''),
    mainPhoto: z.string(),
    gallery: z.array(z.object({ src: z.string(), labelKey: z.string() })),
  }),
});

const testimonials = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/testimonials' }),
  schema: z.object({
    testimonialId: z.string(),
    lang: z.enum(['en', 'uk', 'pl', 'de', 'ru']),
    owner: z.string(),
    kitten: z.string(),
    photo: z.string().nullable(),
    order: z.number(),
  }),
});

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    articleSlug: z.string(),
    lang: z.enum(['en', 'uk', 'pl', 'de', 'ru']),
    title: z.string(),
    description: z.string(),
    category: z.string(),
    publishDate: z.string(),
    ogImage: z.string().optional(),
  }),
});

const faq = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/faq' }),
  schema: z.object({
    lang: z.enum(['en', 'uk', 'pl', 'de', 'ru']),
    categories: z.array(z.object({
      title: z.string(),
      items: z.array(z.object({
        q: z.string(),
        a: z.string(),
      })),
    })),
  }),
});

const legal = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/legal' }),
  schema: z.object({
    lang: z.enum(['en', 'uk', 'pl', 'de', 'ru']),
    lastUpdated: z.string(),
    sections: z.array(z.object({
      id: z.string(),
      title: z.string(),
      subsections: z.array(z.object({
        title: z.string(),
        text: z.string(),
      })),
    })),
  }),
});

// ─────────────────────────────────────────────────────────────────────────────
// Kittens (Litter C onward). Normalised model, introduced in WU-1.
//
// `kittens`    = ONE invariant entity per kitten. Facts, images, availability
//                and preview membership live here exactly once, so a state flip
//                or a hero pick is a single edit and cannot drift between
//                locales. Litters A and B are untouched historical content and
//                deliberately stay hardcoded in KittensListPage.astro.
// `kittenCopy` = the genuinely localized layer, one file per kitten per locale,
//                description in the markdown body. Intentionally EMPTY until the
//                copy work unit: the build's "No files found" notice for this
//                collection is the expected signal that copy is still missing.
//                No placeholder text is added to satisfy the schema.
// ─────────────────────────────────────────────────────────────────────────────

const LOCALES = ['en', 'uk', 'pl', 'de', 'ru'] as const;

const kittens = defineCollection({
  loader: glob({ pattern: '**/*.yaml', base: './src/content/kittens' }),
  schema: z.object({
    kittenId: z.string(),
    litter: z.enum(['c']),

    // §1.3 homeName is the primary customer-facing name; passportName is
    // official metadata. Both are preserved distinctly and never translated.
    homeName: z.string(),
    passportName: z.string(),
    passportNameRu: z.string().default(''),

    breed: z.string(),
    breedCode: z.enum(['OSH', 'SIA']),
    sex: z.enum(['male', 'female']),
    ems: z.string(),
    dob: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),

    // Three INDEPENDENT dimensions. Publication lifecycle, commercial state and
    // homepage exposure are separate business concepts and must never be encoded
    // in one field — see the invariants enforced by the refine() below and by
    // scripts/check-kittens.mjs.
    //
    // publicationState — does this entity generate public routes/cards at all?
    //   `draft` is the lifecycle default. Nothing about it asserts anything
    //   commercial. WU-2 must exclude drafts from route generation entirely.
    publicationState: z.enum(['draft', 'published']),

    // commercialStatus — the kitten's commercial state, or `null` for "not
    // stated". The workbook is not authoritative for availability, so `null` is
    // a first-class value: never invent a status to satisfy validation.
    commercialStatus: z.enum(['available', 'reserved', 'evaluation', 'at_new_home']).nullable(),

    // featuredInKittensPreview — an explicit editorial switch, independent of
    // both fields above. It means exactly "include this published kitten in the
    // optional KittensPreview block on the kittens listing page", and nothing
    // more. It is NOT home-page exposure: HomePage.astro renders no kitten
    // component at all. Changing commercialStatus must never flip it, and
    // publishing must never flip it either.
    featuredInKittensPreview: z.boolean(),

    // §1.7 null = OWNER INPUT REQUIRED. Not an editorial selection.
    heroImage: z.number().int().min(1).max(4).nullable(),
    cardImage: z.number().int().min(1).max(4).nullable(),

    images: z.array(z.object({
      n: z.number().int().min(1),
      src: z.string(),
      width: z.number().int().positive(),
      height: z.number().int().positive(),
      source: z.object({
        media: z.string(),
        anchor: z.string(),
        width: z.number().int().positive(),
        height: z.number().int().positive(),
        sha256: z.string().length(64),
        archive: z.string(),
      }),
    })).length(4),

    // Verbatim workbook values, kept for audit. §1.9: `documentRaw` is source
    // data only and must not be rendered publicly without an explicit decision.
    source: z.object({
      workbookRow: z.number().int(),
      workbookFile: z.string(),
      workbookSha256: z.string().length(64),
      indexRaw: z.string(),
      homeNameRaw: z.string(),
      breedRaw: z.string(),
      sexRaw: z.string(),
      passportRaw: z.string(),
      colorRaw: z.string(),
      documentRaw: z.string().default(''),
    }),
  })
    // A draft entity is not public, so it cannot be featured on a public page.
    .refine((k) => !(k.featuredInKittensPreview && k.publicationState !== 'published'), {
      message: 'featuredInKittensPreview must be false while publicationState is "draft"',
      path: ['featuredInKittensPreview'],
    })
    // Publication requires the owner's hero/card selection; a provisional
    // choice must never reach public UI.
    .refine((k) => !(k.publicationState === 'published' && k.heroImage == null), {
      message: 'publicationState "published" requires an owner-selected heroImage',
      path: ['heroImage'],
    })
    .refine((k) => !(k.publicationState === 'published' && k.cardImage == null), {
      message: 'publicationState "published" requires an owner-selected cardImage',
      path: ['cardImage'],
    }),
});

const kittenCopy = defineCollection({
  loader: glob({ pattern: '**/[^_]*.md', base: './src/content/kitten-copy' }),
  schema: z.object({
    kittenId: z.string(),
    lang: z.enum(LOCALES),
    // Localized colour label for the EMS code on the parent entity.
    colorLabel: z.string(),
    // Localized, descriptive image alt text.
    alt: z.string(),
    metaTitle: z.string().optional(),
    metaDescription: z.string().optional(),
    traits: z.array(z.string()).default([]),
    captions: z.array(z.object({ n: z.number().int().min(1).max(4), text: z.string() })).default([]),
    // Body = the description. No fallback: a missing locale file is a missing
    // locale, surfaced by scripts/check-kittens.mjs --require-copy in WU-2.
  }),
});

export const collections = { cats, testimonials, blog, faq, legal, kittens, kittenCopy };
