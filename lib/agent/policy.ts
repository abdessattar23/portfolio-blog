export const CONTENT_SIGNAL = 'ai-train=no, search=yes, ai-input=yes';

export const AGENT_PATHS = {
  llms: '/llms.txt',
  llmsFull: '/llms-full.txt',
  rss: '/feed.xml',
  openapi: '/openapi.json',
  auth: '/auth.md',
  mcp: '/mcp',
  a2a: '/a2a',
  catalog: '/.well-known/api-catalog',
  skills: '/.well-known/agent-skills/index.json',
  mcpCard: '/.well-known/mcp/server-card.json',
  agentCard: '/.well-known/agent-card.json',
  ard: '/.well-known/ai-catalog.json',
  directory: '/.well-known/http-message-signatures-directory',
  content: '/api/content',
} as const;

const EXPLICIT_BOTS = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-SearchBot',
  'Claude-Web',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
] as const;

function robotGroup(userAgent: string): string {
  return [
    `User-agent: ${userAgent}`,
    `Content-Signal: ${CONTENT_SIGNAL}`,
    'Allow: /',
    'Disallow: /studio',
    'Disallow: /oauth',
    'Disallow: /api/studio',
    'Disallow: /api/auth',
    '',
  ].join('\n');
}

export function robotsTxt(origin: string): string {
  return [
    robotGroup('*'),
    ...EXPLICIT_BOTS.map((bot) => robotGroup(bot)),
    `Sitemap: ${origin}/sitemap.xml`,
    `Host: ${origin}`,
    `Agentmap: ${origin}${AGENT_PATHS.ard}`,
    '',
  ].join('\n');
}

export function discoveryLink(): string {
  return [
    `<${AGENT_PATHS.catalog}>; rel="api-catalog"`,
    `<${AGENT_PATHS.openapi}>; rel="service-desc"; type="application/openapi+json"`,
    `<${AGENT_PATHS.llms}>; rel="service-doc"`,
    `<${AGENT_PATHS.skills}>; rel="describedby"`,
    `<${AGENT_PATHS.mcpCard}>; rel="describedby"`,
    `<${AGENT_PATHS.ard}>; rel="describedby"`,
  ].join(', ');
}

export function prefersMarkdown(accept: string | null): boolean {
  if (!accept) return false;
  let markdownQ = 0;
  let sawMarkdown = false;
  let htmlQ = 0;
  let sawHtml = false;
  let starQ = 0;
  for (const part of accept.split(',')) {
    const [rawType, ...params] = part.trim().split(';');
    const type = (rawType ?? '').trim().toLowerCase();
    let quality = 1;
    for (const param of params) {
      const [key, value] = param.trim().split('=');
      if (key?.trim() !== 'q' || !value) continue;
      const parsed = Number(value);
      if (!Number.isNaN(parsed)) quality = parsed;
    }
    if (type === 'text/markdown' || type === 'text/x-markdown') {
      sawMarkdown = true;
      markdownQ = quality;
    } else if (type === 'text/html' || type === 'application/xhtml+xml') {
      sawHtml = true;
      htmlQ = Math.max(htmlQ, quality);
    } else if (type === '*/*') {
      starQ = quality;
    }
  }
  if (!sawMarkdown || markdownQ <= 0) return false;
  const competing = sawHtml ? htmlQ : starQ;
  return markdownQ >= competing;
}
