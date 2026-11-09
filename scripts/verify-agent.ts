import {createHash, generateKeyPairSync} from 'node:crypto';
import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';
import {AGENT_TOOLS_SCRIPT} from '../lib/agent/browser-tools';
import {markdownRequestPath, pageMarkdown, searchCorpus, type AgentCorpus, type AgentSite} from '../lib/agent/content';
import {agentSkillsDocument, apiCatalogDocument, authMarkdown, skillMarkdown} from '../lib/agent/discovery';
import {prefersMarkdown, robotsTxt} from '../lib/agent/policy';
import {handleA2a, handleMcp} from '../lib/agent/protocol';
import {WEB_BOT_PUBLIC_JWK} from '../lib/agent/public-key';
import {directoryDocument, directorySignatureHeaders, jwkThumbprint, usablePrivateJwk, type Ed25519PrivateJwk} from '../lib/agent/signatures';
import {parsePost, parseSiteSettings, parseTalk, parseWorkCase} from '../lib/content/schema';

const root = resolve(import.meta.dirname, '..');

function files(directory: string): string[] {
  return readdirSync(resolve(root, directory)).filter((name) => name.endsWith('.md')).sort();
}

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const settings = parseSiteSettings(JSON.parse(readFileSync(resolve(root, 'content/site.json'), 'utf8')));
const site: AgentSite = {
  url: settings.url,
  name: settings.name,
  fullName: settings.fullName,
  handle: settings.handle,
  bio: settings.bio,
  role: settings.role,
  jobTitle: settings.jobTitle,
  employer: settings.employer,
  location: settings.location,
  github: settings.github,
  linkedin: settings.linkedin,
  knowsAbout: settings.knowsAbout,
  alternateNames: settings.alternateNames,
};
const corpus: AgentCorpus = {
  site,
  posts: files('content/posts')
    .map((name) => parsePost(readFileSync(resolve(root, 'content/posts', name), 'utf8'), name))
    .filter((post) => !post.draft),
  work: files('content/work').map((name) => parseWorkCase(readFileSync(resolve(root, 'content/work', name), 'utf8'), name)),
  talks: files('content/talks').map((name) => parseTalk(readFileSync(resolve(root, 'content/talks', name), 'utf8'), name)),
};

const robots = robotsTxt(site.url);
assert(robots.includes('Content-Signal: ai-train=no, search=yes, ai-input=yes'), 'robots.txt should publish content signals');
assert(robots.includes('User-agent: GPTBot'), 'robots.txt should keep explicit AI crawler rules');
assert(robots.includes(`Agentmap: ${site.url}/.well-known/ai-catalog.json`), 'robots.txt should point at the ARD catalog');
const robotLines = robots.split('\n');
assert(!robotLines.includes('Disallow: /api/'), 'The public content API should stay crawlable');
assert(robotLines.includes('Disallow: /api/studio'), 'The studio API should stay out of crawls');
assert(robotLines.includes(`Sitemap: ${site.url}/sitemap.xml`), 'robots.txt should keep its sitemap');

assert(prefersMarkdown('text/markdown'), 'A markdown-only Accept header should negotiate markdown');
assert(!prefersMarkdown('text/html'), 'HTML requests should stay HTML');
assert(!prefersMarkdown('text/html, text/markdown;q=0.1'), 'A lower-quality markdown preference should not win');
assert(prefersMarkdown('text/markdown, text/html;q=0.8'), 'An equal or higher markdown preference should win');
assert(markdownRequestPath('/index.md') === '/', '/index.md should map to the homepage');
assert(markdownRequestPath('/blog/pooled-hashmap.md') === '/blog/pooled-hashmap', 'A note suffix should map to the note');

const home = pageMarkdown(corpus, '/');
assert(home?.startsWith(`# ${site.name}`), 'Homepage markdown should start with the author name');
assert(home?.includes('/blog/pooled-hashmap'), 'Homepage markdown should link the published note');
const note = pageMarkdown(corpus, '/blog/pooled-hashmap');
assert(note?.includes('Canonical: https://abdessattar.dev/blog/pooled-hashmap'), 'Note markdown should name its canonical URL');
assert(searchCorpus(corpus, 'pooled hashmap').some((hit) => hit.slug === 'pooled-hashmap'), 'Search should find the pooled hashmap note');

const catalog = JSON.parse(apiCatalogDocument(site)) as {linkset: Array<{'service-desc': Array<{href: string}>}>};
const described = catalog.linkset[0];
assert(described?.['service-desc'][0]?.href === `${site.url}/openapi.json`, 'The API catalog should point at the OpenAPI document');

const auth = authMarkdown(site);
assert(auth.startsWith('# auth.md'), 'auth.md should identify itself in the title');
assert(auth.includes('No credential'), 'auth.md should say public reading needs no credential');

