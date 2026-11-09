import type {PostDocument, Talk, WorkCase} from '../content/schema';

export type AgentSite = {
  url: string;
  name: string;
  fullName: string;
  handle: string;
  bio: string;
  role: string;
  jobTitle: string;
  employer: string;
  location: string;
  github: string;
  linkedin: string;
  knowsAbout: readonly string[];
  alternateNames: readonly string[];
};

export type AgentCorpus = {
  site: AgentSite;
  posts: readonly PostDocument[];
  work: readonly WorkCase[];
  talks: readonly Talk[];
};

export type SearchHit = {
  kind: 'post' | 'work' | 'talk';
  slug: string;
  title: string;
  url: string;
  excerpt: string;
  score: number;
};

const STATIC_PAGES = new Set(['/', '/blog', '/work', '/speaking', '/about']);

export function canonicalPage(pathname: string): string | null {
  let path = pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (STATIC_PAGES.has(path)) return path;
  if (/^\/blog\/[a-z0-9-]+$/.test(path)) return path;
  if (/^\/work\/[a-z0-9-]+$/.test(path)) return path;
  return null;
}

export function markdownRequestPath(pathname: string): string | null {
  let path = pathname;
  if (path.length > 1 && path.endsWith('/')) path = path.slice(0, -1);
  if (path.endsWith('/index.md')) {
    const stripped = path.slice(0, -'/index.md'.length);
    return canonicalPage(stripped === '' ? '/' : stripped);
  }
  if (path.endsWith('.md')) return canonicalPage(path.slice(0, -3) || '/');
  return null;
}

export function markdownTokens(markdown: string): number {
  return Math.max(1, Math.ceil(markdown.length / 4));
}

function absolute(site: AgentSite, path: string): string {
  return `${site.url}${path}`;
}

function pullRequestUrl(number: number): string {
  return `https://github.com/open-telemetry/opentelemetry-java/pull/${number}`;
}

