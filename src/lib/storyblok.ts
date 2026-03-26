const STORYBLOK_TOKEN = import.meta.env.STORYBLOK_TOKEN || '';
const API_BASE = 'https://api.storyblok.com/v2/cdn';

async function storyblokFetch(path: string, params: Record<string, string> = {}) {
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('token', STORYBLOK_TOKEN);
  url.searchParams.set('version', 'draft');
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  const res = await fetch(url.toString());
  if (!res.ok) throw new Error(`Storyblok API error: ${res.status}`);
  return res.json();
}

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
  const data = await storyblokFetch('stories', {
    starts_with: 'cats/',
    per_page: '100',
  });
  return data.stories.map((story: any) => ({
    slug: story.slug,
    ...story.content,
  }));
}

export async function fetchCat(slug: string): Promise<CatData | null> {
  try {
    const data = await storyblokFetch(`stories/cats/${slug}`);
    return { slug: data.story.slug, ...data.story.content };
  } catch {
    return null;
  }
}

export async function fetchKittens(): Promise<KittenData[]> {
  const data = await storyblokFetch('stories', {
    starts_with: 'kittens/',
    per_page: '100',
  });
  return data.stories.map((story: any) => ({
    slug: story.slug,
    ...story.content,
  }));
}

export async function fetchKitten(slug: string): Promise<KittenData | null> {
  try {
    const data = await storyblokFetch(`stories/kittens/${slug}`);
    return { slug: data.story.slug, ...data.story.content };
  } catch {
    return null;
  }
}

export interface BlogPostData {
  slug: string;
  title: string;
  summary_en: string;
  summary_uk: string;
  content_en: any;
  content_uk: any;
  cover: { filename: string; alt: string } | null;
  category: string;
  published_at: string;
  author: string;
}

export async function fetchBlogPosts(): Promise<BlogPostData[]> {
  try {
    const data = await storyblokFetch('stories', {
      starts_with: 'blog/',
      per_page: '100',
      sort_by: 'first_published_at:desc',
    });
    return data.stories.map((story: any) => ({
      slug: story.slug,
      published_at: story.first_published_at || story.created_at,
      ...story.content,
    }));
  } catch {
    return [];
  }
}

export async function fetchBlogPost(slug: string): Promise<BlogPostData | null> {
  try {
    const data = await storyblokFetch(`stories/blog/${slug}`);
    return {
      slug: data.story.slug,
      published_at: data.story.first_published_at || data.story.created_at,
      ...data.story.content,
    };
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