const skillBody = skillMarkdown(site, 'read-site');
assert(skillBody?.includes('# Read abdessattar.dev'), 'The read-site skill should include instructions');
const skills = JSON.parse(await agentSkillsDocument(site)) as {skills: Array<{name: string; digest: string; url: string}>};
const readSkill = skills.skills.find((skill) => skill.name === 'read-site');
assert(readSkill, 'The skill index should list read-site');
const expectedDigest = `sha256:${createHash('sha256').update(skillBody ?? '').digest('hex')}`;
assert(readSkill.digest === expectedDigest, 'The skill digest should match the served skill file');

const mcpInit = await handleMcp(
  new Request('https://abdessattar.dev/mcp', {
    method: 'POST',
    headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {protocolVersion: '2025-06-18', capabilities: {}, clientInfo: {name: 'verify', version: '1'}},
    }),
  }),
  corpus,
);
const mcpInitBody = (await mcpInit.json()) as {result?: {serverInfo?: {name?: string}}};
assert(mcpInitBody.result?.serverInfo?.name === 'abdessattar-content', 'MCP initialize should identify the content server');

const mcpCall = await handleMcp(
  new Request('https://abdessattar.dev/mcp', {
    method: 'POST',
    headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({jsonrpc: '2.0', id: 2, method: 'tools/call', params: {name: 'search_site', arguments: {query: 'hashmap'}}}),
  }),
  corpus,
);
const mcpCallBody = (await mcpCall.json()) as {result?: {content?: Array<{text?: string}>}};
assert(mcpCallBody.result?.content?.[0]?.text?.includes('pooled-hashmap'), 'MCP search should return the matching note');

const a2a = await handleA2a(
  new Request('https://abdessattar.dev/a2a', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({
      jsonrpc: '2.0',
      id: 'q1',
      method: 'message/send',
      params: {message: {role: 'user', parts: [{kind: 'text', text: 'pooled hashmap'}]}},
    }),
  }),
  corpus,
);
const a2aBody = (await a2a.json()) as {result?: {parts?: Array<{text?: string}>}};
assert(a2aBody.result?.parts?.[0]?.text?.includes('pooled-hashmap'), 'The A2A agent should answer from published pages');

const directory = directoryDocument();
assert(directory.includes(WEB_BOT_PUBLIC_JWK.x), 'The signature directory should publish the public key');
assert(!directory.includes('"d"'), 'The signature directory should not contain a private key');
assert(usablePrivateJwk(JSON.stringify({kty: 'OKP', crv: 'Ed25519', x: 'different', d: 'secret'})) === null, 'A mismatched private key should be ignored');

const generated = generateKeyPairSync('ed25519');
const exported = generated.privateKey.export({format: 'jwk'});
assert(exported.kty === 'OKP' && exported.crv === 'Ed25519' && exported.x && exported.d, 'The test key should be an Ed25519 JWK');
const privateJwk: Ed25519PrivateJwk = {kty: 'OKP', crv: 'Ed25519', x: exported.x, d: exported.d};
const signed = await directorySignatureHeaders('abdessattar.dev', privateJwk);
const params = signed['Signature-Input']?.slice('sig1='.length);
const signature = signed['Signature']?.slice('sig1=:'.length, -1);
assert(params && signature, 'A directory response should carry a signature');
const base = `"@authority";req: abdessattar.dev\n"@signature-params": ${params}\n`;
const publicKey = await crypto.subtle.importKey('jwk', {kty: 'OKP', crv: 'Ed25519', x: privateJwk.x}, {name: 'Ed25519'}, false, ['verify']);
const signatureBytes = Uint8Array.from(atob(signature), (char) => char.charCodeAt(0));
const verified = await crypto.subtle.verify({name: 'Ed25519'}, publicKey, signatureBytes, new TextEncoder().encode(base));
assert(verified, 'The directory signature should verify');
const thumb = await jwkThumbprint(privateJwk.x);
const canonical = JSON.stringify({crv: 'Ed25519', kty: 'OKP', x: privateJwk.x});
assert(thumb === createHash('sha256').update(canonical).digest('base64url'), 'The key id should be the JWK thumbprint');

assert(AGENT_TOOLS_SCRIPT.includes('root.modelContext'), 'WebMCP should look for the document model context');
assert(AGENT_TOOLS_SCRIPT.includes('registerTool'), 'WebMCP should register tools on page load');
assert(AGENT_TOOLS_SCRIPT.includes('search_site'), 'WebMCP should expose site search');
new Function(AGENT_TOOLS_SCRIPT);

console.log('Verified content signals, markdown negotiation, discovery documents, MCP, A2A, and Web Bot Auth signatures.');
