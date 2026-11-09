import {postFilePath, posts, siteSettings, talkFilePath, talks, workCases, workFilePath} from '../content/load';
import {database} from './db';
import {getFileSha} from './github';

export type DraftKind = 'post' | 'work' | 'talk' | 'site';

export type Draft = {
  id: string;
  slug: string;
  kind: DraftKind;
  frontmatter: string;
  body: string;
  updatedAt: string;
  baseSha: string | null;
};

type DraftRow = {
  id: string;
  slug: string;
  kind: string;
  frontmatter: string;
  body: string;
  updated_at: string;
  base_sha: string | null;
};

const KINDS = ['post', 'work', 'talk', 'site'] as const;

export function isDraftKind(value: string): value is DraftKind {
  return (KINDS as readonly string[]).includes(value);
}

function fromRow(row: DraftRow): Draft {
  if (!isDraftKind(row.kind)) throw new Error(`Unknown draft kind ${row.kind}`);
  return {
    id: row.id,
    slug: row.slug,
    kind: row.kind,
    frontmatter: row.frontmatter,
    body: row.body,
    updatedAt: row.updated_at,
    baseSha: row.base_sha,
  };
}

export async function listDrafts(): Promise<Draft[]> {
  const db = await database();
  const rows = await db.prepare('select * from drafts order by updated_at desc').all<DraftRow>();
  return rows.results.map(fromRow);
}

export async function getDraft(id: string): Promise<Draft | null> {
  const db = await database();
  const row = await db.prepare('select * from drafts where id = ?').bind(id).first<DraftRow>();
  return row ? fromRow(row) : null;
}

export async function findDraft(kind: DraftKind, slug: string): Promise<Draft | null> {
  const db = await database();
  const row = await db.prepare('select * from drafts where kind = ? and slug = ? order by updated_at desc limit 1').bind(kind, slug).first<DraftRow>();
  return row ? fromRow(row) : null;
}

export async function saveDraft(draft: Draft): Promise<void> {
  const db = await database();
  await db.prepare(
    `insert into drafts (id, slug, kind, frontmatter, body, updated_at, base_sha)
     values (?, ?, ?, ?, ?, ?, ?)
     on conflict(id) do update set slug = excluded.slug, frontmatter = excluded.frontmatter, body = excluded.body, updated_at = excluded.updated_at, base_sha = excluded.base_sha`,
  ).bind(draft.id, draft.slug, draft.kind, draft.frontmatter, draft.body, draft.updatedAt, draft.baseSha).run();
}

export async function deleteDraft(id: string): Promise<void> {
  const db = await database();
  await db.prepare('delete from drafts where id = ?').bind(id).run();
}

function today(): string {
  return new Date().toISOString().slice(0, 10);
}

function initialContent(kind: DraftKind, slug: string): {frontmatter: string; body: string} {
  if (kind === 'post') {
    const post = posts.find((item) => item.slug === slug);
    if (!post) {
      return {
        frontmatter: JSON.stringify({
          title: slug,
          description: '',
          excerpt: '',
          publishedAt: today(),
          updatedAt: today(),
          topics: ['Java'],
          template: 'deep-dive',
          draft: true,
        }),
        body: 'Start the note.\n\n## First section {#first-section}\n',
      };
    }
    return {
      frontmatter: JSON.stringify({
        title: post.title,
        description: post.description,
        excerpt: post.excerpt,
        publishedAt: post.publishedAt,
        updatedAt: post.updatedAt,
        topics: post.topics,
        template: post.template,
        draft: post.draft,
        ...(post.accent !== undefined ? {accent: post.accent} : {}),
        ...(post.homeDiff !== undefined ? {homeDiff: post.homeDiff} : {}),
      }),
      body: post.body,
    };
  }
  if (kind === 'work') {
    const work = workCases.find((item) => item.slug === slug);
    return {frontmatter: JSON.stringify(work ?? {slug, number: 0, shortTitle: '', topic: '', title: slug, summary: '', problem: '', change: '', verification: '', boundary: ''}), body: ''};
  }
  if (kind === 'talk') {
    const talk = talks.find((item) => item.slug === slug);
    return {frontmatter: JSON.stringify(talk ?? {slug, status: 'Proposal', event: '', location: '', title: slug, summary: ''}), body: ''};
  }
  return {frontmatter: JSON.stringify(siteSettings), body: ''};
}

export async function openDraft(kind: DraftKind, slug: string): Promise<Draft> {
  const existing = await findDraft(kind, slug);
  if (existing) return existing;
  const content = initialContent(kind, slug);
  const path = kind === 'site' ? 'content/site.json' : kind === 'post' ? postFilePath(slug) : kind === 'work' ? workFilePath(slug) : talkFilePath(slug);
  const draft: Draft = {
    id: crypto.randomUUID(),
    slug,
    kind,
    frontmatter: content.frontmatter,
    body: content.body,
    updatedAt: new Date().toISOString(),
    baseSha: await getFileSha(path),
  };
  await saveDraft(draft);
  return draft;
}
