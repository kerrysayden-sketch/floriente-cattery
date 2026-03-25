import { useStoryblokApi } from '@storyblok/astro';

export interface CatData {
  slug: string;
  name: string;
  breed: string;
  sex: string;
  color: string;
  ems_code: string;
  dob: string;
  titles: string;
  role: string;
  photos: { filename: string; alt: string } | null;
  description_en: string;
  description_uk: string;
  health_tests: any[];
  gallery: any[];
  pedigree_pdf: { filename: string } | null;
}

export interface KittenData {
  slug: string;
  name: string;
  breed: string;
  sex: string;
  color: string;
  ems_code: string;
  dob: string;
  status: string;
  price: string;
  father: string;
  mother: string;
  photos: { filename: string; alt: string } | null;
  description_en: string;
  description_uk: string;
  gallery: any[];
  watch_me_grow: any[];
  owner_name: string;
  owner_country: string;
}

export async function fetchCats(): Promise<CatData[]> {
  const storyblokApi = useStoryblokApi();
  const { data } = await storyblokApi.get('cdn/stories', {
    starts_with: 'cats/',
    version: import.meta.env.DEV ? 'draft' : 'published',
    per_page: 100,
  });

  return data.stories.map((story: any) => ({
    slug: story.slug,
    ...story.content,
  }));
}

export async function fetchCat(slug: string): Promise<CatData | null> {
  const storyblokApi = useStoryblokApi();
  try {
    const { data } = await storyblokApi.get(`cdn/stories/cats/${slug}`, {
      version: import.meta.env.DEV ? 'draft' : 'published',
    });
    return { slug: data.story.slug, ...data.story.content };
  } catch {
    return null;
  }
}

export async function fetchKittens(): Promise<KittenData[]> {
  const storyblokApi = useStoryblokApi();
  const { data } = await storyblokApi.get('cdn/stories', {
    starts_with: 'kittens/',
    version: import.meta.env.DEV ? 'draft' : 'published',
    per_page: 100,
  });

  return data.stories.map((story: any) => ({
    slug: story.slug,
    ...story.content,
  }));
}

export async function fetchKitten(slug: string): Promise<KittenData | null> {
  const storyblokApi = useStoryblokApi();
  try {
    const { data } = await storyblokApi.get(`cdn/stories/kittens/${slug}`, {
      version: import.meta.env.DEV ? 'draft' : 'published',
    });
    return { slug: data.story.slug, ...data.story.content };
  } catch {
    return null;
  }
}

export function getCatsByRole(cats: CatData[], role: string): CatData[] {
  return cats.filter((cat) => cat.role === role);
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    available: 'bg-status-available',
    reserved: 'bg-status-reserved',
    at_new_home: 'bg-status-home',
    evaluation: 'bg-status-evaluation',
  };
  return colors[status] || 'bg-gray-medium';
}

export function getStatusLabel(status: string, lang: string): string {
  const labels: Record<string, Record<string, string>> = {
    available: { en: 'Available', uk: 'Доступний' },
    reserved: { en: 'Reserved', uk: 'Зарезервований' },
    at_new_home: { en: 'At New Home', uk: 'У новому домі' },
    evaluation: { en: 'Evaluation', uk: 'На оцінці' },
  };
  return labels[status]?.[lang] || status;
}
