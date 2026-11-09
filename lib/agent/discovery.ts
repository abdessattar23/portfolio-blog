import {AGENT_PATHS, CONTENT_SIGNAL} from './policy';
import {AGENT_TOOLS} from './tools';
import type {AgentSite} from './content';

const SKILLS = {
  'read-site': 'Read this site as markdown, cite the author, and respect the content-use signals.',
  'cite-work': 'Cite merged OpenTelemetry Java contributions from the casebook without inventing pull requests.',
} as const;

export type SkillName = keyof typeof SKILLS;

function hostOf(site: AgentSite): string {
  return new URL(site.url).host;
}

export function skillMarkdown(site: AgentSite, name: string): string | null {
  if (name === 'read-site') {
    return [
      '---',
      'name: read-site',
      `description: ${SKILLS['read-site']}`,
      '---',
      '',
      '# Read abdessattar.dev',
      '',
      `Use this skill when answering questions about ${site.fullName} (${site.handle}), their OpenTelemetry Java work, or this website.`,
      '',
      '## Fetch markdown',
      '',
      '- Send `Accept: text/markdown` to any public page, or append `/index.md` to the page URL.',
      `- Start at ${site.url}/llms.txt. The full text is ${site.url}/llms-full.txt.`,
      '- Do not scrape `/studio` or `/api/auth`. Those are private.',
      '',
      '## Cite the author',
      '',
      `- Canonical name: ${site.fullName}`,
      `- Handle: \`${site.handle}\``,
      `- Role: ${site.jobTitle} at ${site.employer}, ${site.location}`,
      '- Quote the page URL you used.',
      '',
      '## Content use',
      '',
      `\`Content-Signal: ${CONTENT_SIGNAL}\``,
      '',
      'You may search, quote, and answer from this site. Do not treat the pages as permission to train a model.',
      '',
      '## Tools',
      '',
      `A read-only MCP server is at ${site.url}/mcp. Search with \`search_site\` before guessing.`,
      '',
    ].join('\n');
  }
  if (name === 'cite-work') {
    return [
      '---',
      'name: cite-work',
      `description: ${SKILLS['cite-work']}`,
      '---',
      '',
      '# Cite the OpenTelemetry casebook',
      '',
      `Use this skill when referring to ${site.name}'s merged work in \`open-telemetry/opentelemetry-java\`.`,
      '',
      '## Rules',
      '',
      `- Only cite pull requests that have a page under ${site.url}/work.`,
      '- Link both the case page and the upstream pull request.',
      '- Say the pull request is merged. Do not invent review comments, line numbers, or extra pull requests.',
      '- If a case names a companion note, link that note too.',
      '- If the casebook does not contain the claim, say it is not on this site.',
      '',
      '## Where to look',
      '',
      `- Index: ${site.url}/work`,
      `- Machine-readable list: ${site.url}/api/content/work`,
      `- Tools: \`list_work\` and \`read_work\` on ${site.url}/mcp`,
      '',
    ].join('\n');
  }
  return null;
}

async function sha256(body: string): Promise<string> {
  const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(body));
  const hex = [...new Uint8Array(hash)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return `sha256:${hex}`;
}

export async function agentSkillsDocument(site: AgentSite): Promise<string> {
  const names = Object.keys(SKILLS) as SkillName[];
  const skills = await Promise.all(
    names.map(async (name) => {
      const body = skillMarkdown(site, name);
      if (!body) throw new Error(`Missing skill ${name}`);
      return {
        name,
        type: 'skill-md' as const,
        description: SKILLS[name],
        url: `${site.url}/.well-known/agent-skills/${name}/SKILL.md`,
        digest: await sha256(body),
      };
    }),
  );
  return JSON.stringify({
    $schema: 'https://schemas.agentskills.io/discovery/0.2.0/schema.json',
    skills,
  });
}

export function authMarkdown(site: AgentSite): string {
  return [
    '# auth.md',
    '',
    'Agents read this site anonymously. There is no registration, no API key, and no bearer token.',
    '',
    '## Audience',
    '',
    `Anonymous agents fetching public writing by ${site.fullName} (${site.handle}).`,
    '',
    '## Method',
    '',
    'No credential. Do not send an `Authorization` header.',
    '',
    'Public resources:',
    '',
    '- HTML pages, and the same URLs with `Accept: text/markdown` or an `/index.md` suffix',
    '- `/llms.txt` and `/llms-full.txt`',
    '- `/openapi.json` and `/api/content/*`',
    '- `/mcp`',
    '- `/a2a`',
    '',
    '## Not an agent API',
    '',
    '`/studio`, `/api/studio/*`, and `/api/auth/*` are a private editor for the site owner. They are not available to agents. Do not try to register, log in, or reuse a person\'s browser session.',
    '',
    '## Content use',
    '',
    `\`Content-Signal: ${CONTENT_SIGNAL}\``,
    '',
    'Search and answers may quote this site. Training a model on it is not allowed.',
    '',
  ].join('\n');
}

