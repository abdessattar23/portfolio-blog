import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {publishedPosts} from '../../content/posts';
import {contributions, prUrl} from '../../lib/contributions';
import {SITE} from '../../lib/site';

const HTML_ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#x27;': "'",
  '&apos;': "'",
};

function decodeEntities(text: string): string {
  return text.replace(/&(amp|lt|gt|quot|#x27|apos);/g, (match) => HTML_ENTITIES[match] ?? match);
}

function jsxContentToMarkdown(html: string): string {
  return decodeEntities(
    html
      .replace(/<div class="demo"[\s\S]*?<\/div><\/div>/g, '')
      .replace(
        /<pre><code>([\s\S]*?)<\/code><\/pre>/g,
        (_, code: string) => `\n\`\`\`java\n${decodeEntities(code).trim()}\n\`\`\`\n\n`,
      )
      .replace(
        /<div class="note"><h3>([\s\S]*?)<\/h3><p>([\s\S]*?)<\/p><\/div>/g,
        '\n> **$1:** $2\n\n',
      )
      .replace(/<h2[^>]*>([\s\S]*?)<\/h2>/g, '\n#### $1\n\n')
      .replace(/<h3[^>]*>([\s\S]*?)<\/h3>/g, '\n##### $1\n\n')
      .replace(/<p[^>]*>([\s\S]*?)<\/p>/g, '$1\n\n')
      .replace(/<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g, (_, href: string, label: string) => {
        const fullUrl = href.startsWith('/') ? `${SITE.url}${href}` : href;
        return `[${label}](${fullUrl})`;
      })
      .replace(/<code>([\s\S]*?)<\/code>/g, '`$1`')
      .replace(/<(em|i)>([\s\S]*?)<\/\1>/g, '*$2*')
      .replace(/<(strong|b)>([\s\S]*?)<\/\1>/g, '**$2**')
      .replace(/<[^>]+>/g, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
  );
}

export function GET() {
  const contributionSections = contributions
    .map((c) => {
      const lines = [
        `### PR #${c.number}: ${c.title} (\`${c.slug}\`)`,
        '',
        `- **Casebook URL**: ${SITE.url}/work/${c.slug}`,
        `- **Upstream Pull Request**: ${prUrl(c.number)}`,
        `- **Topic**: ${c.topic} (${c.shortTitle})`,
        `- **Summary**: ${c.summary}`,
        `- **The Problem**: ${c.problem}`,
        `- **The Merged Change**: ${c.change}`,
        `- **Verification & Tests**: ${c.verification}`,
        `- **Scope & Boundary**: ${c.boundary}`,
      ];
      if (c.noteSlug) {
        lines.push(`- **Companion Technical Note**: ${SITE.url}/blog/${c.noteSlug}`);
      }
      return lines.join('\n');
    })
    .join('\n\n---\n\n');

  const postSections = publishedPosts
    .map((post) => {
      const renderedHtml = renderToStaticMarkup(createElement(post.Content));
      const bodyMarkdown = jsxContentToMarkdown(renderedHtml);
      const diffBlock = post.homeDiff
        ? `\n- **Core Diff Summary**: \`- ${post.homeDiff.removed}\` → \`+ ${post.homeDiff.added}\``
        : '';

      return [
        `### ${post.title}`,
        '',
        `- **Canonical URL**: ${SITE.url}/blog/${post.slug}`,
        `- **Published**: ${post.publishedAt}`,
        `- **Topics**: ${post.topics.join(', ')}`,
        `- **Description**: ${post.description}${diffBlock}`,
        '',
        bodyMarkdown,
      ].join('\n');
    })
    .join('\n\n---\n\n');

  const speakingSections = SITE.speaking
    .map(
      (talk) =>
        `### ${talk.title}\n- **Event**: ${talk.event}${talk.location !== 'TBD' ? ` (${talk.location})` : ''}\n- **Status**: ${talk.status}\n- **Summary**: ${talk.summary}`,
    )
    .join('\n\n');

  const fullCorpus = [
    `# ${SITE.fullName} (${SITE.handle}) — Complete Technical Corpus`,
    '',
    `> ${SITE.bio}`,
    '',
    '## 1. Identity, Role & Name Transliteration Graph',
    '',
    `- **Primary Display Name**: ${SITE.name}`,
    `- **Full Name**: ${SITE.fullName}`,
    `- **GitHub / Domain Handle**: \`${SITE.handle}\``,
    `- **Alternate Spellings & Transliterations**: ${SITE.alternateNames.join(' · ')}`,
    `- **Current Role**: ${SITE.jobTitle} at ${SITE.employer}`,
    `- **Location**: ${SITE.location}`,
    `- **Areas of Expertise**: ${SITE.knowsAbout.join(', ')}`,
    `- **Website**: ${SITE.url}`,
    `- **GitHub**: ${SITE.github}`,
    `- **LinkedIn**: ${SITE.linkedin}`,
    `- **RSS**: ${SITE.url}${SITE.rss}`,
    '',
    '## 2. OpenTelemetry Java SDK Contributions (`open-telemetry/opentelemetry-java`)',
    '',
    'All contributions listed below are merged pull requests authored by `abdessattar23` in the official `open-telemetry/opentelemetry-java` repository.',
    '',
    contributionSections,
    '',
    '## 3. Technical Blog Notes (Full Text)',
    '',
    postSections,
    '',
    '## 4. Speaking & Conference History',
    '',
    speakingSections,
    '',
  ].join('\n');

  return new Response(fullCorpus, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
