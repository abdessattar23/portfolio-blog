import {posts, siteSettings, talks, workCases} from '../content/load';
import {
  parsePost,
  parseSiteSettings,
  parseTalk,
  parseWorkCase,
  type PostDocument,
  type SiteSettings,
  type Talk,
  type WorkCase,
} from '../content/schema';
import {database, studioEnv} from './db';

type PublishedRow = {
  kind: string;
  slug: string;
  content: string;
  updated_at: string;
};

export async function savePublishedContent(
  kind: 'post' | 'work' | 'talk' | 'site',
  slug: string,
  content: string,
): Promise<void> {
  const db = await database();
  await db
    .prepare(
      `insert into published_content (kind, slug, content, updated_at)
       values (?, ?, ?, ?)
       on conflict(kind, slug) do update set content = excluded.content, updated_at = excluded.updated_at`,
    )
    .bind(kind, slug, content, new Date().toISOString())
    .run();
}

async function readPublishedRows(kind: 'post' | 'work' | 'talk' | 'site'): Promise<PublishedRow[]> {
  if (!studioEnv().DB) return [];
  try {
    const db = await database();
    const rows = await db
      .prepare('select kind, slug, content, updated_at from published_content where kind = ?')
      .bind(kind)
      .all<PublishedRow>();
    return rows.results;
  } catch {
    return [];
  }
}

export async function livePosts(): Promise<PostDocument[]> {
  const map = new Map<string, PostDocument>(posts.map((post) => [post.slug, post]));
  for (const row of await readPublishedRows('post')) {
    try {
      const parsed = parsePost(row.content, `${row.slug}.md`);
      map.set(parsed.slug, parsed);
    } catch {
      // Ignore malformed rows
    }
  }
  return [...map.values()].sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));
}

export async function livePublishedPosts(): Promise<PostDocument[]> {
  const all = await livePosts();
  return all.filter((post) => !post.draft);
}

export async function livePublishedPost(slug: string): Promise<PostDocument | undefined> {
  const all = await livePublishedPosts();
  return all.find((post) => post.slug === slug);
}

export async function liveWorkCases(): Promise<WorkCase[]> {
  const map = new Map<string, WorkCase>(workCases.map((work) => [work.slug, work]));
  for (const row of await readPublishedRows('work')) {
    try {
      const parsed = parseWorkCase(row.content, `${row.slug}.md`);
      map.set(parsed.slug, parsed);
    } catch {
      // Ignore malformed rows
    }
  }
  return [...map.values()];
}

export async function liveWorkCase(slug: string): Promise<WorkCase | undefined> {
  const all = await liveWorkCases();
  return all.find((work) => work.slug === slug);
}

export async function liveTalks(): Promise<Talk[]> {
  const map = new Map<string, Talk>(talks.map((talk) => [talk.slug, talk]));
  for (const row of await readPublishedRows('talk')) {
    try {
      const parsed = parseTalk(row.content, `${row.slug}.md`);
      map.set(parsed.slug, parsed);
    } catch {
      // Ignore malformed rows
    }
  }
  return [...map.values()];
}

export async function liveSiteSettings(): Promise<SiteSettings> {
  const rows = await readPublishedRows('site');
  const first = rows[0];
  if (!first) return siteSettings;
  try {
    return parseSiteSettings(JSON.parse(first.content));
  } catch {
    return siteSettings;
  }
}