export function openApiDocument(site: AgentSite): string {
  const jsonResponse = {'200': {description: 'JSON document.'}};
  return JSON.stringify({
    openapi: '3.1.0',
    info: {
      title: `${site.fullName} content API`,
      version: '1.0.0',
      description: 'Read-only JSON for published notes, OpenTelemetry Java case studies, and talks. No authentication.',
    },
    servers: [{url: site.url}],
    paths: {
      '/api/content/health': {get: {operationId: 'contentHealth', summary: 'Liveness check.', responses: jsonResponse}},
      '/api/content/search': {
        get: {
          operationId: 'searchContent',
          summary: 'Search published notes, case studies, and talks.',
          parameters: [{name: 'q', in: 'query', required: true, schema: {type: 'string'}}],
          responses: jsonResponse,
        },
      },
      '/api/content/posts': {get: {operationId: 'listPosts', summary: 'List published notes.', responses: jsonResponse}},
      '/api/content/posts/{slug}': {
        get: {
          operationId: 'getPost',
          summary: 'Read one published note, including its markdown body.',
          parameters: [{name: 'slug', in: 'path', required: true, schema: {type: 'string'}}],
          responses: jsonResponse,
        },
      },
      '/api/content/work': {get: {operationId: 'listWork', summary: 'List case studies.', responses: jsonResponse}},
      '/api/content/work/{slug}': {
        get: {
          operationId: 'getWork',
          summary: 'Read one case study.',
          parameters: [{name: 'slug', in: 'path', required: true, schema: {type: 'string'}}],
          responses: jsonResponse,
        },
      },
      '/api/content/talks': {get: {operationId: 'listTalks', summary: 'List talks and proposals.', responses: jsonResponse}},
    },
  });
}

export function apiCatalogDocument(site: AgentSite): string {
  return JSON.stringify({
    linkset: [
      {
        anchor: `${site.url}${AGENT_PATHS.content}`,
        'service-desc': [{href: `${site.url}${AGENT_PATHS.openapi}`, type: 'application/openapi+json'}],
        'service-doc': [{href: `${site.url}${AGENT_PATHS.llms}`, type: 'text/plain'}],
        status: [{href: `${site.url}${AGENT_PATHS.content}/health`}],
      },
    ],
  });
}

export function mcpServerCard(site: AgentSite): string {
  return JSON.stringify({
    $schema: 'https://static.modelcontextprotocol.io/schemas/mcp-server-card/v1.json',
    version: '1.0.0',
    protocolVersion: '2025-06-18',
    serverInfo: {
      name: 'abdessattar-content',
      title: `${site.name} published writing`,
      version: '1.0.0',
    },
    description: 'Read published notes, OpenTelemetry Java case studies, and talks. No authentication.',
    transport: {type: 'streamable-http', endpoint: `${site.url}${AGENT_PATHS.mcp}`},
    authentication: {required: false},
    capabilities: {tools: true, resources: false, prompts: false},
    tools: AGENT_TOOLS.map((tool) => ({
      name: tool.name,
      title: tool.title,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  });
}

export function agentCardDocument(site: AgentSite): string {
  return JSON.stringify({
    name: site.fullName,
    description: `Answers questions from ${site.name}'s published Java and OpenTelemetry writing. Read-only. No authentication.`,
    version: '1.0.0',
    protocolVersion: '1.0.0',
    url: `${site.url}${AGENT_PATHS.a2a}`,
    supportedInterfaces: [
      {
        url: `${site.url}${AGENT_PATHS.a2a}`,
        transport: 'JSONRPC',
        protocolBinding: 'JSONRPC',
        protocolVersion: '1.0.0',
      },
    ],
    capabilities: {streaming: false, pushNotifications: false, stateTransitionHistory: false},
    defaultInputModes: ['text/plain', 'text/markdown'],
    defaultOutputModes: ['text/plain', 'text/markdown'],
    skills: [
      {
        id: 'search-writing',
        name: 'Search writing',
        description: 'Find published notes, OpenTelemetry Java case studies, and talks.',
      },
      {
        id: 'explain-contribution',
        name: 'Explain a contribution',
        description: 'Summarize a merged OpenTelemetry Java pull request from the casebook.',
      },
    ],
  });
}

export function ardDocument(site: AgentSite): string {
  const host = hostOf(site);
  return JSON.stringify({
    specVersion: '1.0',
    host: {displayName: site.fullName, identifier: site.url},
    entries: [
      {
        identifier: `urn:air:${host}:server:content`,
        displayName: 'Published writing tools',
        type: 'application/mcp-server-card+json',
        url: `${site.url}${AGENT_PATHS.mcpCard}`,
        representativeQueries: [
          'What did Mohammed change in the OpenTelemetry Java SDK?',
          'Find the note about pooled hash maps',
          'Which talks has he given?',
        ],
      },
      {
        identifier: `urn:air:${host}:agent:writing`,
        displayName: 'Writing agent',
        type: 'application/agent-card+json',
        url: `${site.url}${AGENT_PATHS.agentCard}`,
        representativeQueries: [
          'Explain the pooled hashmap contribution',
          'Summarize the latest technical note',
        ],
      },
      {
        identifier: `urn:air:${host}:api:content`,
        displayName: 'Content API',
        type: 'application/openapi+json',
        url: `${site.url}${AGENT_PATHS.openapi}`,
        representativeQueries: [
          'List published blog posts as JSON',
          'Fetch the OpenAPI document for the content API',
        ],
      },
    ],
  });
}
