import {readDocument} from './frontmatter';

export const POST_TEMPLATES = ['deep-dive', 'bug-story', 'til', 'talk-notes'] as const;
export type PostTemplate = (typeof POST_TEMPLATES)[number];

export type PostSection = {
  id: string;
  title: string;
};

export type HomeDiff = {
  removed: string;
  added: string;
};

export type PostDocument = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  topics: string[];
  template: PostTemplate;
  sections: PostSection[];
  body: string;
  draft: boolean;
  accent?: string;
  homeDiff?: HomeDiff;
};

export type WorkCase = {
  slug: string;
  number: number;
  shortTitle: string;
  topic: string;
  title: string;
  summary: string;
  problem: string;
  change: string;
  verification: string;
  boundary: string;
  noteSlug?: string;
};

export type TalkStatus = 'Delivered' | 'Proposal';

export type Talk = {
  slug: string;
  status: TalkStatus;
  event: string;
  location: string;
  title: string;
  summary: string;
  detail?: string;
};

export type SiteSettings = {
  name: string;
  fullName: string;
  handle: string;
  alternateNames: string[];
  knowsAbout: string[];
  role: string;
  jobTitle: string;
  employer: string;
  location: string;
  bio: string;
  url: string;
  github: string;
  linkedin: string;
};

function fail(file: string, message: string): never {
  throw new Error(`${file}: ${message}`);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readString(record: Record<string, unknown>, key: string, file: string): string {
  const value = record[key];
  if (typeof value !== 'string' || value.trim() === '') fail(file, `expected a non-empty string for ${key}`);
  return value.trim();
}

function readOptionalString(record: Record<string, unknown>, key: string, file: string): string | undefined {
  const value = record[key];
  if (value === undefined) return undefined;
  if (typeof value !== 'string' || value.trim() === '') fail(file, `expected a string for ${key}`);
  return value.trim();
}

function readBoolean(record: Record<string, unknown>, key: string, file: string, fallback: boolean): boolean {
  const value = record[key];
  if (value === undefined) return fallback;
  if (typeof value !== 'boolean') fail(file, `expected a boolean for ${key}`);
  return value;
}

function readNumber(record: Record<string, unknown>, key: string, file: string): number {
  const value = record[key];
  if (typeof value !== 'number' || !Number.isInteger(value)) fail(file, `expected an integer for ${key}`);
  return value;
}

function readStringList(record: Record<string, unknown>, key: string, file: string): string[] {
  const value = record[key];
  if (!Array.isArray(value) || value.length === 0) fail(file, `expected a list for ${key}`);
  return value.map((item) => {
    if (typeof item !== 'string' || item.trim() === '') fail(file, `expected strings in ${key}`);
    return item.trim();
  });
}

function readDate(record: Record<string, unknown>, key: string, file: string): string {
  const value = readString(record, key, file);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(file, `${key} must be YYYY-MM-DD`);
  return value;
}

export function slugifyHeading(title: string): string {
  const slug = title
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return slug || 'section';
}

export function sectionsFromMarkdown(body: string): PostSection[] {
  const sections: PostSection[] = [];
  for (const line of body.split(/\r?\n/)) {
    const match = /^##\s+(.+?)\s*(?:\{#([a-z0-9-]+)\})?\s*$/.exec(line);
    const title = match?.[1]?.trim();
    if (!title) continue;
    sections.push({id: match?.[2] ?? slugifyHeading(title), title});
  }
  return sections;
}

function readHomeDiff(record: Record<string, unknown>, file: string): HomeDiff | undefined {
  const value = record.homeDiff;
  if (value === undefined) return undefined;
  if (!isRecord(value)) fail(file, 'homeDiff must be an object');
  return {removed: readString(value, 'removed', file), added: readString(value, 'added', file)};
}

export function parsePost(raw: string, file: string): PostDocument {
  const {data, body} = readDocument(raw, file);
  if (!isRecord(data)) fail(file, 'frontmatter must be an object');
  const template = readString(data, 'template', file);
  if (!POST_TEMPLATES.includes(template as PostTemplate)) fail(file, `unknown template ${template}`);
  const accent = readOptionalString(data, 'accent', file);
  const homeDiff = readHomeDiff(data, file);
  const post: PostDocument = {
    slug: readString(data, 'slug', file),
    title: readString(data, 'title', file),
    description: readString(data, 'description', file),
    excerpt: readString(data, 'excerpt', file),
    publishedAt: readDate(data, 'publishedAt', file),
    updatedAt: readDate(data, 'updatedAt', file),
    topics: readStringList(data, 'topics', file),
    template: template as PostTemplate,
    sections: sectionsFromMarkdown(body),
    body,
    draft: readBoolean(data, 'draft', file, false),
    ...(accent !== undefined ? {accent} : {}),
    ...(homeDiff !== undefined ? {homeDiff} : {}),
  };
  return post;
}

export function parseWorkCase(raw: string, file: string): WorkCase {
  const {data} = readDocument(raw, file);
  if (!isRecord(data)) fail(file, 'frontmatter must be an object');
  const noteSlug = readOptionalString(data, 'noteSlug', file);
  return {
    slug: readString(data, 'slug', file),
    number: readNumber(data, 'number', file),
    shortTitle: readString(data, 'shortTitle', file),
    topic: readString(data, 'topic', file),
    title: readString(data, 'title', file),
    summary: readString(data, 'summary', file),
    problem: readString(data, 'problem', file),
    change: readString(data, 'change', file),
    verification: readString(data, 'verification', file),
    boundary: readString(data, 'boundary', file),
    ...(noteSlug !== undefined ? {noteSlug} : {}),
  };
}

export function parseTalk(raw: string, file: string): Talk {
  const {data} = readDocument(raw, file);
  if (!isRecord(data)) fail(file, 'frontmatter must be an object');
  const status = readString(data, 'status', file);
  if (status !== 'Delivered' && status !== 'Proposal') fail(file, 'status must be Delivered or Proposal');
  const detail = readOptionalString(data, 'detail', file);
  return {
    slug: readString(data, 'slug', file),
    status,
    event: readString(data, 'event', file),
    location: readString(data, 'location', file),
    title: readString(data, 'title', file),
    summary: readString(data, 'summary', file),
    ...(detail !== undefined ? {detail} : {}),
  };
}

export function parseSiteSettings(value: unknown): SiteSettings {
  const file = 'content/site.json';
  if (!isRecord(value)) fail(file, 'must be an object');
  const url = readString(value, 'url', file);
  if (!url.startsWith('https://')) fail(file, 'url must be https');
  return {
    name: readString(value, 'name', file),
    fullName: readString(value, 'fullName', file),
    handle: readString(value, 'handle', file),
    alternateNames: readStringList(value, 'alternateNames', file),
    knowsAbout: readStringList(value, 'knowsAbout', file),
    role: readString(value, 'role', file),
    jobTitle: readString(value, 'jobTitle', file),
    employer: readString(value, 'employer', file),
    location: readString(value, 'location', file),
    bio: readString(value, 'bio', file),
    url,
    github: readString(value, 'github', file),
    linkedin: readString(value, 'linkedin', file),
  };
}
