import {pageMarkdown, searchCorpus, type AgentCorpus} from './content';

export type JsonSchema = {
  type: 'object' | 'string';
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: readonly string[];
  additionalProperties?: boolean;
};

export type ToolSpec = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
};

const querySchema: JsonSchema = {
  type: 'object',
  properties: {
    query: {type: 'string', description: 'Words to match against titles and prose.'},
  },
  required: ['query'],
  additionalProperties: false,
};

const slugSchema: JsonSchema = {
  type: 'object',
  properties: {
    slug: {type: 'string', description: 'Page slug, such as pooled-hashmap.'},
  },
  required: ['slug'],
  additionalProperties: false,
};

const emptySchema: JsonSchema = {
  type: 'object',
  properties: {},
  additionalProperties: false,
};

export const AGENT_TOOLS: readonly ToolSpec[] = [
  {
    name: 'search_site',
    title: 'Search the site',
    description: 'Search published notes, OpenTelemetry Java case studies, and talks.',
    inputSchema: querySchema,
  },
  {
    name: 'read_post',
    title: 'Read a note',
    description: 'Return the markdown for one published note.',
    inputSchema: slugSchema,
  },
  {
    name: 'list_posts',
    title: 'List notes',
    description: 'List published technical notes.',
    inputSchema: emptySchema,
  },
  {
    name: 'read_work',
    title: 'Read a case study',
    description: 'Return the markdown for one merged OpenTelemetry Java contribution.',
    inputSchema: slugSchema,
  },
  {
    name: 'list_work',
    title: 'List case studies',
    description: 'List merged OpenTelemetry Java contributions in the casebook.',
    inputSchema: emptySchema,
  },
  {
    name: 'list_talks',
    title: 'List talks',
    description: 'List talks. Upcoming means scheduled. Proposals are not accepted appearances.',
    inputSchema: emptySchema,
  },
];

function argument(args: Record<string, unknown>, key: string): string {
  const value = args[key];
  return typeof value === 'string' ? value.trim() : '';
}

export function callTool(corpus: AgentCorpus, name: string, args: Record<string, unknown>): string {
  if (!AGENT_TOOLS.some((tool) => tool.name === name)) throw new Error(`Unknown tool: ${name}`);
  if (name === 'search_site') {
    const query = argument(args, 'query');
    if (!query) throw new Error('query is required');
    const hits = searchCorpus(corpus, query, 8);
    if (hits.length === 0) return `No published page matches "${query}".`;
    return hits.map((hit) => `- [${hit.title}](${hit.url}) (${hit.kind}): ${hit.excerpt}`).join('\n');
  }
  if (name === 'read_post') {
    const slug = argument(args, 'slug');
    if (!slug) throw new Error('slug is required');
    return pageMarkdown(corpus, `/blog/${slug}`) ?? `No published note with slug ${slug}.`;
  }
  if (name === 'list_posts') {
    if (corpus.posts.length === 0) return 'No published notes.';
    return corpus.posts
      .map((post) => `- [${post.title}](${corpus.site.url}/blog/${post.slug}) (${post.publishedAt}): ${post.excerpt}`)
      .join('\n');
  }
  if (name === 'read_work') {
    const slug = argument(args, 'slug');
    if (!slug) throw new Error('slug is required');
    return pageMarkdown(corpus, `/work/${slug}`) ?? `No case study with slug ${slug}.`;
  }
  if (name === 'list_work') {
    if (corpus.work.length === 0) return 'No case studies.';
    return corpus.work
      .map((item) => `- [#${item.number} ${item.title}](${corpus.site.url}/work/${item.slug}): ${item.summary}`)
      .join('\n');
  }
  if (name === 'list_talks') {
    if (corpus.talks.length === 0) return 'No talks.';
    return corpus.talks
      .map((talk) => `- ${talk.title} — ${talk.event} [${talk.status}]: ${talk.summary}`)
      .join('\n');
  }
  throw new Error(`Unknown tool: ${name}`);
}
