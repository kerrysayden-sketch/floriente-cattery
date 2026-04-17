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

export const collections = { cats, testimonials, blog, faq, legal };
