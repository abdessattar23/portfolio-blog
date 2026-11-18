import assert from 'node:assert/strict';
import {readFileSync, readdirSync} from 'node:fs';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import {rehypeCodeBlocks} from '../lib/content/code-blocks';
import {renderMarkdownToHtml} from '../lib/content/render';

const base = () => unified().use(remarkParse).use(remarkGfm).use(remarkRehype).use(rehypeHighlight, {plainText: ['output']});
const render = renderMarkdownToHtml;
const fence = (info: string, code: string) => `\`\`\`${info}\n${code}\n\`\`\``;

const java = '/* first line\n * still a comment\n */\npublic class Greeter {\n    String value = "<script>&";\n}';
const highlighted = render(fence('java title="Greeter.java" {2-4,99}', java));
assert.match(highlighted, /class="code-title">Greeter.java</);
assert.equal((highlighted.match(/class="code-line is-highlighted"/g) ?? []).length, 3);
assert.match(highlighted, /hljs-comment/);
assert.match(highlighted, /&#x3C;script>/);
assert.doesNotMatch(highlighted, /<script>/);
assert.match(highlighted, /aria-label="Copy Greeter.java"/);
assert.match(highlighted, /tabindex="0" role="region"/);

const alias = render(fence("java filename='Main.java' highlight='1-2'", 'one\ntwo\nthree'));
assert.match(alias, /class="code-title">Main.java</);
assert.equal((alias.match(/is-highlighted/g) ?? []).length, 2);
assert.match(render(fence('cmd', 'mvn clean package')), /data-kind="command"/);
assert.match(render(fence('text kind="output" title="Expected output"', 'Hello')), /data-kind="output"/);
assert.match(render(fence('output', 'Hello')), /data-kind="output"/);
assert.match(render(fence('text', 'src/\n  Main.java')), /data-kind="source"/);
assert.match(render(fence('', 'plain')), /class="code-title">Code</);
assert.match(render(`**\`Greeter.java\`**, the class:\n\n${fence('java', java)}`), /class="code-title">Greeter.java</);
assert.doesNotMatch(render(`Compare \`One.java\` and \`Two.java\`.\n\n${fence('java', java)}`), /class="code-title">(?:One|Two).java</);
assert.match(render(fence('text title="<img src=x>"', 'safe')), /&#x3C;img src=x>/);
assert.doesNotMatch(render(fence('text title="<img src=x>"', 'safe')), /(?:^|>)<img/);

type Node = {type: string; tagName?: string; value?: string; children?: Node[]};
function codes(tree: Node): string[] {
  const text = (node: Node): string => node.value ?? (node.children ?? []).map(text).join('');
  if (tree.tagName === 'pre') return [text(tree)];
  return (tree.children ?? []).flatMap(codes);
}

// Highlight markup must preserve copied text, including whitespace and Unicode.
for (const code of [java, '\tfoo\n\nbar', 'é 👋\n  trailing  ', '', 'one\n']) {
  const markdown = fence('java {1-999999999}', code);
  const before = base().runSync(base().parse(markdown));
  const decorated = base().use(rehypeCodeBlocks);
  const after = decorated.runSync(decorated.parse(markdown));
  assert.deepEqual(codes(after), codes(before));
}

// All current posts must retain their original code and fence count.
let blocks = 0;
for (const file of readdirSync('content/posts').filter((name) => name.endsWith('.md'))) {
  const markdown = readFileSync(`content/posts/${file}`, 'utf8');
  const original = base();
  const decorated = base().use(rehypeCodeBlocks);
  const before = codes(original.runSync(original.parse(markdown)));
  const after = codes(decorated.runSync(decorated.parse(markdown)));
  assert.deepEqual(after, before, `${file}: code text changed`);
  blocks += before.length;
}

console.log(`Reading checks passed: metadata, escaping, multiline highlighting, and ${blocks} existing code blocks.`);
