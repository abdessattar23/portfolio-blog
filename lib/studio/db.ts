import {env} from 'cloudflare:workers';
import migration from '../../migrations/0001_studio.sql?raw';

let schemaReady: Promise<void> | undefined;

export function studioEnv() {
  return env;
}

export async function database() {
  const db = env.DB;
  if (!db) throw new Error('D1 binding DB is not configured. Set CLOUDFLARE_D1_ID for the production build.');
  schemaReady ??= db.exec(migration).then(() => undefined);
  await schemaReady;
  return db;
}

export async function mediaBucket() {
  const bucket = env.MEDIA;
  if (!bucket) throw new Error('R2 binding MEDIA is not configured.');
  return bucket;
}