function tokens(query: string): string[] {
  return [...new Set(query.toLowerCase().split(/[^a-z0-9+#.]+/).filter((token) => token.length >= 2))];
}

function scoreText(text: string, terms: readonly string[]): number {
  const haystack = text.toLowerCase();
  let score = 0;
  for (const term of terms) {
    if (haystack.includes(term)) score += term.length;
  }
  return score;
}

export function searchCorpus(corpus: AgentCorpus, query: string, limit = 8): SearchHit[] {
  const terms = tokens(query);
  const hits: SearchHit[] = [];
  for (const post of corpus.posts) {
    const score =
      terms.length === 0
        ? 1
        : scoreText([post.title, post.description, post.excerpt, post.topics.join(' '), post.body].join('\n'), terms);
    if (score <= 0) continue;
    hits.push({
      kind: 'post',
      slug: post.slug,
      title: post.title,
      url: absolute(corpus.site, `/blog/${post.slug}`),
      excerpt: post.excerpt,
      score: score + 2,
    });
  }
  for (const item of corpus.work) {
    const score =
      terms.length === 0
        ? 1
        : scoreText([item.title, item.shortTitle, item.topic, item.summary, item.problem, item.change].join('\n'), terms);
    if (score <= 0) continue;
    hits.push({
      kind: 'work',
      slug: item.slug,
      title: item.title,
      url: absolute(corpus.site, `/work/${item.slug}`),
      excerpt: item.summary,
      score: score + 1,
    });
  }
  for (const talk of corpus.talks) {
    const score =
      terms.length === 0
        ? 1
        : scoreText([talk.title, talk.event, talk.summary, talk.detail ?? ''].join('\n'), terms);
    if (score <= 0) continue;
    hits.push({
      kind: 'talk',
      slug: talk.slug,
      title: talk.title,
      url: absolute(corpus.site, '/speaking'),
      excerpt: talk.summary,
      score,
    });
  }
  hits.sort((left, right) => right.score - left.score || left.title.localeCompare(right.title));
  return hits.slice(0, limit);
}

export function answerQuestion(corpus: AgentCorpus, question: string): string {
  const asked = question.trim();
  if (!asked) return pageMarkdown(corpus, '/') ?? corpus.site.bio;
  const hits = searchCorpus(corpus, asked, 5);
  if (hits.length === 0) {
    return `Nothing on ${corpus.site.url} matches that. Start with ${absolute(corpus.site, '/llms.txt')}.`;
  }
  return [
    `Matches on ${corpus.site.url} for "${asked}":`,
    '',
    ...hits.map((hit) => `- [${hit.title}](${hit.url}) (${hit.kind}): ${hit.excerpt}`),
  ].join('\n');
}

function postMarkdown(corpus: AgentCorpus, post: PostDocument): string {
  return [
    `# ${post.title}`,
    '',
    `Canonical: ${absolute(corpus.site, `/blog/${post.slug}`)}`,
    `Published: ${post.publishedAt}`,
    `Updated: ${post.updatedAt}`,
    `Topics: ${post.topics.join(', ')}`,
    '',
    post.excerpt,
    '',
    post.body.trim(),
    '',
  ].join('\n');
}

function workMarkdown(corpus: AgentCorpus, item: WorkCase): string {
  const lines = [
    `# ${item.title}`,
    '',
    `Canonical: ${absolute(corpus.site, `/work/${item.slug}`)}`,
    `Pull request: ${pullRequestUrl(item.number)}`,
    `Topic: ${item.topic}`,
    '',
    item.summary,
    '',
    '## Problem',
    '',
    item.problem,
    '',
    '## Change',
    '',
    item.change,
    '',
    '## Verification',
    '',
    item.verification,
    '',
    '## Boundary',
    '',
    item.boundary,
  ];
  if (item.noteSlug) lines.push('', `Companion note: ${absolute(corpus.site, `/blog/${item.noteSlug}`)}`);
  lines.push('');
  return lines.join('\n');
}

function homeMarkdown(corpus: AgentCorpus): string {
  const latest = corpus.posts[0];
  const delivered = corpus.talks.find((talk) => talk.status === 'Upcoming') ?? corpus.talks.find((talk) => talk.status === 'Delivered') ?? corpus.talks[0];
  const lines = [
    `# ${corpus.site.name}`,
    '',
    `> ${corpus.site.bio}`,
    '',
    'I want the mechanism. How it works, not the brochure for what it does.',
    '',
    'Act like the bug is already beaten. Then do the work that makes it true.',
    '',
    `GitHub: ${corpus.site.github}`,
    `LinkedIn: ${corpus.site.linkedin}`,
    '',
    '## Latest writing',
    '',
  ];
  if (latest) {
    lines.push(`- [${latest.title}](${absolute(corpus.site, `/blog/${latest.slug}`)}) (${latest.publishedAt}): ${latest.excerpt}`, '');
  } else {
    lines.push('No published notes yet.', '');
  }
  lines.push('## Open source', '', 'Selected merged contributions to the OpenTelemetry Java SDK.', '');
  for (const item of corpus.work) {
    lines.push(`- [#${item.number} ${item.shortTitle}](${absolute(corpus.site, `/work/${item.slug}`)}): ${item.summary}`);
  }
  lines.push('', '## Speaking', '');
  if (delivered) {
    lines.push(`- **${delivered.title}** — ${delivered.event} [${delivered.status}]: ${delivered.summary}`, '');
  }
  lines.push(
    '## Machine-readable access',
    '',
    `- Directory: ${absolute(corpus.site, '/llms.txt')}`,
    `- Full text: ${absolute(corpus.site, '/llms-full.txt')}`,
    `- Content API: ${absolute(corpus.site, '/openapi.json')}`,
    `- Tools: ${absolute(corpus.site, '/mcp')}`,
    '- Usage: search=yes, ai-input=yes, ai-train=no',
    '',
  );
  return lines.join('\n');
}

export function pageMarkdown(corpus: AgentCorpus, pathname: string): string | null {
  const page = canonicalPage(pathname);
  if (!page) return null;
  if (page === '/') return homeMarkdown(corpus);
  if (page === '/blog') {
    const lines = [
      '# Follow the reasoning',
      '',
      `Notes on how Java, the JVM, and observability work, by ${corpus.site.fullName} (${corpus.site.handle}).`,
      '',
      `RSS: ${absolute(corpus.site, '/feed.xml')}`,
      '',
    ];
    for (const post of corpus.posts) {
      lines.push(`## [${post.title}](${absolute(corpus.site, `/blog/${post.slug}`)})`, '', `${post.publishedAt} · ${post.topics.join(', ')}`, '', post.excerpt, '');
    }
    return lines.join('\n');
  }
  if (page === '/work') {
    const lines = [
      '# Work you can inspect',
      '',
      `Selected merged contributions to the OpenTelemetry Java SDK by ${corpus.site.fullName}. Each record connects the problem, the change, and the tests to the source.`,
      '',
    ];
    for (const item of corpus.work) {
      lines.push(`## [${item.title}](${absolute(corpus.site, `/work/${item.slug}`)})`, '', `Merged pull request #${item.number}. ${item.summary}`, '');
    }
    return lines.join('\n');
  }
  if (page === '/speaking') {
    const lines = [
      '# From the code to the conversation',
      '',
      `Conference talks by ${corpus.site.fullName} (${corpus.site.handle}) on open source and observability engineering.`,
      '',
    ];
    for (const talk of corpus.talks) {
      const place = talk.location === 'TBD' ? '' : `, ${talk.location}`;
      lines.push(`## ${talk.title}`, '', `${talk.status} — ${talk.event}${place}`, '', talk.summary);
      if (talk.detail) lines.push('', talk.detail);
      if (talk.status === 'Proposal') lines.push('', 'This is a proposal, not an accepted appearance.');
      if (talk.status === 'Upcoming') lines.push('', 'This talk is scheduled and has not been delivered yet.');
      lines.push('');
    }
    return lines.join('\n');
  }
  if (page === '/about') {
    return [
      `# ${corpus.site.fullName}`,
      '',
      `Java backend engineer at ${corpus.site.employer}, based in ${corpus.site.location}. The writing is about observability, Java, the JVM, open source, and AI: how a thing works, not the sentence about what it does.`,
      '',
      '## Working in the details',
      '',
      'I contribute to the OpenTelemetry Java SDK because that is where the mechanism is public: collection behavior, executor limits, sampler configuration, and configuration errors.',
      '',
      'This site keeps the explanations close to their evidence: the code, the tests, and the review discussion.',
      '',
      `Casebook: ${absolute(corpus.site, '/work')}`,
      '',
      '## Speaking',
      '',
      'I spoke at Devoxx Morocco 2026 about the next generation entering open source.',
      '',
      `Speaking: ${absolute(corpus.site, '/speaking')}`,
      '',
      '## Get in touch',
      '',
      `For technical conversations or speaking inquiries, reach me on LinkedIn: ${corpus.site.linkedin}. For discussions about a specific contribution, its GitHub pull request provides the context.`,
      '',
      '## Name and citation',
      '',
      `Full name: ${corpus.site.fullName}. Depending on French or English transliteration from Arabic, the name also appears as ${corpus.site.alternateNames.slice(0, 4).join(', ')}. GitHub: \`${corpus.site.handle}\`.`,
      '',
    ].join('\n');
  }
  if (page.startsWith('/blog/')) {
    const post = corpus.posts.find((item) => item.slug === page.slice('/blog/'.length));
    return post ? postMarkdown(corpus, post) : null;
  }
  const item = corpus.work.find((entry) => entry.slug === page.slice('/work/'.length));
  return item ? workMarkdown(corpus, item) : null;
}
