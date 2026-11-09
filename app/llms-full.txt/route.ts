import {publishedPosts} from '../../content/posts';
import {contributions, prUrl} from '../../lib/contributions';
import {talks} from '../../lib/content/load';
import {SITE} from '../../lib/site';

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
        post.excerpt,
      ].join('\n');
    })
    .join('\n\n---\n\n');

  const speakingSections = talks
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
    '## 3. Technical Blog Notes',
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
