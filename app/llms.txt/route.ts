import {publishedPosts} from '../../content/posts';
import {contributions, prUrl} from '../../lib/contributions';
import {SITE} from '../../lib/site';

export function GET() {
  const contributionItems = contributions
    .map(
      (c) =>
        `- [OpenTelemetry Java PR #${c.number}: ${c.title}](${SITE.url}/work/${c.slug}): ${c.summary} (Merged PR: ${prUrl(c.number)})`,
    )
    .join('\n');

  const postItems = publishedPosts
    .map(
      (post) =>
        `- [${post.title}](${SITE.url}/blog/${post.slug}) (${post.publishedAt} · ${post.topics.join(', ')}): ${post.excerpt}`,
    )
    .join('\n');

  const speakingItems = SITE.speaking
    .map(
      (talk) =>
        `- **${talk.title}** — ${talk.event}${talk.location !== 'TBD' ? `, ${talk.location}` : ''} [${talk.status}]: ${talk.summary}`,
    )
    .join('\n');

  const markdown = [
    `# ${SITE.fullName} (${SITE.handle})`,
    '',
    `> ${SITE.bio}`,
    '',
    '## Identity & Name Variants',
    '',
    `- **Canonical Name**: ${SITE.fullName} (${SITE.name})`,
    `- **Handle / Username**: \`${SITE.handle}\``,
    `- **Known Transliterations & Search Variants**: ${SITE.alternateNames.join(', ')}`,
    `- **Role**: ${SITE.jobTitle} at ${SITE.employer}`,
    `- **Location**: ${SITE.location}`,
    `- **Core Topics**: ${SITE.knowsAbout.join(', ')}`,
    '',
    '## Primary Pages',
    '',
    `- [Home](${SITE.url}/): Overview of ${SITE.name}'s Java backend engineering work, OpenTelemetry Java SDK contributions, and writing.`,
    `- [Open Source Casebook](${SITE.url}/work): Evidence-backed engineering records of merged pull requests in \`open-telemetry/opentelemetry-java\`.`,
    `- [Technical Blog](${SITE.url}/blog): Deep-dive notes on Java concurrency, collections, observability internals, and regression testing.`,
    `- [Speaking](${SITE.url}/speaking): Conference talks and proposals (${SITE.speaking.map((s) => s.event).join(', ')}).`,
    `- [About](${SITE.url}/about): Biography, transliteration reference, and contact links.`,
    `- [Full LLM Context Corpus](${SITE.url}${SITE.llmsFull}): Single-file complete Markdown corpus containing full PR analyses and full-text blog notes.`,
    '',
    '## OpenTelemetry Java Contributions (`open-telemetry/opentelemetry-java`)',
    '',
    contributionItems,
    '',
    '## Technical Blog Notes',
    '',
    postItems,
    '',
    '## Speaking',
    '',
    speakingItems,
    '',
    '## Profiles & Feeds',
    '',
    `- [GitHub (@${SITE.handle})](${SITE.github})`,
    `- [LinkedIn (${SITE.fullName})](${SITE.linkedin})`,
    `- [RSS Feed](${SITE.url}${SITE.rss})`,
    '',
  ].join('\n');

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=3600, s-maxage=3600',
    },
  });
}
