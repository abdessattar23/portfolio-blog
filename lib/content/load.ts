import {mergeSiteSettings, parsePost, parseSiteSettings, parseTalk, parseWorkCase, type PostDocument, type SiteSettings, type Talk, type WorkCase} from './schema';
import siteFile from '../../content/site.json';

const workFiles = import.meta.glob('../../content/work/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const talkFiles = import.meta.glob('../../content/talks/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const postFiles = import.meta.glob('../../content/posts/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function repoPath(file: string): string {
  return file.replace(/^(\.\.\/)+/, '');
}

function textModules(modules: Record<string, unknown>): [string, string][] {
  return Object.keys(modules)
    .sort()
    .map((file) => {
      const raw = modules[file];
      if (typeof raw !== 'string') throw new Error(`${file}: expected raw text`);
      return [file, raw];
    });
}

export const siteSettings = parseSiteSettings(siteFile);

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function resolveSiteSettings(override?: unknown): SiteSettings {
  if (!isPlainRecord(override)) return siteSettings;
  return mergeSiteSettings(siteFile, override);
}

const workPaths = new Map<string, string>();
export const workCases: WorkCase[] = textModules(workFiles).map(([file, raw]) => {
  const work = parseWorkCase(raw, file);
  workPaths.set(work.slug, repoPath(file));
  return work;
});

const talkPaths = new Map<string, string>();
export const talks: Talk[] = textModules(talkFiles).map(([file, raw]) => {
  const talk = parseTalk(raw, file);
  talkPaths.set(talk.slug, repoPath(file));
  return talk;
});

const postPaths = new Map<string, string>();
export const posts: PostDocument[] = textModules(postFiles).map(([file, raw]) => {
  const post = parsePost(raw, file);
  postPaths.set(post.slug, repoPath(file));
  return post;
});

export function workFilePath(slug: string): string {
  return workPaths.get(slug) ?? `content/work/${slug}.md`;
}

export function talkFilePath(slug: string): string {
  return talkPaths.get(slug) ?? `content/talks/${slug}.md`;
}

export function postFilePath(slug: string): string {
  return postPaths.get(slug) ?? `content/posts/${slug}.md`;
}

export const publishedPosts = posts
  .filter((post) => !post.draft)
  .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

export function getPublishedPost(slug: string) {
  return publishedPosts.find((post) => post.slug === slug);
}

export function getWorkCase(slug: string) {
  return workCases.find((item) => item.slug === slug);
}

export function deliveredTalk() {
  const talk = talks.find((item) => item.status === 'Delivered');
  if (!talk) throw new Error('content/talks: missing a delivered talk');
  return talk;
}
