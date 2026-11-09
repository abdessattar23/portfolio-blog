import {stringify} from 'yaml';
import {posts, postFilePath, talkFilePath, talks, workCases, workFilePath} from '../content/load';
import {parsePost, parseSiteSettings, parseTalk, parseWorkCase} from '../content/schema';
import {findDuplicates} from '../content/duplicates';
import {studioEnv} from './db';

const REPO = 'abdessattar23/portfolio-blog';
const AUTHOR = {
  name: 'Mohammed Abdessetar Elyagoubi',
  email: '106479409+abdessattar23@users.noreply.github.com',
};

type TreeEntry = {
  path: string;
  mode: '100644';
  type: 'blob';
  sha: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readSha(value: unknown): string | undefined {
  if (!isRecord(value)) return undefined;
  const direct = value['sha'];
  if (typeof direct === 'string') return direct;
  const object = value['object'];
  if (isRecord(object) && typeof object['sha'] === 'string') return object['sha'];
  const tree = value['tree'];
  if (isRecord(tree) && typeof tree['sha'] === 'string') return tree['sha'];
  return undefined;
}

async function github(token: string, path: string, init?: RequestInit): Promise<unknown> {
  const response = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'User-Agent': 'abdessattar-studio',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message = isRecord(payload) && typeof payload['message'] === 'string' ? payload['message'] : response.statusText;
    throw new Error(`GitHub ${response.status}: ${message}`);
  }
  return payload;
}

export async function getFileSha(path: string): Promise<string | null> {
  const token = studioEnv().GITHUB_CONTENT_TOKEN;
  if (!token) return null;
  const response = await fetch(`https://api.github.com/repos/${REPO}/contents/${path.split('/').map(encodeURIComponent).join('/')}`, {
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'abdessattar-studio',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });
  if (response.status === 404) return null;
  const payload: unknown = await response.json();
  if (!response.ok) throw new Error('GitHub could not read the current file.');
  return readSha(payload) ?? null;
}

function markdownDocument(data: Record<string, unknown>, body: string): string {
  return `---\n${stringify(data)}---\n\n${body.trim()}\n`;
}

function withoutEmpty(record: Record<string, unknown>): Record<string, unknown> {
  const cleaned: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(record)) {
    if (value === '' || value === undefined || value === null) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

export function renderDraftFile(kind: 'post' | 'work' | 'talk' | 'site', slug: string, frontmatter: string, body: string): {path: string; content: string} {
  const parsed: unknown = JSON.parse(frontmatter);
  if (!isRecord(parsed)) throw new Error('Draft fields are unreadable.');
  if (kind === 'site') {
    parseSiteSettings(parsed);
    return {path: 'content/site.json', content: `${JSON.stringify(parsed, null, 2)}\n`};
  }
  const data = withoutEmpty({slug, ...parsed, slug});
  const content = markdownDocument(data, body);
  if (kind === 'post') {
    const post = parsePost(content, `${slug}.md`);
    if (post.slug !== slug) throw new Error('The draft slug does not match the file.');
    const others = posts.filter((item) => item.slug !== slug);
    const duplicates = findDuplicates(post, others);
    if (duplicates.warnings.length > 0) {
      console.info(duplicates.warnings.join(' '));
    }
    return {path: postFilePath(slug), content};
  }
  if (kind === 'work') {
    parseWorkCase(content, `${slug}.md`);
    return {path: workFilePath(slug), content};
  }
  parseTalk(content, `${slug}.md`);
  return {path: talkFilePath(slug), content};
}

async function blob(token: string, content: string, encoding: 'utf-8' | 'base64'): Promise<string> {
  const payload = await github(token, `/repos/${REPO}/git/blobs`, {
    method: 'POST',
    body: JSON.stringify({content, encoding}),
  });
  const sha = readSha(payload);
  if (!sha) throw new Error('GitHub did not return a blob.');
  return sha;
}

export async function commitFiles(message: string, files: {path: string; text?: string; base64?: string}[]): Promise<string> {
  const token = studioEnv().GITHUB_CONTENT_TOKEN;
  if (!token) throw new Error('GITHUB_CONTENT_TOKEN is not configured.');
  const ref = await github(token, `/repos/${REPO}/git/ref/heads/main`);
  const head = readSha(ref);
  if (!head) throw new Error('GitHub did not return the main branch.');
  const commit = await github(token, `/repos/${REPO}/git/commits/${head}`);
  const tree = isRecord(commit) ? readSha(commit['tree']) : undefined;
  if (!tree) throw new Error('GitHub did not return the current tree.');

  const entries: TreeEntry[] = [];
  for (const file of files) {
    const sha = file.base64 !== undefined ? await blob(token, file.base64, 'base64') : await blob(token, file.text ?? '', 'utf-8');
    entries.push({path: file.path, mode: '100644', type: 'blob', sha});
  }
  const nextTree = await github(token, `/repos/${REPO}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({base_tree: tree, tree: entries}),
  });
  const treeSha = readSha(nextTree);
  if (!treeSha) throw new Error('GitHub did not return the new tree.');
  if (treeSha === tree) {
    return entries[0]?.sha ?? head;
  }
  const date = new Date().toISOString();
  const nextCommit = await github(token, `/repos/${REPO}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({
      message,
      tree: treeSha,
      parents: [head],
      author: {...AUTHOR, date},
      committer: {...AUTHOR, date},
    }),
  });
  const commitSha = readSha(nextCommit);
  if (!commitSha) throw new Error('GitHub did not return the new commit.');
  await github(token, `/repos/${REPO}/git/refs/heads/main`, {
    method: 'PATCH',
    body: JSON.stringify({sha: commitSha, force: false}),
  });
  return entries[0]?.sha ?? commitSha;
}

export function knownContent(kind: 'post' | 'work' | 'talk', slug: string): boolean {
  if (kind === 'post') return posts.some((item) => item.slug === slug);
  if (kind === 'work') return workCases.some((item) => item.slug === slug);
  return talks.some((item) => item.slug === slug);
}
