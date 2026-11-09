import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {readCarrierPool} from '../lib/artifacts/carrier-pool';
import {artifactFence, matchArtifactFence, previewArtifact} from '../lib/artifacts/format';
import {refuseArtifactDelete} from '../lib/artifacts/policy';
import {clampParam, parseArtifact, type ArtifactDocument} from '../lib/artifacts/schema';
import {stripDuplicateTitle, titlesMatch} from '../lib/content/headings';
import {MarkdownView, splitBlocks} from '../lib/content/render';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const root = resolve(import.meta.dirname, '..');
const raw = JSON.parse(readFileSync(resolve(root, 'content/artifacts/virtual-thread-pool.json'), 'utf8')) as unknown;
const parsed = parseArtifact(raw);
assert(parsed.ok, 'The virtual-thread artifact should be valid.');
const artifact: ArtifactDocument = parsed.artifact;
assert(artifact.id === 'virtual-thread-pool', 'The catalog id should match the file.');
assert(artifact.classification === 'conceptual', 'The pool simulation is conceptual.');
assert(artifact.view.type === 'carrier-pool', 'The proof of concept uses the carrier-pool view.');

const reading = readCarrierPool(16, 4, 4);
assert(reading.running === 4 && reading.waiting === 12 && reading.mounted === 4, 'Four connections and four platform threads admit four requests.');
assert(reading.text.includes('does not add database capacity'), 'The readout should name the limit.');
assert(!/faster|latency|throughput|%|\bms\b/i.test(reading.text), 'The readout must not invent a performance number.');
const widerPool = readCarrierPool(16, 4, 8);
assert(widerPool.running === 4 && widerPool.idleConnections === 4, 'Extra connections stay unused without more platform threads.');
const widerCarriers = readCarrierPool(16, 8, 4);
assert(widerCarriers.running === 4 && widerCarriers.idleThreads === 4, 'Extra platform threads stay idle when the pool is full.');

if (artifact.view.type === 'carrier-pool') {
  assert(clampParam(artifact.view.requests, 100) === 32, 'A request count above the max should clamp.');
  assert(clampParam(artifact.view.requests, 0) === 1, 'A request count below the min should clamp.');
  assert(clampParam(artifact.view.requests, Number.NaN) === 16, 'A missing value should use the default.');
}

const renamed = parseArtifact({...artifact, version: 2});
assert(!renamed.ok && renamed.title === artifact.title && renamed.summary === artifact.summary, 'An unknown version should keep the title and summary.');
assert(!parseArtifact({...artifact, view: {type: 'script'}}).ok, 'An unknown view should fail closed.');
assert(!parseArtifact({...artifact, title: 'javascript:alert(1)'}).ok, 'A script URL should be rejected.');
assert(!parseArtifact({...artifact, classification: 'measured'}).ok, 'The carrier-pool view cannot be marked measured.');
assert(!parseArtifact({...artifact, code: 'alert(1)'}).ok, 'Executable fields should be rejected.');
assert(!parseArtifact({
  version: 1,
  id: 'scene',
  title: 'Scene',
  summary: 'A small drawing.',
  classification: 'conceptual',
  view: {type: 'svg-scene', width: 120, height: 80, shapes: [{type: 'path', d: 'M0 0'}]},
}).ok, 'Raw SVG paths should be rejected.');

const compare = parseArtifact({
  version: 1,
  id: 'loop-direction',
  title: 'Loop direction',
  summary: 'The same loop walked from the other end.',
  classification: 'conceptual',
  view: {type: 'code-compare', before: 'List<String> items;', after: 'for (int i = items.size() - 1; i >= 0; i--) {}'},
});
assert(compare.ok, 'Code may contain Java generics.');
assert(!parseArtifact({
  version: 1,
  id: 'bad-code',
  title: 'Bad code',
  summary: 'This should fail.',
  classification: 'conceptual',
  view: {type: 'code-compare', before: '<script>alert(1)</script>', after: 'after'},
}).ok, 'Script tags in code should be rejected.');

assert(parseArtifact({
  version: 1,
  id: 'service-map',
  title: 'Service map',
  summary: 'An application calls a database.',
  classification: 'conceptual',
  view: {
    type: 'architecture',
    nodes: [{id: 'app', label: 'Application'}, {id: 'db', label: 'Database', lane: 'data'}],
    edges: [{from: 'app', to: 'db', label: 'queries'}],
  },
}).ok, 'An architecture graph should validate.');
assert(parseArtifact({
  version: 1,
  id: 'borrow',
  title: 'Borrow a connection',
  summary: 'A request waits until the pool has a connection.',
  classification: 'conceptual',
  view: {
    type: 'sequence',
    participants: ['Request', 'Pool'],
    messages: [{from: 'Request', to: 'Pool', label: 'borrow'}],
  },
}).ok, 'A sequence should validate.');
assert(parseArtifact({
  version: 1,
  id: 'steps',
  title: 'Two steps',
  summary: 'A short walk.',
  classification: 'conceptual',
  view: {type: 'frames', frames: [{title: 'Start', text: 'One request arrives.'}]},
}).ok, 'Frames should validate.');
assert(parseArtifact({
  version: 1,
  id: 'limit-note',
  title: 'The limit',
  summary: 'A reminder.',
  classification: 'measured',
  view: {type: 'callout', text: 'The pool size was taken from the production configuration.'},
}).ok, 'A measured callout should validate.');

