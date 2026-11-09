import {AGENT_PATHS} from '../agent/policy';
import {usablePrivateJwk, webBotRequestHeaders} from '../agent/signatures';
import {SITE} from '../site';
import {studioEnv} from './db';
import {queuePings} from './pings';

async function indexNowHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {'Content-Type': 'application/json'};
  const privateJwk = usablePrivateJwk(studioEnv().WEB_BOT_AUTH_PRIVATE_JWK);
  if (!privateJwk) return headers;
  try {
    return {
      ...headers,
      ...(await webBotRequestHeaders({
        authority: 'api.indexnow.org',
        directoryUrl: `${SITE.url}${AGENT_PATHS.directory}`,
        privateJwk,
      })),
    };
  } catch {
    return headers;
  }
}

export async function purgePublicUrls(urls: string[]): Promise<void> {
  try {
    const cache = caches.default;
    await Promise.all(urls.map((url) => cache.delete(new Request(url, {method: 'GET'})).catch(() => false)));
  } catch {
    return;
  }
}

export async function submitIndexNow(urls: string[]): Promise<boolean> {
  const key = studioEnv().INDEXNOW_KEY?.trim();
  if (!key || urls.length === 0) return false;
  const host = new URL(SITE.url).host;
  const response = await fetch('https://api.indexnow.org/indexnow', {
    method: 'POST',
    headers: await indexNowHeaders(),
    body: JSON.stringify({
      host,
      key,
      keyLocation: `${SITE.url}/${key}.txt`,
      urlList: urls,
    }),
  });
  return response.ok || response.status === 202;
}

/** Drop cached public copies, tell IndexNow, and keep a retry if the ping does not land. */
export async function announceLiveUrls(urls: string[]): Promise<void> {
  const unique = [...new Set(urls)];
  await purgePublicUrls(unique);
  if (!studioEnv().INDEXNOW_KEY?.trim()) return;
  try {
    if (await submitIndexNow(unique)) return;
  } catch {
    // The cron retries whatever is still queued.
  }
  await queuePings(unique);
}
