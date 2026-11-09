import {prUrl} from '../../lib/contributions';
import {SITE} from '../../lib/site';
import {livePublishedPosts, liveTalks, liveWorkCases} from '../../lib/studio/published';

export async function GET() {
  const [publishedPosts, contributions, talks] = await Promise.all([
    livePublishedPosts(),
    liveWorkCases(),
    liveTalks(),
  ]);

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

  const speakingItems = talks
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
    `- [Home](${SITE.url}/): ${SITE.name} on observability, Java, the JVM, open source, and AI. Mechanism over feature lists.`,
    `- [Open Source Casebook](${SITE.url}/work): Evidence-backed engineering records of merged pull requests in \`open-telemetry/opentelemetry-java\`.`,
    `- [Technical Blog](${SITE.url}/blog): Notes on how Java, the JVM, and observability actually work.`,
    `- [Speaking](${SITE.url}/speaking): Conference talks and proposals (${talks.map((item) => item.event).join(', ')}).`,
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
    '## Agent access',
    '',
    'Public pages need no login. Request markdown with `Accept: text/markdown`, or append `/index.md` to a page URL.',
    '',
    `- [API catalog](${SITE.url}/.well-known/api-catalog)`,
    `- [OpenAPI content API](${SITE.url}/openapi.json)`,
    `- [MCP server card](${SITE.url}/.well-known/mcp/server-card.json)`,
    `- [Agent skills](${SITE.url}/.well-known/agent-skills/index.json)`,
    `- [auth.md](${SITE.url}/auth.md)`,
    '',
    'Content use: search and AI input are allowed. AI training is not (`Content-Signal: ai-train=no, search=yes, ai-input=yes`).',
    '',
  ].join('\n');

  return new Response(markdown, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=300, s-maxage=300',
    },
  });
}
