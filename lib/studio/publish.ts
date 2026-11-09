import {SITE} from '../site';
import {mediaBucket, studioEnv} from './db';
import {getDraft, saveDraft, type Draft} from './drafts';
import {commitFiles, getFileSha, renderDraftFile} from './github';
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
  const current = await getFileSha(rendered.path);
  if (current && current !== draft.baseSha) {
    throw new Error('This file changed on GitHub after the draft was opened. Delete the draft and open it again.');
  }
  if (!current && draft.baseSha) {
    throw new Error('The file this draft started from is no longer on GitHub.');
  }

  const files: {path: string; text?: string; base64?: string}[] = [{path: rendered.path, text: rendered.content}];
  const seen = new Set<string>();
  try {
    const bucket = await mediaBucket();
    for (const match of rendered.content.matchAll(/\/media\/([a-z0-9-]+)\/([A-Za-z0-9._-]+)/g)) {
      const imageSlug = match[1];
      const filename = match[2];
      if (!imageSlug || !filename || seen.has(`${imageSlug}/${filename}`)) continue;
      seen.add(`${imageSlug}/${filename}`);
      const object = await bucket.get(`media/${imageSlug}/${filename}`);
      if (!object) continue;
      files.push({path: `public/media/${imageSlug}/${filename}`, base64: toBase64(new Uint8Array(await object.arrayBuffer()))});
    }
  } catch {
    // Images are optional until the R2 binding exists. Markdown still publishes.
  }

  const blobSha = await commitFiles(message, files);
  await saveDraft({...draft, baseSha: blobSha, updatedAt: new Date().toISOString()});

  if (draft.kind !== 'post') return;
  const fields: unknown = JSON.parse(draft.frontmatter);
  if (isRecord(fields) && fields['draft'] === true) return;
  await queuePings([`${SITE.url}/blog/${draft.slug}`, `${SITE.url}/sitemap.xml`]);
}

export async function publishById(id: string): Promise<Draft> {
  const draft = await getDraft(id);
  if (!draft) throw new Error('Draft not found.');
  const message = draft.kind === 'post' ? `content(post): publish ${draft.slug}` : `content(${draft.kind}): update ${draft.slug}`;
  await publishDraft(draft, message);
  return draft;
}

export async function unpublishById(id: string): Promise<void> {
  const draft = await getDraft(id);
  if (!draft || draft.kind !== 'post') throw new Error('Only a post can be unpublished.');
  const fields: unknown = JSON.parse(draft.frontmatter);
  if (!isRecord(fields)) throw new Error('Draft fields are unreadable.');
  const hidden = {...fields, draft: true};
  await publishDraft({...draft, frontmatter: JSON.stringify(hidden)}, `content(post): unpublish ${draft.slug}`);
}
