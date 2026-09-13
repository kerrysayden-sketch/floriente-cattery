# Localized kitten copy

One file per kitten per locale: `<kittenId>-<lang>.md`, for all five locales
(`en`, `uk`, `pl`, `de`, `ru`).

Files beginning with `_` are ignored by the collection loader
(`pattern: '**/[^_]*.md'`), so this README is documentation, not an entry.

## Why this directory is empty

Intentional. WU-1 normalised the **factual** kitten source only. Personality and
marketing copy is a separate work unit and is owner-provided.

Astro therefore logs, on every build:

```
[glob-loader] No files found matching "**/[^_]*.md" in directory "src/content/kitten-copy"
```

That notice is the expected signal that kitten copy has not been written yet. It
is a warning, not an error, and the build succeeds. It disappears with the first
copy file.

**Do not add placeholder or machine-translated filler to silence it.** A missing
locale must stay visibly missing — the site has no silent English fallback, and
inventing personality text for a live animal is not acceptable on this site.

## Contract

Frontmatter (see `src/content.config.ts` → `kittenCopy`):

| field | required | notes |
|---|---|---|
| `kittenId` | yes | must match a `src/content/kittens/<kittenId>.yaml` entity |
| `lang` | yes | `en` \| `uk` \| `pl` \| `de` \| `ru` |
| `colorLabel` | yes | localized label for the entity's EMS code |
| `alt` | yes | localized, descriptive image alt text |
| `metaTitle` | no | localized `<title>`; falls back to a composed default |
| `metaDescription` | no | localized meta description |
| `traits` | no | short localized trait chips |
| `captions` | no | `[{ n, text }]`, localized per-image captions |

The markdown **body** is the description, split on blank lines into paragraphs
at render time — the same convention as `src/content/cats/`.

Invariant facts (name, breed, sex, EMS, DOB, images, status, `featuredOnHome`)
are **not** repeated here. They live once, on the entity.

## Enforcement

`npm run kittens:check -- --require-copy` fails when any published kitten is
missing a locale. WU-2 wires that into the publication gate.
