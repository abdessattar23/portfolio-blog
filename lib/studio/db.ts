import {env} from 'cloudflare:workers';
import migration from '../../migrations/0001_studio.sql?raw';

let schemaReady: Promise<void> | undefined;

export function studioEnv() {
  return env;
}

function statements(sql: string): string[] {
  return sql
    .split(';')
    .map((statement) => statement.replace(/\s+/g, ' ').trim())
    .filter((statement) => statement.length > 0);
}

export async function database() {
  const db = env.DB;
  if (!db) throw new Error('D1 binding DB is not configured. Set CLOUDFLARE_D1_ID for the production build.');
  schemaReady ??= (async () => {
    for (const statement of statements(migration)) {
      await db.prepare(statement).run();
    }
  })().catch((error: unknown) => {
    schemaReady = undefined;
    throw error;
  });
  await schemaReady;
  return db;
}

export async function mediaBucket() {
  const bucket = env.MEDIA;
  if (!bucket) throw new Error('R2 binding MEDIA is not configured.');
  return bucket;
}
