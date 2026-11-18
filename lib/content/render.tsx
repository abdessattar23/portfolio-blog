'use client';

import {useEffect, useRef, type ReactNode} from 'react';
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
import {trackEvent} from '../analytics/events';
import {stripDuplicateTitle} from './headings';
import {sectionsFromMarkdown} from './schema';
import {rehypeCodeBlocks} from './code-blocks';

const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeHighlight, {plainText: ['output']})
  .use(rehypeCodeBlocks)
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
  let html = String(processor.processSync(cleaned)).replace(/<h2>([\s\S]*?)<\/h2>/g, (_match, inner: string) => {
    const id = ids[heading] ?? `section-${heading}`;
    heading += 1;
    return `<h2 id="${id}">${inner}</h2>`;
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
          <ProseHtml html={renderMarkdownToHtml(segment.text, false)} />
        </div>,
      );
      return;
    }
    const lead = !seenMarkdown;
    seenMarkdown = true;
    nodes.push(<ProseHtml key={index} html={renderMarkdownToHtml(segment.text, lead)} />);
  });

  return <>{nodes}</>;
}

function ProseHtml({html}: {html: string}) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    const timers = new Set<number>();
    function onCopy(event: MouseEvent) {
      const button = event.target instanceof Element ? event.target.closest<HTMLButtonElement>('.code-copy') : null;
      if (!button || !root?.contains(button)) return;
      const frame = button.closest('.code-frame');
      const code = frame?.querySelector('pre code');
      if (!code) return;
      const slug = /^\/blog\/([a-z0-9-]+)$/.exec(window.location.pathname)?.[1];
      trackEvent('article_code_copy', {
        pagePath: window.location.pathname,
        ...(slug ? {articleSlug: slug} : {}),
        target: frame?.querySelector('.code-title')?.textContent ?? 'code',
      });
      // Copy the original text, without filenames, controls or highlight markup.
      const copy = navigator.clipboard?.writeText(code.textContent ?? '');
      void (copy ?? Promise.reject(new Error('Clipboard unavailable'))).then(() => {
        button.textContent = 'Copied';
      }).catch(() => {
        button.textContent = 'Copy failed';
      }).finally(() => {
        const timer = window.setTimeout(() => {
          button.textContent = 'Copy';
          timers.delete(timer);
        }, 1800);
        timers.add(timer);
      });
    }
    root.addEventListener('click', onCopy);
    return () => {
      root.removeEventListener('click', onCopy);
      timers.forEach((timer) => window.clearTimeout(timer));
    };
  }, [html]);
  return <div ref={ref} dangerouslySetInnerHTML={{__html: html}} />;
}
