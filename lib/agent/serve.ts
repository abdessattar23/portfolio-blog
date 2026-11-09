import {AGENT_PATHS, CONTENT_SIGNAL, discoveryLink, prefersMarkdown, robotsTxt} from './policy';
import {
  canonicalPage,
  markdownRequestPath,
  markdownTokens,
  pageMarkdown,
  searchCorpus,
  type AgentCorpus,
  type AgentSite,
  type SearchHit,
} from './content';
import {
  agentCardDocument,
  agentSkillsDocument,
  apiCatalogDocument,
  ardDocument,
  authMarkdown,
  mcpServerCard,
  openApiDocument,
  skillMarkdown,
} from './discovery';
import {handleA2a, handleMcp} from './protocol';
import {directoryDocument, directorySignatureHeaders, usablePrivateJwk} from './signatures';
import type {PostDocument, Talk, WorkCase} from '../content/schema';
import {livePublishedPosts, liveTalks, liveWorkCases, readLiveSiteSettings} from '../studio/published';
import {studioEnv} from '../studio/db';

async function loadCorpus(): Promise<AgentCorpus> {
  const [settings, posts, work, talks] = await Promise.all([
    readLiveSiteSettings(),
    livePublishedPosts(),
    liveWorkCases(),
    liveTalks(),
  ]);
  return {
    site: {
      url: settings.url,
      name: settings.name,
      fullName: settings.fullName,
      handle: settings.handle,
      bio: settings.bio,
      role: settings.role,
      jobTitle: settings.jobTitle,
      employer: settings.employer,
      location: settings.location,
      github: settings.github,
      linkedin: settings.linkedin,
      knowsAbout: settings.knowsAbout,
      alternateNames: settings.alternateNames,
    },
    posts,
    work,
    talks,
  };
}

function allows(pathname: string): boolean {
  return (
    pathname === AGENT_PATHS.mcp ||
    pathname === AGENT_PATHS.a2a ||
    pathname === AGENT_PATHS.openapi ||
    pathname === AGENT_PATHS.auth ||
    pathname === AGENT_PATHS.directory ||
    pathname.startsWith(`${AGENT_PATHS.content}/`) ||
    pathname === AGENT_PATHS.content ||
    pathname.startsWith('/.well-known/')
  );
}

function json(body: unknown, status = 200, head = false, contentType = 'application/json; charset=utf-8'): Response {
  const headers = new Headers({
    'Content-Type': contentType,
    'Cache-Control': status === 200 ? 'public, max-age=60' : 'no-store',
    'Access-Control-Allow-Origin': '*',
    'Content-Signal': CONTENT_SIGNAL,
  });
  return new Response(head ? null : JSON.stringify(body), {status, headers});
}

function text(body: string, status: number, contentType: string, head: boolean, extra?: HeadersInit): Response {
  const headers = new Headers(extra);
  headers.set('Content-Type', contentType);
  headers.set('Cache-Control', status === 200 ? 'public, max-age=60' : 'no-store');
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Content-Signal', CONTENT_SIGNAL);
  return new Response(head ? null : body, {status, headers});
}

function methodNotAllowed(allow: string): Response {
  return new Response(JSON.stringify({error: 'method_not_allowed'}), {
    status: 405,
    headers: {
      Allow: allow,
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
    },
  });
}

function optionsResponse(): Response {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Accept, MCP-Protocol-Version',
      'Access-Control-Max-Age': '86400',
    },
  });
}

function markdownResponse(body: string, status: number, head: boolean): Response {
  return text(body, status, 'text/markdown; charset=utf-8', head, {
    Vary: 'Accept',
    Link: discoveryLink(),
    'x-markdown-tokens': String(markdownTokens(body)),
  });
}

function postSummary(site: AgentSite, post: PostDocument) {
  return {
    slug: post.slug,
    title: post.title,
    url: `${site.url}/blog/${post.slug}`,
    excerpt: post.excerpt,
    description: post.description,
    publishedAt: post.publishedAt,
    updatedAt: post.updatedAt,
    topics: post.topics,
  };
}

