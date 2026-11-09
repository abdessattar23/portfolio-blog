import handler from 'vinext/server/fetch-handler';
import {SITE} from '../lib/site';
import {studioEnv} from '../lib/studio/db';
import {duePings, markPing} from '../lib/studio/pings';

async function notifyIndexNow(): Promise<void> {
  const key = studioEnv().INDEXNOW_KEY;
  if (!key) return;
  let pending: {url: string; attempts: number}[];
  try {
    pending = await duePings();
  } catch {
    return;
  }
  const host = new URL(SITE.url).host;
  for (const ping of pending) {
    const attempts = ping.attempts + 1;
    const live = await fetch(ping.url);
    if (!live.ok) {
      await markPing(ping.url, attempts, false);
      continue;
    }
    const response = await fetch('https://api.indexnow.org/indexnow', {
      method: 'POST',
      headers: {'Content-Type': 'application/json'},
      body: JSON.stringify({
        host,
        key,
        keyLocation: `${SITE.url}/${key}.txt`,
        urlList: [ping.url],
      }),
    });
    await markPing(ping.url, attempts, response.ok || response.status === 202);
  }
}

const worker = {
  fetch(request: Request, env: unknown, ctx: ExecutionContext) {
    const key = studioEnv().INDEXNOW_KEY;
    if (key && new URL(request.url).pathname === `/${key}.txt`) {
      return new Response(key, {headers: {'Content-Type': 'text/plain; charset=utf-8'}});
    }
    return handler.fetch(request, env, ctx);
  },
  scheduled(_controller: ScheduledController, _env: unknown, ctx: ExecutionContext) {
    ctx.waitUntil(notifyIndexNow());
  },
};

export default worker;
