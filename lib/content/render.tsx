'use client';

import type {ReactNode} from 'react';
import rehypeHighlight from 'rehype-highlight';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import {unified} from 'unified';
import {ArtifactFigure} from '../../components/artifacts/artifact-figure';
import {ArticleDemo} from '../../components/article-demo';
import BucketDemo from '../../components/bucket-demo';
import {matchArtifactFence} from '../artifacts/format';
import type {ArtifactDocument} from '../artifacts/schema';
import {stripDuplicateTitle} from './headings';
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

export type Segment =
  | {kind: 'markdown'; text: string}
  | {kind: 'demo'; name: string; body: string}
  | {kind: 'note'; title: string; text: string}
  | {kind: 'artifact'; id: string};

function isDemoName(name: string): name is DemoName {
  return Object.hasOwn(DEMOS, name);
}

export function splitBlocks(markdown: string): Segment[] {
  const lines = markdown.split(/\r?\n/);
  const segments: Segment[] = [];
  const buffer: string[] = [];
  let inFence = false;

  function flush() {
    const text = buffer.join('\n');
    buffer.length = 0;
    if (text.trim() !== '') segments.push({kind: 'markdown', text});
  }

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index] ?? '';
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inFence = !inFence;
      buffer.push(line);
      continue;
    }
    if (inFence) {
      buffer.push(line);
      continue;
    }

    const artifactId = matchArtifactFence(line);
    if (artifactId) {
      flush();
      segments.push({kind: 'artifact', id: artifactId});
      continue;
    }

    const demo = /^:::demo\{name="([a-z0-9-]+)"\}\s*$/.exec(line);
    const demoName = demo?.[1];
    if (demoName) {
      flush();
      const next = lines[index + 1] ?? '';
      if (next.trim() === '') {
        segments.push({kind: 'demo', name: demoName, body: ''});
        continue;
      }
      let closeIndex = index + 1;
      while (closeIndex < lines.length && (lines[closeIndex] ?? '').trim() !== ':::') closeIndex += 1;
      if (closeIndex < lines.length) {
        segments.push({kind: 'demo', name: demoName, body: lines.slice(index + 1, closeIndex).join('\n').trim()});
        index = closeIndex;
        continue;
      }
      segments.push({kind: 'demo', name: demoName, body: ''});
      continue;
    }
    if (line.trim() === ':::note') {
      let closeIndex = index + 2;
      while (closeIndex < lines.length && (lines[closeIndex] ?? '').trim() !== ':::') {
        closeIndex += 1;
      }
      if (closeIndex < lines.length) {
        flush();
        const title = (lines[index + 1] ?? '').replace(/^#+\s*/, '').trim();
        const note = lines.slice(index + 2, closeIndex).join('\n').trim();
        segments.push({kind: 'note', title, text: note});
        index = closeIndex;
        continue;
      }
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

export function MarkdownView({
  markdown,
  title = '',
  artifacts = [],
}: {
  markdown: string;
  title?: string;
  artifacts?: readonly ArtifactDocument[];
}) {
  const segments = splitBlocks(stripDuplicateTitle(markdown, title));
  let seenMarkdown = false;
  const nodes: ReactNode[] = [];

  segments.forEach((segment, index) => {
    if (segment.kind === 'artifact') {
      nodes.push(<ArtifactFigure key={index} id={segment.id} artifacts={artifacts} />);
      return;
    }
    if (segment.kind === 'demo') {
      if (segment.name === 'walk' || segment.name === 'compare') {
        nodes.push(<ArticleDemo key={index} name={segment.name} body={segment.body} />);
        return;
      }
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
          <div dangerouslySetInnerHTML={{__html: renderMarkdownToHtml(segment.text, false)}} />
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