function workSummary(site: AgentSite, item: WorkCase) {
  return {
    slug: item.slug,
    number: item.number,
    title: item.title,
    url: `${site.url}/work/${item.slug}`,
    summary: item.summary,
    topic: item.topic,
  };
}

function talkSummary(site: AgentSite, talk: Talk) {
  return {
    slug: talk.slug,
    title: talk.title,
    url: `${site.url}/speaking`,
    status: talk.status,
    event: talk.event,
    location: talk.location,
    summary: talk.summary,
  };
}

function searchJson(corpus: AgentCorpus, query: string) {
  const results: Array<Omit<SearchHit, 'score'> & {score: number}> = searchCorpus(corpus, query).map((hit) => ({
    kind: hit.kind,
    slug: hit.slug,
    title: hit.title,
    url: hit.url,
    excerpt: hit.excerpt,
    score: hit.score,
  }));
  return {query, results};
}

function contentResponse(corpus: AgentCorpus, path: string, url: URL, head: boolean): Response {
  const rest = path.slice(AGENT_PATHS.content.length);
  const {site} = corpus;
  if (rest === '') {
    return json(
      {
        name: site.fullName,
        health: `${site.url}${AGENT_PATHS.content}/health`,
        search: `${site.url}${AGENT_PATHS.content}/search`,
        openapi: `${site.url}${AGENT_PATHS.openapi}`,
      },
      200,
      head,
    );
  }
  if (rest === '/health') return json({status: 'ok'}, 200, head);
  if (rest === '/search') return json(searchJson(corpus, url.searchParams.get('q') ?? ''), 200, head);
  if (rest === '/posts') return json({posts: corpus.posts.map((post) => postSummary(site, post))}, 200, head);
  if (rest.startsWith('/posts/')) {
    const slug = decodeURIComponent(rest.slice('/posts/'.length));
    const post = /^[a-z0-9-]+$/.test(slug) ? corpus.posts.find((item) => item.slug === slug) : undefined;
    if (!post) return json({error: 'not_found'}, 404, head);
    return json({...postSummary(site, post), markdown: pageMarkdown(corpus, `/blog/${post.slug}`)}, 200, head);
  }
  if (rest === '/work') return json({work: corpus.work.map((item) => workSummary(site, item))}, 200, head);
  if (rest.startsWith('/work/')) {
    const slug = decodeURIComponent(rest.slice('/work/'.length));
    const item = /^[a-z0-9-]+$/.test(slug) ? corpus.work.find((entry) => entry.slug === slug) : undefined;
    if (!item) return json({error: 'not_found'}, 404, head);
    return json(
      {
        ...workSummary(site, item),
        problem: item.problem,
        change: item.change,
        verification: item.verification,
        boundary: item.boundary,
        markdown: pageMarkdown(corpus, `/work/${item.slug}`),
      },
      200,
      head,
    );
  }
  if (rest === '/talks') return json({talks: corpus.talks.map((talk) => talkSummary(site, talk))}, 200, head);
  return json({error: 'not_found'}, 404, head);
}

async function directoryResponse(authority: string, head: boolean): Promise<Response> {
  const headers = new Headers({
    'Content-Type': 'application/http-message-signatures-directory+json',
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  const signature = await directorySignatureHeaders(authority, usablePrivateJwk(studioEnv().WEB_BOT_AUTH_PRIVATE_JWK));
  for (const [key, value] of Object.entries(signature)) headers.set(key, value);
  return new Response(head ? null : directoryDocument(), {status: 200, headers});
}

function normalizedPath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith('/')) return pathname.slice(0, -1);
  return pathname;
}

