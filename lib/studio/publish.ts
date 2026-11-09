import {SITE} from '../site';
import {mediaBucket, studioEnv} from './db';
import {getDraft, updateDraftBaseSha, updateDraftContent, type Draft} from './drafts';
import {commitFiles, getFileSha, renderDraftFile} from './github';
import {publishConflict} from './guards';
import {queuePings} from './pings';

function toBase64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function publishDraft(draft: Draft, message: string): Promise<void> {
  if (!studioEnv().GITHUB_CONTENT_TOKEN) throw new Error('GITHUB_CONTENT_TOKEN is not configured.');
  const rendered = renderDraftFile(draft.kind, draft.slug, draft.frontmatter, draft.body);
  const currentSha = await getFileSha(rendered.path);
  const effectiveBaseSha = draft.baseSha === null && currentSha !== null ? currentSha : draft.baseSha;
  const conflict = publishConflict(currentSha, effectiveBaseSha);
  if (conflict) throw new Error(conflict);

  const files: {path: string; text?: string; base64?: string}[] = [{path: rendered.path, text: rendered.content}];
  const imageMatches = [...rendered.content.matchAll(/\/media\/([a-z0-9-]+)\/([A-Za-z0-9._-]+)/g)];
  if (imageMatches.length > 0) {
    const bucket = await mediaBucket();
    const seen = new Set<string>();
    for (const match of imageMatches) {
      const imageSlug = match[1];
      const rawFilename = match[2];
      if (!imageSlug || !rawFilename) continue;
      const filename = rawFilename.toLowerCase();
      if (seen.has(`${imageSlug}/${filename}`)) continue;
      seen.add(`${imageSlug}/${filename}`);
      const object = await bucket.get(`media/${imageSlug}/${filename}`);
      if (!object) throw new Error(`Uploaded image /media/${imageSlug}/${filename} was not found in media storage.`);
      files.push({path: `public/media/${imageSlug}/${filename}`, base64: toBase64(new Uint8Array(await object.arrayBuffer()))});
    }
  }

  const blobSha = await commitFiles(message, files);
  const latestSha = (await getFileSha(rendered.path)) ?? blobSha;
  await updateDraftBaseSha(draft.id, latestSha);

  if (draft.kind !== 'post') return;
  const fields: unknown = JSON.parse(draft.frontmatter);
  if (isRecord(fields) && fields['draft'] === true) return;
  await queuePings([`${SITE.url}/blog/${draft.slug}`, `${SITE.url}/sitemap.xml`]);
}

export async function publishById(
  id: string,
  override?: {frontmatter?: string; body?: string},
): Promise<Draft> {
  let draft = await getDraft(id);
  if (!draft) throw new Error('Draft not found.');
  if (override?.frontmatter !== undefined || override?.body !== undefined) {
    const nextFrontmatter = override.frontmatter ?? draft.frontmatter;
    const nextBody = override.body ?? draft.body;
    await updateDraftContent(draft.id, draft.slug, nextFrontmatter, nextBody);
    draft = {...draft, frontmatter: nextFrontmatter, body: nextBody};
  }
  const message = draft.kind === 'post' ? `content(post): publish ${draft.slug}` : `content(${draft.kind}): update ${draft.slug}`;
  await publishDraft(draft, message);
  return draft;
}

export async function unpublishById(
  id: string,
  override?: {frontmatter?: string; body?: string},
): Promise<void> {
  const draft = await getDraft(id);
  if (!draft || draft.kind !== 'post') throw new Error('Only a post can be unpublished.');
  const rawFrontmatter = override?.frontmatter ?? draft.frontmatter;
  const nextBody = override?.body ?? draft.body;
  const fields: unknown = JSON.parse(rawFrontmatter);
  if (!isRecord(fields)) throw new Error('Draft fields are unreadable.');
  const hidden = JSON.stringify({...fields, slug: draft.slug, draft: true});
  await publishDraft({...draft, frontmatter: hidden, body: nextBody}, `content(post): unpublish ${draft.slug}`);
  await updateDraftContent(draft.id, draft.slug, hidden, nextBody);
}
