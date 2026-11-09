import {database} from './db';

export async function queuePings(urls: string[]): Promise<void> {
  const db = await database();
  const queuedAt = new Date().toISOString();
  for (const url of urls) {
    await db.prepare(
      `insert into pending_pings (url, queued_at, attempts) values (?, ?, 0)
       on conflict(url) do update set queued_at = excluded.queued_at, attempts = 0`,
    ).bind(url, queuedAt).run();
  }
}

export async function duePings(): Promise<{url: string; attempts: number}[]> {
  const db = await database();
  const rows = await db.prepare('select url, attempts from pending_pings where attempts < 12 order by queued_at').all<{url: string; attempts: number}>();
  return rows.results;
}

export async function markPing(url: string, attempts: number, done: boolean): Promise<void> {
  const db = await database();
  if (done) {
    await db.prepare('delete from pending_pings where url = ?').bind(url).run();
    return;
  }
  await db.prepare('update pending_pings set attempts = ? where url = ?').bind(attempts, url).run();
}
