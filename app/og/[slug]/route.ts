import type {PostTemplate} from '../../../lib/content/schema';
import {livePublishedPost} from '../../../lib/studio/published';

export const TEMPLATE_LABEL: Record<PostTemplate, string> = {
  'deep-dive': 'Deep dive',
  'bug-story': 'Bug story',
  til: 'Today I learned',
  'talk-notes': 'Talk notes',
};

function escapeXml(value: string) {
  return value.replace(/[&<>"]/g, (char) => {
    if (char === '&') return '&amp;';
    if (char === '<') return '&lt;';
    if (char === '>') return '&gt;';
    return '&quot;';
  });
}

function wrap(value: string, width: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of value.split(/\s+/)) {
    const next = current === '' ? word : `${current} ${word}`;
    if (next.length > width && current !== '') {
      lines.push(current);
      current = word;
    } else {
      current = next;
    }
  }
  if (current !== '') lines.push(current);
  return lines.slice(0, 4);
}

export async function GET(_request: Request, context: {params: Promise<{slug: string}>}) {
  const {slug} = await context.params;
  const post = await livePublishedPost(slug);
  if (!post) return new Response('Not found', {status: 404});
  const accent = post.accent ?? (post.template === 'bug-story' ? '#f06a45' : '#3155d9');
  const lines = wrap(post.title, 34);
  const text = lines
    .map((line, index) => `<text x="72" y="${210 + index * 68}" fill="#17202a" font-size="54" font-family="Georgia, serif">${escapeXml(line)}</text>`)
    .join('');
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <rect width="1200" height="630" fill="#f5f2ea"/>
  <rect x="0" y="0" width="18" height="630" fill="${accent}"/>
  <text x="72" y="110" fill="${accent}" font-size="24" font-family="Consolas, monospace" letter-spacing="3">${escapeXml(TEMPLATE_LABEL[post.template].toUpperCase())}</text>
  ${text}
  <text x="72" y="540" fill="#646b72" font-size="28" font-family="Consolas, monospace">abdessattar.dev</text>
</svg>`;
  return new Response(svg, {
    headers: {
      'Content-Type': 'image/svg+xml; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
    },
  });
}