export async function agentResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = normalizedPath(url.pathname);
  if (request.method === 'OPTIONS' && allows(path)) return optionsResponse();

  if (path === AGENT_PATHS.directory) {
    if (request.method !== 'GET' && request.method !== 'HEAD') return methodNotAllowed('GET, HEAD, OPTIONS');
    return directoryResponse(url.host, request.method === 'HEAD');
  }

  const head = request.method === 'HEAD';
  const reading = request.method === 'GET' || head;
  if (path === AGENT_PATHS.mcp) {
    if (request.method === 'POST') return handleMcp(request, await loadCorpus());
    return methodNotAllowed('POST, OPTIONS');
  }
  if (path === AGENT_PATHS.a2a) {
    if (request.method === 'POST') return handleA2a(request, await loadCorpus());
    if (reading) return text(agentCardDocument((await loadCorpus()).site), 200, 'application/json; charset=utf-8', head);
    return methodNotAllowed('GET, HEAD, POST, OPTIONS');
  }
  if (path === AGENT_PATHS.content || path.startsWith(`${AGENT_PATHS.content}/`)) {
    if (!reading) return methodNotAllowed('GET, HEAD, OPTIONS');
    return contentResponse(await loadCorpus(), path, url, head);
  }

  const isDocument =
    path === '/robots.txt' ||
    path === AGENT_PATHS.openapi ||
    path === AGENT_PATHS.auth ||
    path === AGENT_PATHS.catalog ||
    path === AGENT_PATHS.skills ||
    path === AGENT_PATHS.mcpCard ||
    path === AGENT_PATHS.agentCard ||
    path === AGENT_PATHS.ard ||
    path.startsWith('/.well-known/');
  if (reading && isDocument) {
    const corpus = await loadCorpus();
    if (path === '/robots.txt') return text(robotsTxt(corpus.site.url), 200, 'text/plain; charset=utf-8', head);
    if (path === AGENT_PATHS.openapi) return text(openApiDocument(corpus.site), 200, 'application/json; charset=utf-8', head);
    if (path === AGENT_PATHS.auth) return text(authMarkdown(corpus.site), 200, 'text/markdown; charset=utf-8', head);
    if (path === AGENT_PATHS.catalog) return text(apiCatalogDocument(corpus.site), 200, 'application/linkset+json', head);
    if (path === AGENT_PATHS.skills) return text(await agentSkillsDocument(corpus.site), 200, 'application/json; charset=utf-8', head);
    if (path === AGENT_PATHS.mcpCard) return text(mcpServerCard(corpus.site), 200, 'application/json; charset=utf-8', head);
    if (path === AGENT_PATHS.agentCard) return text(agentCardDocument(corpus.site), 200, 'application/json; charset=utf-8', head);
    if (path === AGENT_PATHS.ard) return text(ardDocument(corpus.site), 200, 'application/json; charset=utf-8', head);
    const skill = /^\/\.well-known\/agent-skills\/([a-z0-9-]+)\/SKILL\.md$/.exec(path);
    if (skill) {
      const name = skill[1] ?? '';
      const body = skillMarkdown(corpus.site, name);
      if (!body) return text('Not found\n', 404, 'text/plain; charset=utf-8', head);
      return text(body, 200, 'text/markdown; charset=utf-8', head);
    }
    if (path.startsWith('/.well-known/')) return null;
  } else if (isDocument) {
    return methodNotAllowed('GET, HEAD, OPTIONS');
  }

  const alias = markdownRequestPath(url.pathname);
  const page = alias ?? (prefersMarkdown(request.headers.get('Accept')) ? canonicalPage(path) : null);
  if (!page || (request.method !== 'GET' && request.method !== 'HEAD')) return null;
  const markdown = pageMarkdown(await loadCorpus(), page);
  if (!markdown) return markdownResponse('# Not found\n\nNo published page exists at this path.\n', 404, head);
  return markdownResponse(markdown, 200, head);
}

export function decoratePublicResponse(response: Response, pathname: string): Response {
  const headers = new Headers(response.headers);
  if (!headers.has('Content-Signal')) headers.set('Content-Signal', CONTENT_SIGNAL);
  const vary = headers.get('Vary');
  if (!vary) headers.set('Vary', 'Accept');
  else if (!vary.toLowerCase().split(',').some((part) => part.trim() === 'accept')) headers.set('Vary', `${vary}, Accept`);
  const type = headers.get('Content-Type') ?? '';
  if (pathname === '/' || type.includes('text/html') || type.includes('text/markdown')) {
    const existing = headers.get('Link');
    const discovery = discoveryLink();
    if (!existing) headers.set('Link', discovery);
    else if (!existing.includes('rel="api-catalog"')) headers.set('Link', `${existing}, ${discovery}`);
  }
  return new Response(response.body, {status: response.status, statusText: response.statusText, headers});
}