const preview = previewArtifact(artifact);
assert(preview.valid && preview.markdown === ':::artifact{id="virtual-thread-pool"}', 'Preview should return the fence.');
assert(!('html' in preview), 'Preview should not return HTML.');
assert(!JSON.stringify(preview).includes('<svg'), 'Preview should not return SVG markup.');
assert(matchArtifactFence(artifactFence(artifact.id)) === artifact.id, 'The fence should round-trip.');

const pooled = splitBlocks(readFileSync(resolve(root, 'content/posts/pooled-hashmap.md'), 'utf8'));
assert(pooled.some((segment) => segment.kind === 'demo' && segment.name === 'bucket'), 'The existing bucket demo should still parse.');
assert(!pooled.some((segment) => segment.kind === 'artifact'), 'The existing note should not gain an artifact by accident.');
const fenced = splitBlocks('```\n:::artifact{id="virtual-thread-pool"}\n```\n');
assert(!fenced.some((segment) => segment.kind === 'artifact'), 'An artifact fence inside code should stay code.');
const mixed = splitBlocks('Intro\n\n:::note\nKeep\nThis stays a note.\n:::\n\n:::artifact{id="virtual-thread-pool"}\n\nAfter\n');
assert(mixed.some((segment) => segment.kind === 'note' && segment.title === 'Keep'), 'Notes should still parse beside artifacts.');
assert(mixed.some((segment) => segment.kind === 'artifact' && segment.id === 'virtual-thread-pool'), 'The artifact fence should be its own segment.');
assert(mixed.some((segment) => segment.kind === 'markdown' && segment.text.includes('After')), 'Text after an artifact should remain.');

const title = "Java Virtual Threads: More Concurrency Doesn't Mean More Speed";
const stripped = stripDuplicateTitle(`# ${title}\n\nIntro\n\n## ${title}.\n\n## The limit {#the-limit}\n`, title);
assert(!stripped.split('\n').some((line) => /^#\s/.test(line) && !line.startsWith('##')), 'A body h1 should be removed.');
assert(stripped.includes('## The limit'), 'A later section should stay.');
assert(titlesMatch(`${title}.`, title), 'A trailing period should still count as the same title.');

assert(refuseArtifactDelete(false, 0, true)?.includes('confirm'), 'Delete without confirm should be refused.');
assert(refuseArtifactDelete(true, 1, true)?.includes('referenced'), 'A referenced artifact should be kept.');
assert(refuseArtifactDelete(true, 0, false)?.includes('git catalog'), 'The git catalog should not be deleted from the studio.');
assert(refuseArtifactDelete(true, 0, true) === null, 'An unreferenced studio copy can be deleted.');

const tools = readFileSync(resolve(root, 'lib/studio/mcp-tools.ts'), 'utf8');
const instructions = readFileSync(resolve(root, 'lib/studio/mcp-server.ts'), 'utf8');
const agent = readFileSync(resolve(root, 'lib/agent/discovery.ts'), 'utf8');
assert(/tool\('delete_artifact'[\s\S]*?\['id', 'confirm'\], false, true\)/.test(tools), 'delete_artifact should require confirm and be destructive.');
assert(/tool\('preview_artifact'[\s\S]*?\}, \[\], true\)/.test(tools), 'preview_artifact should be read-only.');
assert(/tool\('attach_artifact'[\s\S]*?\['id', 'draft_id'\], false\)/.test(tools), 'attach_artifact should not be destructive.');
assert(instructions.includes('conceptual simulation is not a measurement'), 'The studio instructions should say a simulation is not a measurement.');
assert(!agent.includes('list_artifacts'), 'The public MCP server should not gain artifact tools.');

const html = renderToStaticMarkup(createElement(MarkdownView, {
  markdown: `# ${title}\n\nA lead paragraph.\n\n## ${title}\n\n## The limit\n\n:::artifact{id="virtual-thread-pool"}\n\n:::demo{name="bucket"}\n`,
  title,
  artifacts: [artifact],
}));
assert(!html.includes('<h1'), 'The article chrome owns the h1.');
assert(!html.includes(`>${title}<`), 'The repeated title heading should not render.');
assert(html.includes('id="the-limit"'), 'The remaining section should keep its anchor.');
assert(html.includes('Conceptual simulation, not a measurement'), 'The figure should say it is not a measurement.');
assert(html.includes('type="range"'), 'The simulation should render parameter controls.');
assert(html.includes('Forward traversal'), 'The existing bucket demo should still render.');
assert(html.includes('This figure is not available') === false, 'A known artifact should render.');

const missing = renderToStaticMarkup(createElement(MarkdownView, {
  markdown: ':::artifact{id="missing-figure"}\n',
  title: 'Note',
  artifacts: [],
}));
assert(missing.includes('This figure is not available'), 'A missing artifact should fail quietly.');

console.log('Verified artifact schema, fences, carrier-pool limits, delete guards, and rendered fallback.');
