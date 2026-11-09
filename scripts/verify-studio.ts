import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {findDuplicates} from '../lib/content/duplicates';
import {splitBlocks} from '../lib/content/render';
import {parsePost, parseSiteSettings, parseTalk, parseWorkCase, sectionsFromMarkdown} from '../lib/content/schema';
import {publishConflict} from '../lib/studio/guards';
import {signSession, verifySession} from '../lib/studio/session';

const root = resolve(import.meta.dirname, '..');

function files(directory: string): string[] {
  return readdirSync(resolve(root, directory)).filter((name) => name.endsWith('.md')).sort();
}

const posts = files('content/posts').map((name) => parsePost(readFileSync(resolve(root, 'content/posts', name), 'utf8'), name));
const work = files('content/work').map((name) => parseWorkCase(readFileSync(resolve(root, 'content/work', name), 'utf8'), name));
const talks = files('content/talks').map((name) => parseTalk(readFileSync(resolve(root, 'content/talks', name), 'utf8'), name));
const site = parseSiteSettings(JSON.parse(readFileSync(resolve(root, 'content/site.json'), 'utf8')));

if (site.url !== 'https://abdessattar.dev') throw new Error(`Unexpected site url ${site.url}`);
if (posts.length === 0 || work.length !== 4 || talks.length !== 2) throw new Error('Content counts changed unexpectedly.');

const note = posts.find((post) => post.slug === 'pooled-hashmap');
if (!note || !note.sections.some((section) => section.id === 'mechanism') || !note.body.includes(':::demo{name="bucket"}')) {
  throw new Error('The PooledHashMap note did not keep its sections and demo.');
}
if (note.draft) throw new Error('The PooledHashMap note should be published.');

const fencedSections = sectionsFromMarkdown('## Real heading {#real}\n\n```bash\n## not a heading\n```\n');
if (fencedSections.length !== 1 || fencedSections[0]?.id !== 'real') {
  throw new Error('Headings inside fenced code blocks must be ignored.');
}

const unclosedNote = splitBlocks('Intro\n\n:::note\nTitle\nBody without closing fence\n\nAfter paragraph');
if (unclosedNote.some((segment) => segment.kind === 'note')) {
  throw new Error('An unclosed :::note must not swallow the rest of the document as a note block.');
}

const clash = findDuplicates(
  {slug: 'pooled-hashmap', title: note.title, description: note.description},
  posts,
);
if (!clash.blocked) throw new Error('An exact slug match should block a second post.');

const fresh = findDuplicates(
  {slug: 'new-note', title: 'A completely different subject about gardens', description: 'Nothing about hash maps or metrics here at all.'},
  posts,
);
if (fresh.blocked || fresh.warnings.length > 0) throw new Error('An unrelated draft should not be flagged.');

if (publishConflict('abc', 'abc') !== null) throw new Error('A matching file version should publish.');
if (publishConflict('new', 'old') === null) throw new Error('A changed file should be rejected.');
if (publishConflict(null, 'old') === null) throw new Error('A deleted file should be rejected.');
if (publishConflict(null, null) !== null) throw new Error('A new file should publish.');

const sitemapSource = readFileSync(resolve(root, 'app/sitemap.ts'), 'utf8');
if (sitemapSource.includes("'weekly'")) throw new Error('The sitemap should describe daily updates, not weekly ones.');
if (!sitemapSource.includes("changeFrequency: 'daily'")) throw new Error('The homepage and blog should be marked daily.');

const secret = 'verify-studio-secret';
const owner = await signSession('abdessattar23', secret);
if ((await verifySession(owner, secret))?.login !== 'abdessattar23') throw new Error('The owner session should verify.');
if (await verifySession(`${owner}x`, secret)) throw new Error('A tampered session should fail.');
const stranger = await signSession('someone-else', secret);
if (await verifySession(stranger, secret)) throw new Error('Another GitHub account should be refused.');

console.log(`Verified ${posts.length} post, ${work.length} cases, ${talks.length} talks, markdown fences, session checks, and publish guards.`);
