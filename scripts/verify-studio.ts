import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {findDuplicates} from '../lib/content/duplicates';
import {splitBlocks} from '../lib/content/render';
import {mergeSiteSettings, parsePost, parseSiteSettings, parseTalk, parseWorkCase, sectionsFromMarkdown} from '../lib/content/schema';
import {bareDocumentTitle, siteIcons, withSiteTitle} from '../lib/search-appearance';
import {buildIdentityGraph} from '../lib/site-graph';
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
if (site.fullName !== 'Mohammed Abdessetar Elyagoubi') throw new Error('The person name should stay Mohammed Abdessetar Elyagoubi.');
if (site.websiteName !== 'Mohammed Abdessetar') throw new Error('The preferred website name should be Mohammed Abdessetar.');
if (site.websiteAlternateName !== 'abdessattar.dev') throw new Error('The alternate website name should be abdessattar.dev.');
const rawSite = JSON.parse(readFileSync(resolve(root, 'content/site.json'), 'utf8')) as unknown;
const legacyOverride = mergeSiteSettings(rawSite, {
  name: 'Mohammed Elyagoubi',
  websiteName: 'Mohammed Elyagoubi — Java, JVM, and observability',
});
if (legacyOverride.websiteName !== 'Mohammed Abdessetar' || legacyOverride.fullName !== site.fullName) {
  throw new Error('A stored copy of the old derived website name should not replace the repository identity.');
}
const customOverride = mergeSiteSettings(rawSite, {websiteName: 'Custom Site', websiteAlternateName: 'custom.example'});
if (customOverride.websiteName !== 'Custom Site' || customOverride.websiteAlternateName !== 'custom.example' || customOverride.fullName !== site.fullName) {
  throw new Error('An explicit live website name should win, while omitted fields stay on the repository defaults.');
}
const graph = buildIdentityGraph(site);
const nodes = graph['@graph'] as Array<Record<string, unknown>>;
const websites = nodes.filter((node) => node['@type'] === 'WebSite');
const people = nodes.filter((node) => node['@type'] === 'Person');
if (websites.length !== 1 || websites[0]?.['name'] !== 'Mohammed Abdessetar' || JSON.stringify(websites[0]?.['alternateName']) !== JSON.stringify(['abdessattar.dev'])) {
  throw new Error('The existing WebSite entity should use the preferred name and domain alternate.');
}
if (people.length !== 1 || people[0]?.['name'] !== 'Mohammed Abdessetar Elyagoubi') throw new Error('The Person entity should keep the full name.');
const icons = siteIcons('/favicon.svg');
const iconSummary = icons.icon.map((icon) => `${icon.url} ${icon.type ?? ''} ${icon.sizes ?? ''}`).join('\n');
if (!iconSummary.includes('/favicon.ico image/x-icon') || !iconSummary.includes('/favicon-96.png image/png 96x96') || !iconSummary.includes('/favicon.svg image/svg+xml')) {
  throw new Error(`Favicon metadata is incomplete:\n${iconSummary}`);
}
const png = readFileSync(resolve(root, 'public/favicon-96.png'));
if (png[0] !== 0x89 || png.toString('ascii', 1, 4) !== 'PNG' || png.readUInt32BE(16) !== 96 || png.readUInt32BE(20) !== 96 || png[25] !== 6) {
  throw new Error('favicon-96.png should be a 96×96 RGBA PNG.');
}
const ico = readFileSync(resolve(root, 'public/favicon.ico'));
if (ico.readUInt16LE(0) !== 0 || ico.readUInt16LE(2) !== 1) throw new Error('favicon.ico should be a valid ICO.');
const icoCount = ico.readUInt16LE(4);
const icoSizes: string[] = [];
for (let index = 0; index < icoCount; index += 1) {
  const entry = 6 + index * 16;
  const width = ico[entry] || 256;
  const height = ico[entry + 1] || 256;
  icoSizes.push(`${width}x${height}`);
}
if (!icoSizes.includes('48x48') || !icoSizes.includes('96x96')) throw new Error(`favicon.ico should include 48 and 96 pixel images, got ${icoSizes.join(', ')}.`);
if (posts.length === 0 || work.length !== 4 || talks.length !== 3) throw new Error('Content counts changed unexpectedly.');

const note = posts.find((post) => post.slug === 'pooled-hashmap');
if (!note || !note.sections.some((section) => section.id === 'mechanism') || !note.body.includes(':::demo{name="bucket"}')) {
  throw new Error('The PooledHashMap note did not keep its sections and demo.');
}
if (note.draft) throw new Error('The PooledHashMap note should be published.');
if (note.title !== 'Why walking a bucket backwards can keep a metric alive') throw new Error('The visible PooledHashMap title changed.');
if (note.seoTitle !== 'Fixing skipped metrics in OpenTelemetry Java’s PooledHashMap') throw new Error('The PooledHashMap search title is missing.');
if (note.description !== 'How forward iteration skipped entries in OpenTelemetry Java’s PooledHashMap, and why reversing the traversal fixed it.') {
  throw new Error('The PooledHashMap meta description does not describe the forward-iteration fix.');
}
if (note.slug !== 'pooled-hashmap' || note.publishedAt !== '2026-11-08') throw new Error('The PooledHashMap slug or publication date changed.');
if (bareDocumentTitle(`${note.seoTitle} | ${site.websiteName}`, site) !== note.seoTitle) {
  throw new Error('The title template input should not already include the website name.');
}
if (withSiteTitle(note.seoTitle, site) !== `${note.seoTitle} | ${site.websiteName}`) {
  throw new Error('Open Graph should append the website name once.');
}
const layoutSource = readFileSync(resolve(root, 'app/layout.tsx'), 'utf8');
if (layoutSource.includes('rel="icon"')) throw new Error('Favicon links should come from metadata, not a second manual tag.');

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
