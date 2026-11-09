'use client';

import type {ReactNode} from 'react';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import BucketDemo from '../../components/bucket-demo';
import {sectionsFromMarkdown} from './schema';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeHighlight)
  .use(rehypeStringify);

const DEMOS = {
  bucket: BucketDemo,
} as const;

type DemoName = keyof typeof DEMOS;

type Segment =
  | {kind: 'markdown'; text: string}
  | {kind: 'demo'; name: string}
  | {kind: 'note'; title: string; text: string};

function isDemoName(name: string): name is DemoName {
  return Object.hasOwn(DEMOS, name);
}

export function splitBlocks(markdown: string): Segment[] {
  const lines = markdown.split(/\r?\n/);
  const segments: Segment[] = [];
  const buffer: string[] = [];

  function flush() {
    const text = buffer.join('\n');
    buffer.length = 0;
    if (text.trim() !== '') segments.push({kind: 'markdown', text});
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    const demo = /^:::demo\{name="([a-z0-9-]+)"\}\s*$/.exec(line);
    const demoName = demo?.[1];
    if (demoName) {
      flush();
      segments.push({kind: 'demo', name: demoName});
      continue;
    }
    if (line.trim() === ':::note') {
      flush();
      const title = (lines[index + 1] ?? '').replace(/^#+\s*/, '').trim();
      const note: string[] = [];
      index += 2;
      while (index < lines.length && (lines[index] ?? '').trim() !== ':::') {
        note.push(lines[index] ?? '');
        index += 1;
      }
      segments.push({kind: 'note', title, text: note.join('\n').trim()});
      continue;
    }
    buffer.push(line);
  }
  flush();
  return segments;
}

export function renderMarkdownToHtml(markdown: string, lead = false): string {
  const cleaned = markdown.replace(/^(##\s+.+?)\s*\{#[a-z0-9-]+\}\s*$/gm, '$1');
  const ids = sectionsFromMarkdown(markdown).map((section) => section.id);
  let heading = 0;
  let html = String(processor.processSync(cleaned)).replace(/<h2>/g, () => {
    const id = ids[heading] ?? `section-${heading}`;
    heading += 1;
    return `<h2 id="${id}">`;
  });
  if (lead) html = html.replace('<p>', '<p class="lead">');
  return html;
}

export function MarkdownView({markdown}: {markdown: string}) {
  const segments = splitBlocks(markdown);
  let seenMarkdown = false;
  const nodes: ReactNode[] = [];

  segments.forEach((segment, index) => {
    if (segment.kind === 'demo') {
      if (!isDemoName(segment.name)) {
        nodes.push(<p key={index}>Unknown demo: {segment.name}</p>);
        return;
      }
      const Demo = DEMOS[segment.name];
      nodes.push(<Demo key={index} />);
      return;
    }
    if (segment.kind === 'note') {
      nodes.push(
        <div className="note" key={index}>
          <h3>{segment.title}</h3>
          <p>{segment.text}</p>
        </div>,
      );
      return;
    }
    const lead = !seenMarkdown;
    seenMarkdown = true;
    nodes.push(
      <div key={index} dangerouslySetInnerHTML={{__html: renderMarkdownToHtml(segment.text, lead)}} />,
    );
  });

  return <>{nodes}</>;
}
