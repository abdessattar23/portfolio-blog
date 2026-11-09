import handler from 'vinext/server/fetch-handler';
import {agentResponse, decoratePublicResponse} from '../lib/agent/serve';
import {studioEnv} from '../lib/studio/db';
import {submitIndexNow} from '../lib/studio/indexnow';
import {studioMcpResponse} from '../lib/studio/mcp-server';
import {duePings, markPing} from '../lib/studio/pings';

const PUBLIC_CACHE_SECONDS = 60;
const MEDIA_CACHE_SECONDS = 86_400;

function edgeCache(): Cache | undefined {
  try {
    return caches.default;
  } catch {
    return undefined;
  }
}

function isPublicGet(url: URL, request: Request): boolean {
  if (request.method !== 'GET') return false;
  const path = url.pathname;
  if (path.startsWith('/studio') || path.startsWith('/api')) return false;
  return true;
}

async function cachedPublicFetch(request: Request, env: unknown, ctx: ExecutionContext): Promise<Response> {
  const url = new URL(request.url);
  const cache = edgeCache();
  const key = new Request(url.toString(), {method: 'GET'});
  if (cache) {
    const hit = await cache.match(key);
    if (hit) return decoratePublicResponse(hit, url.pathname);
  }
  const response = await handler.fetch(request, env, ctx);
  if (!cache || !response.ok || response.headers.has('set-cookie')) return decoratePublicResponse(response, url.pathname);
  const seconds = url.pathname.startsWith('/media/') ? MEDIA_CACHE_SECONDS : PUBLIC_CACHE_SECONDS;
  const headers = new Headers(response.headers);
  headers.set('Cache-Control', `public, max-age=${seconds}`);
  const stored = decoratePublicResponse(
    new Response(response.body, {status: response.status, statusText: response.statusText, headers}),
    url.pathname,
  );
  ctx.waitUntil(cache.put(key, stored.clone()));
  return stored;
}

async function notifyIndexNow(): Promise<void> {
  const key = studioEnv().INDEXNOW_KEY;
  if (!key) return;
  let pending: {url: string; attempts: number}[];
  try {
    pending = await duePings();
  } catch {
    return;
  }
  for (const ping of pending) {
    const attempts = ping.attempts + 1;
    const live = await fetch(ping.url);
    if (!live.ok) {
      await markPing(ping.url, attempts, false);
      continue;
    }
    const delivered = await submitIndexNow([ping.url]);
    await markPing(ping.url, attempts, delivered);
  }
}

const worker = {
  async fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);
    const key = studioEnv().INDEXNOW_KEY;
    if (key && url.pathname === `/${key}.txt`) {
      return new Response(key, {headers: {'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'public, max-age=86400'}});
    }
    const studioMcp = await studioMcpResponse(request);
    if (studioMcp) return studioMcp;
    const agent = await agentResponse(request);
    if (agent) return agent;
    if (isPublicGet(url, request)) return cachedPublicFetch(request, env, ctx);
    return handler.fetch(request, env, ctx);
  },
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(notifyIndexNow());
  },
};

export default worker;
