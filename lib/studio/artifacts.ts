import {posts} from '../content/load';
import {appendArtifactFence, referencesArtifact} from '../artifacts/format';
import {refuseArtifactDelete} from '../artifacts/policy';
import {readMergedArtifact, studioArtifactIds} from '../artifacts/resolve';
import {isArtifactId, parseArtifact, type ArtifactDocument} from '../artifacts/schema';
import {database, readDatabase} from './db';
import {listDrafts, openDraft, updateDraftContent, type Draft} from './drafts';
import {livePosts} from './published';

export const VIRTUAL_THREADS_TITLE = "Java Virtual Threads: More Concurrency Doesn't Mean More Speed";
export const VIRTUAL_THREADS_ARTIFACT = 'virtual-thread-pool';

const MAX_DOCUMENT = 40_000;

type ContentRow = {body?: string; content?: string};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function titleFromFrontmatter(frontmatter: string): string {
  try {
    const parsed: unknown = JSON.parse(frontmatter);
    if (isRecord(parsed) && typeof parsed['title'] === 'string') return parsed['title'].trim();
  } catch {
    return '';
  }
  return '';
}

export function parseStoredArtifact(input: unknown): ArtifactDocument {
  const encoded = JSON.stringify(input);
  if (encoded.length > MAX_DOCUMENT) throw new Error('That artifact is too large.');
  const parsed = parseArtifact(input);
  if (!parsed.ok) throw new Error(parsed.errors.join(' '));
  return parsed.artifact;
}

export async function writeArtifact(artifact: ArtifactDocument): Promise<void> {
  const db = await database();
  const document = JSON.stringify(artifact);
  if (document.length > MAX_DOCUMENT) throw new Error('That artifact is too large.');
  await db.prepare(
    `insert into artifacts (id, document, updated_at)
     values (?, ?, ?)
     on conflict(id) do update set document = excluded.document, updated_at = excluded.updated_at`,
  ).bind(artifact.id, document, new Date().toISOString()).run();
}

export async function deleteStoredArtifact(id: string): Promise<boolean> {
  const db = await database();
  const result = await db.prepare('delete from artifacts where id = ?').bind(id).run();
  return (result.meta.changes ?? 0) > 0;
}

export async function countArtifactReferences(id: string): Promise<number> {
  const needle = `:::artifact{id="${id}"}`;
  let count = 0;
  for (const post of posts) {
    if (referencesArtifact(post.body, id)) count += 1;
  }
  const db = readDatabase();
  if (!db) return count;
  try {
    const drafts = await db.prepare('select body from drafts').all<ContentRow>();
    for (const row of drafts.results) {
      if (typeof row.body === 'string' && row.body.includes(needle) && referencesArtifact(row.body, id)) count += 1;
    }
    const published = await db.prepare("select content from published_content where kind = 'post'").all<ContentRow>();
    for (const row of published.results) {
      if (typeof row.content === 'string' && referencesArtifact(row.content, id)) count += 1;
    }
  } catch {
    return count;
  }
  return count;
}

export async function deleteArtifactIfAllowed(id: string, confirm: boolean): Promise<{deleted: boolean; id: string}> {
  if (!isArtifactId(id)) throw new Error('Use a lowercase artifact id.');
  const stored = (await studioArtifactIds()).has(id);
  const references = await countArtifactReferences(id);
  const refusal = refuseArtifactDelete(confirm, references, stored);
  if (refusal) throw new Error(refusal);
  const deleted = await deleteStoredArtifact(id);
  if (!deleted) throw new Error('No studio copy of that artifact. The git catalog is not deleted from here.');
  return {deleted: true, id};
}

async function draftByTitle(title: string): Promise<Draft | null> {
  const drafts = await listDrafts();
  return drafts.find((draft) => draft.kind === 'post' && titleFromFrontmatter(draft.frontmatter) === title) ?? null;
}

export async function attachArtifactToDraft(artifactId: string, draftId: string): Promise<{attached: boolean; id: string; draftId: string; note: string}> {
  if (!isArtifactId(artifactId)) throw new Error('Use a lowercase artifact id.');
  const artifact = await readMergedArtifact(artifactId);
  if (!artifact) throw new Error('No artifact with that id.');
  const drafts = await listDrafts();
  const draft = drafts.find((item) => item.id === draftId);
  if (!draft) throw new Error('No draft with that id.');
  if (draft.kind !== 'post') throw new Error('Artifacts attach to a note draft.');
  if (referencesArtifact(draft.body, artifactId)) {
    return {attached: false, id: artifactId, draftId: draft.id, note: 'The draft already includes this artifact.'};
  }
  await updateDraftContent(draft.id, draft.slug, draft.frontmatter, appendArtifactFence(draft.body, artifactId));
  return {attached: true, id: artifactId, draftId: draft.id, note: 'Inserted the artifact fence. The note is still unpublished.'};
}

export type AttachResult = {
  attached: boolean;
  reason: string;
  draftId?: string;
};

export async function attachVirtualThreadsArtifact(): Promise<AttachResult> {
  const artifact = await readMergedArtifact(VIRTUAL_THREADS_ARTIFACT);
  if (!artifact) return {attached: false, reason: 'The virtual-thread artifact is not in the catalog.'};
  const existing = await draftByTitle(VIRTUAL_THREADS_TITLE);
  if (existing) {
    if (referencesArtifact(existing.body, VIRTUAL_THREADS_ARTIFACT)) {
      return {attached: false, reason: 'The draft already includes this artifact.', draftId: existing.id};
    }
    await updateDraftContent(existing.id, existing.slug, existing.frontmatter, appendArtifactFence(existing.body, VIRTUAL_THREADS_ARTIFACT));
    return {attached: true, reason: 'Inserted the artifact fence into the open draft. The live article was not published.', draftId: existing.id};
  }
  const postsLive = await livePosts();
  const post = postsLive.find((item) => item.title === VIRTUAL_THREADS_TITLE);
  if (!post) return {attached: false, reason: 'The live article was not in this database.'};
  const opened = await openDraft('post', post.slug, post.title);
  if (referencesArtifact(opened.body, VIRTUAL_THREADS_ARTIFACT)) {
    return {attached: false, reason: 'The draft already includes this artifact.', draftId: opened.id};
  }
  await updateDraftContent(opened.id, opened.slug, opened.frontmatter, appendArtifactFence(opened.body, VIRTUAL_THREADS_ARTIFACT));
  return {attached: true, reason: 'Opened a draft and inserted the artifact fence. The live article was not published.', draftId: opened.id};
}
