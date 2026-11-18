// A small HAST subset keeps this plugin independent of a particular parser version.
type HtmlNode = {
  type: string;
  tagName?: string;
  value?: string;
  properties?: Record<string, unknown>;
  data?: {meta?: string | undefined};
  children?: HtmlNode[];
};

function element(tagName: string, properties: Record<string, unknown>, children: HtmlNode[]): HtmlNode {
  return {type: 'element', tagName, properties, children};
}

function text(value: string): HtmlNode {
  return {type: 'text', value};
}

function attribute(meta: string, name: string): string | undefined {
  return new RegExp(`(?:^|\\s)${name}=(?:"([^"]*)"|'([^']*)'|([^\\s]+))`).exec(meta)?.slice(1).find((value) => value !== undefined);
}

function highlightedLines(meta: string, count: number): Set<number> {
  const result = new Set<number>();
  const spec = attribute(meta, 'highlight') ?? /(?:^|\s)\{([\d,\s-]+)\}/.exec(meta)?.[1] ?? '';
  for (const range of spec.split(',')) {
    const match = /^\s*(\d+)(?:\s*-\s*(\d+))?\s*$/.exec(range);
    if (!match) continue;
    const first = Math.max(1, Number(match[1]));
    const last = Math.min(count, Number(match[2] ?? match[1]));
    for (let line = first; line <= last; line += 1) result.add(line);
  }
  return result;
}

// Split highlighted spans as well as text, preserving multiline strings/comments.
function splitLines(nodes: HtmlNode[]): HtmlNode[][] {
  const lines: HtmlNode[][] = [[]];
  for (const node of nodes) {
    const fragments = node.type === 'text'
      ? (node.value ?? '').split('\n').map((value) => [text(value)])
      : splitLines(node.children ?? []).map((children) => [{...node, children}]);
    fragments.forEach((fragment, index) => {
      if (index > 0) lines.push([]);
      lines[lines.length - 1]?.push(...fragment);
    });
  }
  return lines;
}

function nodeText(node: HtmlNode): string {
  return node.value ?? (node.children ?? []).map(nodeText).join('');
}

// Older articles already name files in the paragraph immediately before a fence.
// Reuse only an unambiguous inline filename; never invent a file from its code.
function precedingFilename(node: HtmlNode | undefined): string | undefined {
  if (node?.tagName !== 'p') return undefined;
  const filenames: string[] = [];
  function collect(current: HtmlNode): void {
    if (current.tagName === 'code' && /^[\w./-]+\.(?:java|xml|json|ya?ml|[cm]?[jt]sx?|py|sql|properties|toml|gradle|css|html|md)$/.test(nodeText(current))) {
      filenames.push(nodeText(current));
    }
    current.children?.forEach(collect);
  }
  collect(node);
  return filenames.length === 1 ? filenames[0] : undefined;
}

const LANGUAGE_LABELS: Record<string, string> = {
  java: 'Java', js: 'JavaScript', javascript: 'JavaScript', ts: 'TypeScript', typescript: 'TypeScript',
  xml: 'XML', json: 'JSON', yaml: 'YAML', yml: 'YAML', sql: 'SQL', python: 'Python', py: 'Python',
  bash: 'Bash', sh: 'Shell', shell: 'Shell', shellscript: 'Shell', console: 'Terminal', cmd: 'Windows CMD', powershell: 'PowerShell',
  text: 'Text', plaintext: 'Text', output: 'Output',
};
const TERMINAL_LANGUAGES = new Set(['bash', 'sh', 'shell', 'shellscript', 'console', 'cmd', 'powershell']);

/** Fence metadata: java title="Greeter.java" {3-5}, or text kind="output". */
export function rehypeCodeBlocks() {
  return function transform(tree: HtmlNode): void {
    function visit(parent: HtmlNode): void {
      if (!parent.children) return;
      parent.children = parent.children.map((node, index, siblings) => {
        const code = node.tagName === 'pre' ? node.children?.find((child) => child.tagName === 'code') : undefined;
        if (!code) {
          if (node.children) visit(node);
          return node;
        }
        const classes = Array.isArray(code.properties?.['className']) ? code.properties['className'] as string[] : [];
        const language = classes.find((name) => name.startsWith('language-'))?.slice(9) ?? '';
        const meta = code.data?.meta ?? '';
        const requestedKind = attribute(meta, 'kind');
        const kind = requestedKind === 'output' || language === 'output' ? 'output'
          : requestedKind === 'command' || TERMINAL_LANGUAGES.has(language) ? 'command' : 'source';
        const filename = attribute(meta, 'title') ?? attribute(meta, 'filename')
          ?? (kind === 'source' ? precedingFilename(siblings.slice(0, index).findLast((sibling) => sibling.type !== 'text' || Boolean(sibling.value?.trim()))) : undefined);
        const languageLabel = LANGUAGE_LABELS[language] ?? language;
        const label = filename || (kind === 'output' ? 'Output' : kind === 'command' ? 'Terminal' : languageLabel || 'Code');
        const source = nodeText(code);
        const lines = splitLines(code.children ?? []);
        if (source.endsWith('\n')) lines.pop();
        const highlighted = highlightedLines(meta, lines.length);
        if (highlighted.size > 0) {
          code.children = lines.flatMap((children, index) => [
            element('span', {className: ['code-line', ...(highlighted.has(index + 1) ? ['is-highlighted'] : [])]}, children),
            ...(index < lines.length - 1 || source.endsWith('\n') ? [text('\n')] : []),
          ]);
        }
        node.properties = {...node.properties, tabIndex: 0, role: 'region', ariaLabel: label};
        return element('div', {className: ['code-frame'], dataKind: kind}, [
          element('div', {className: ['code-bar']}, [
            element('span', {className: ['code-title']}, [text(label)]),
            ...(languageLabel && label !== languageLabel && kind !== 'output'
              ? [element('span', {className: ['code-language']}, [text(languageLabel)])] : []),
            element('button', {type: 'button', className: ['code-copy'], ariaLabel: `Copy ${label}`, ariaLive: 'polite'}, [text('Copy')]),
          ]),
          node,
        ]);
      });
    }
    visit(tree);
  };
}
