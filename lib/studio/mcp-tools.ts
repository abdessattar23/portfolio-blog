import {previewArtifact} from '../artifacts/format';
import {isArtifactId} from '../artifacts/schema';
import {searchCorpus, type AgentSite} from '../agent/content';
import {slugifyHeading, type SiteSettings} from '../content/schema';
import {seoHealth} from './seo';
import {mergedArtifacts, readMergedArtifact, studioArtifactIds} from '../artifacts/resolve';
import {
  attachArtifactToDraft,
  deleteArtifactIfAllowed,
  parseStoredArtifact,
  writeArtifact,
} from './artifacts';
import {findDraft, isDraftKind, listDrafts, openDraft, updateDraftContent, deleteDraft, getDraft, type Draft, type DraftKind} from './drafts';
import {mediaBucket} from './db';
import {publishById, unpublishById} from './publish';
import {livePosts, liveTalks, liveWorkCases, readLiveSiteSettings} from './published';

type JsonSchema = Record<string, unknown>;

export type StudioTool = {
  name: string;
  title: string;
  description: string;
  inputSchema: JsonSchema;
  annotations: {
    readOnlyHint: boolean;
    destructiveHint: boolean;
    idempotentHint: boolean;
  };
};

const objectSchema = (properties: JsonSchema, required: string[] = []): JsonSchema => ({
  type: 'object',
  properties,
  required,
  additionalProperties: false,
});

const kindSchema = {type: 'string', enum: ['post', 'work', 'talk', 'site'], description: 'post is a note, work is a case study, talk is a speaking entry, site is the author profile.'};
const idSchema = {type: 'string', description: 'Draft id returned by list_drafts or create_draft.'};
const confirmSchema = {type: 'boolean', description: 'Must be true. Set it only after the owner explicitly asks for this action.'};
const fieldsSchema = {
  type: 'object',
  description: 'Frontmatter fields to merge. For a talk: title, status (Upcoming, Delivered, Proposal), event, location, summary, detail. For a note: title, description, excerpt, topics, template, draft, skin, stickers, accent, homeDiff, bannerImage, bannerAlt. For a case: number, shortTitle, topic, title, summary, problem, change, verification, boundary, noteSlug. For site: the site.json keys. Employer stays Sofrecom (Orange Group) at sofrecom.com.',
  additionalProperties: true,
};

function tool(
  name: string,
  title: string,
  description: string,
  properties: JsonSchema,
  required: string[],
  readOnly: boolean,
  destructive = false,
): StudioTool {
  return {
    name,
    title,
    description,
    inputSchema: objectSchema(properties, required),
    annotations: {
      readOnlyHint: readOnly,
      destructiveHint: destructive,
      idempotentHint: readOnly || name === 'update_draft' || name === 'update_artifact' || name === 'attach_artifact',
    },
  };
}

export const STUDIO_TOOLS: readonly StudioTool[] = [
  tool('list_artifacts', 'List interactive artifacts', 'Use this to see reusable interactive figures before editing or inserting one. Returns id, title, classification, view, and source. This does not publish.', {}, [], true),
  tool('read_artifact', 'Read an interactive artifact', 'Use this to read one interactive artifact JSON document by id.', {id: {type: 'string', description: 'Artifact id, such as virtual-thread-pool.'}}, ['id'], true),
  tool('preview_artifact', 'Preview an interactive artifact', 'Use this to validate interactive artifact JSON. Returns errors, the fallback text, and the markdown fence. It does not return HTML and does not save.', {
    id: {type: 'string', description: 'Saved artifact id. Omit when document is provided.'},
    document: {type: 'object', description: 'Artifact JSON, version 1. Describes a view. No JavaScript, HTML, or raw SVG.', additionalProperties: true},
  }, [], true),
  tool('create_artifact', 'Create an interactive artifact', 'Use this to save a new version 1 interactive artifact. Fails if the id exists. This does not publish and does not edit an article.', {
    document: {type: 'object', description: 'Artifact JSON, version 1.', additionalProperties: true},
  }, ['document'], false),
  tool('update_artifact', 'Update an interactive artifact', 'Use this to replace an existing interactive artifact document. The id inside the document must already exist. This does not publish.', {
    document: {type: 'object', description: 'Replacement artifact JSON, version 1.', additionalProperties: true},
  }, ['document'], false),
  tool('attach_artifact', 'Attach an interactive artifact', 'Use this to insert an interactive artifact fence into a note draft. It does not publish. If the fence is already there, the draft is left unchanged.', {
    id: {type: 'string', description: 'Artifact id to insert.'},
    draft_id: idSchema,
  }, ['id', 'draft_id'], false),
  tool('delete_artifact', 'Delete an interactive artifact', 'Use this only when the owner explicitly asks to delete a studio artifact. Requires confirm true. Refuses while a note still references the id. Does not delete the git catalog and does not publish.', {
    id: {type: 'string', description: 'Artifact id.'},
    confirm: confirmSchema,
  }, ['id', 'confirm'], false, true),
  tool('list_drafts', 'List drafts', 'Use this to see private unpublished work before editing it. Returns id, kind, slug, title, and updatedAt.', {kind: kindSchema}, [], true),
  tool('read_draft', 'Read a draft', 'Use this to read one private draft, including its fields and markdown body, before changing it.', {id: idSchema}, ['id'], true),
  tool('create_draft', 'Create or open a draft', 'Use this to start a note, case, talk, or site draft. A talk slug is optional and is derived from the title unless slug is set. If that slug is already open, the existing draft is returned unchanged.', {
    kind: kindSchema,
    title: {type: 'string', description: 'Title. Required for a new talk.'},
    slug: {type: 'string', description: 'Lowercase URL slug. Leave empty for a new talk unless a specific slug is wanted. Required for a note or case. Use site for site settings.'},
    body: {type: 'string', description: 'Markdown body for a new draft.'},
    fields: fieldsSchema,
  }, ['kind'], false),
  tool('update_draft', 'Update a draft', 'Use this to change a draft’s markdown body, slug, or frontmatter fields. Omitted parts stay as they are. This does not publish.', {
    id: idSchema,
    slug: {type: 'string', description: 'Replacement slug, if the URL should change.'},
    body: {type: 'string', description: 'Replacement markdown body.'},
    fields: fieldsSchema,
  }, ['id'], false),
  tool('delete_draft', 'Delete a draft', 'Use this only when the owner explicitly asks to discard a private draft. This does not change the live site.', {id: idSchema, confirm: confirmSchema}, ['id', 'confirm'], false, true),
  tool('publish_draft', 'Publish a draft', 'Use this only when the owner explicitly asks to publish. It writes the draft to the live site and GitHub, then removes the draft.', {id: idSchema, confirm: confirmSchema}, ['id', 'confirm'], false, true),
  tool('unpublish_post', 'Unpublish a note', 'Use this only when the owner explicitly asks to hide a published note. It marks the note as a draft and publishes that state.', {id: idSchema, confirm: confirmSchema}, ['id', 'confirm'], false, true),
  tool('list_published', 'List published work', 'Use this to list live notes, case studies, and talks.', {kind: kindSchema}, [], true),
  tool('read_published', 'Read published work', 'Use this to read one live note, case, or talk by kind and slug, including the note body.', {kind: kindSchema, slug: {type: 'string', description: 'Published slug.'}}, ['kind', 'slug'], true),
  tool('search_published', 'Search the site', 'Use this before guessing. Searches live notes, cases, and talks.', {query: {type: 'string', description: 'Words to match.'}}, ['query'], true),
  tool('read_site_settings', 'Read site settings', 'Use this to read the live author profile, employer, links, and topics.', {}, [], true),
  tool('upload_image', 'Upload an image', 'Use this to store an image for a note. Then reference the returned url in markdown. PNG, JPEG, WebP, GIF, SVG, or ICO, under 5 MB.', {
    slug: {type: 'string', description: 'Note slug the image belongs to.'},
    filename: {type: 'string', description: 'File name, such as sampler.png.'},
    content_type: {type: 'string', description: 'image/png, image/jpeg, image/webp, image/gif, image/svg+xml, or image/x-icon.'},
    data_base64: {type: 'string', description: 'Base64 file contents, without a data: prefix if possible.'},
  }, ['slug', 'filename', 'content_type', 'data_base64'], false),
  tool('list_images', 'List images', 'Use this to list images already stored for a slug.', {slug: {type: 'string', description: 'Note slug.'}}, ['slug'], true),
  tool('check_seo', 'Check note SEO', 'Use this on a note draft before publishing. It checks title length, description length, topics, and image alt text.', {id: idSchema}, ['id'], true),
];

const TEMPLATES = new Set(['deep-dive', 'bug-story', 'til', 'talk-notes']);
const SKINS = new Set(['plain', 'retro', 'terminal', 'field-notes']);
const STICKERS = new Set(['star', 'bug', 'ship', 'coffee', 'pin', 'reviewed']);
const TALK_STATUS = new Map([['upcoming', 'Upcoming'], ['delivered', 'Delivered'], ['proposal', 'Proposal']]);
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif', 'image/svg+xml', 'image/x-icon']);
const MAX_IMAGE = 5 * 1024 * 1024;
const MAX_TEXT = 400_000;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function confirmed(value: unknown): boolean {
  return value === true || value === 'true';
}

function slugOf(value: unknown): string {
  const slug = text(value).toLowerCase();
  if (!/^[a-z0-9-]+$/.test(slug)) throw new Error('Use a lowercase slug made of letters, numbers, and hyphens.');
  return slug;
}

function json(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

function titleOf(draft: Draft): string {
  try {
    const parsed: unknown = JSON.parse(draft.frontmatter);
    if (isRecord(parsed) && typeof parsed.title === 'string' && parsed.title.trim()) return parsed.title.trim();
  } catch {
    return draft.slug;
  }
  return draft.slug;
}

function summary(draft: Draft, created?: boolean) {
  return {
    ...(created === undefined ? {} : {created}),
    id: draft.id,
    kind: draft.kind,
    slug: draft.slug,
    title: titleOf(draft),
    updatedAt: draft.updatedAt,
  };
}

function assertEmployer(fields: Record<string, unknown>) {
  if (typeof fields.employer === 'string' && /orange\.com/i.test(fields.employer)) {
    throw new Error('The employer is Sofrecom (Orange Group) at https://www.sofrecom.com. Do not use orange.com.');
  }
  if (!Array.isArray(fields.organizations)) return;
  for (const org of fields.organizations) {
    if (isRecord(org) && typeof org.url === 'string' && /orange\.com/i.test(org.url)) {
      throw new Error('Do not use orange.com as a workplace URL. Orange Group is the parent, with no URL.');
    }
  }
}

function normalizeFields(kind: DraftKind, fields: Record<string, unknown>) {
  if (kind === 'talk' && typeof fields.status === 'string') {
    const status = TALK_STATUS.get(fields.status.toLowerCase());
    if (!status) throw new Error('Talk status must be Upcoming, Delivered, or Proposal.');
    fields.status = status;
  }
  if (kind === 'post' && fields.template !== undefined && (typeof fields.template !== 'string' || !TEMPLATES.has(fields.template))) {
    throw new Error('Note template must be deep-dive, bug-story, til, or talk-notes.');
  }
  if (kind === 'post' && fields.skin !== undefined && (typeof fields.skin !== 'string' || !SKINS.has(fields.skin))) {
    throw new Error('Note skin must be plain, retro, terminal, or field-notes.');
  }
  if (kind === 'post' && fields.stickers !== undefined) {
    if (!Array.isArray(fields.stickers) || fields.stickers.some((item) => typeof item !== 'string' || !STICKERS.has(item))) {
      throw new Error('Stickers must be star, bug, ship, coffee, pin, or reviewed.');
    }
  }
  if (fields.topics !== undefined && (!Array.isArray(fields.topics) || fields.topics.some((item) => typeof item !== 'string'))) {
    throw new Error('topics must be a list of strings.');
  }
  assertEmployer(fields);
}

function mergedFrontmatter(current: string, fields: unknown, slug: string, kind: DraftKind): string {
  let base: unknown;
  try {
    base = JSON.parse(current);
  } catch {
    throw new Error('Draft fields are unreadable.');
  }
  if (!isRecord(base)) throw new Error('Draft fields are unreadable.');
  if (fields !== undefined && !isRecord(fields)) throw new Error('fields must be an object.');
  const next = {...base, ...(isRecord(fields) ? fields : {}), slug};
  delete next.body;
  normalizeFields(kind, next);
  const encoded = JSON.stringify(next);
  if (encoded.length > MAX_TEXT) throw new Error('Those fields are too large.');
  return encoded;
}

function siteFor(settings: SiteSettings): AgentSite {
  return {
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
  };
}

function publicUrl(kind: DraftKind, slug: string, origin: string): string {
  if (kind === 'post') return `${origin}/blog/${slug}`;
  if (kind === 'work') return `${origin}/work/${slug}`;
  if (kind === 'talk') return `${origin}/speaking`;
  return origin;
}

async function requireDraft(id: string): Promise<Draft> {
  const draft = await getDraft(text(id));
  if (!draft) throw new Error('No draft with that id.');
  return draft;
}

function bounded(value: string, label: string): string {
  if (value.length > MAX_TEXT) throw new Error(`${label} is too large.`);
  return value;
}

function artifactInput(value: unknown): unknown {
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value) as unknown;
  } catch {
    throw new Error('document must be artifact JSON.');
  }
}

async function artifactSummary(id: string) {
  const artifact = await readMergedArtifact(id);
  const studio = (await studioArtifactIds()).has(id);
  if (!artifact) return null;
  return {
    id: artifact.id,
    title: artifact.title,
    classification: artifact.classification,
    view: artifact.view.type,
    source: studio ? 'studio' : 'catalog',
    document: artifact,
  };
}

function optionalBody(value: unknown, current: string): string {
  if (value === undefined) return current;
  if (typeof value !== 'string') throw new Error('body must be a string.');
  return bounded(value, 'Body');
}

export async function callStudioTool(name: string, args: Record<string, unknown>, origin: string): Promise<string> {
  if (!STUDIO_TOOLS.some((item) => item.name === name)) throw new Error(`Unknown tool: ${name}`);
  if (name === 'list_drafts') {
    const kind = text(args.kind);
    const drafts = await listDrafts();
    const filtered = kind ? drafts.filter((draft) => draft.kind === kind) : drafts;
    return json({drafts: filtered.map((draft) => summary(draft))});
  }
  if (name === 'read_draft') {
    const draft = await requireDraft(text(args.id));
    let fields: unknown = draft.frontmatter;
    try {
      fields = JSON.parse(draft.frontmatter);
    } catch {
      fields = {raw: draft.frontmatter};
    }
    return json({...summary(draft), fields, body: draft.body});
  }
  if (name === 'create_draft') {
    const kind = text(args.kind);
    if (!isDraftKind(kind)) throw new Error('kind must be post, work, talk, or site.');
    const title = text(args.title);
    let slug = text(args.slug).toLowerCase();
    if (kind === 'site') slug = 'site';
    else if (!slug && kind === 'talk') slug = slugifyHeading(title);
    if (!slug || slug === 'section') throw new Error(kind === 'talk' ? 'A talk needs a title or a slug.' : 'A note or case needs a slug.');
    slug = slugOf(slug);
    const existing = await findDraft(kind, slug);
    if (existing) return json({...summary(existing, false), note: 'A draft for this slug is already open. Use update_draft to change it.'});
    const draft = await openDraft(kind, slug, title);
    if (args.fields !== undefined && !isRecord(args.fields)) throw new Error('fields must be an object.');
    const body = optionalBody(args.body, draft.body);
    const patch: Record<string, unknown> = {...(isRecord(args.fields) ? args.fields : {})};
    if (title && patch.title === undefined) patch.title = title;
    const frontmatter = Object.keys(patch).length > 0 ? mergedFrontmatter(draft.frontmatter, patch, slug, kind) : draft.frontmatter;
    if (frontmatter !== draft.frontmatter || body !== draft.body) await updateDraftContent(draft.id, slug, frontmatter, body);
    const saved = await getDraft(draft.id);
    return json(summary(saved ?? draft, true));
  }
  if (name === 'update_draft') {
    if (args.fields !== undefined && !isRecord(args.fields)) throw new Error('fields must be an object.');
    const draft = await requireDraft(text(args.id));
    const slug = args.slug === undefined ? draft.slug : slugOf(args.slug);
    const body = optionalBody(args.body, draft.body);
    const frontmatter = args.fields === undefined ? mergedFrontmatter(draft.frontmatter, undefined, slug, draft.kind) : mergedFrontmatter(draft.frontmatter, args.fields, slug, draft.kind);
    await updateDraftContent(draft.id, slug, frontmatter, body);
    const saved = await getDraft(draft.id);
    return json(summary(saved ?? {...draft, slug, body, frontmatter}, undefined));
  }
  if (name === 'delete_draft') {
    if (!confirmed(args.confirm)) throw new Error('Refusing to delete a draft without confirm: true.');
    const draft = await requireDraft(text(args.id));
    await deleteDraft(draft.id);
    return json({deleted: true, id: draft.id, kind: draft.kind, slug: draft.slug});
  }
  if (name === 'publish_draft') {
    if (!confirmed(args.confirm)) throw new Error('Refusing to publish without confirm: true.');
    const draft = await publishById(text(args.id));
    return json({published: true, kind: draft.kind, slug: draft.slug, url: publicUrl(draft.kind, draft.slug, origin)});
  }
  if (name === 'unpublish_post') {
    if (!confirmed(args.confirm)) throw new Error('Refusing to unpublish without confirm: true.');
    const draft = await requireDraft(text(args.id));
    if (draft.kind !== 'post') throw new Error('Only a note can be unpublished.');
    await unpublishById(draft.id);
    return json({unpublished: true, slug: draft.slug, url: publicUrl('post', draft.slug, origin)});
  }
  if (name === 'list_published') {
    const kind = text(args.kind);
    const [posts, work, talks] = await Promise.all([livePosts(), liveWorkCases(), liveTalks()]);
    const payload = {
      posts: posts.map((post) => ({slug: post.slug, title: post.title, draft: post.draft, publishedAt: post.publishedAt})),
      work: work.map((item) => ({slug: item.slug, number: item.number, title: item.title})),
      talks: talks.map((talk) => ({slug: talk.slug, title: talk.title, status: talk.status, event: talk.event})),
    };
    if (kind === 'post') return json({posts: payload.posts});
    if (kind === 'work') return json({work: payload.work});
    if (kind === 'talk') return json({talks: payload.talks});
    return json(payload);
  }
  if (name === 'read_published') {
    const kind = text(args.kind);
    const slug = slugOf(args.slug);
    if (kind === 'post') {
      const post = (await livePosts()).find((item) => item.slug === slug);
      if (!post) throw new Error(`No note with slug ${slug}.`);
      return json(post);
    }
    if (kind === 'work') {
      const item = (await liveWorkCases()).find((entry) => entry.slug === slug);
      if (!item) throw new Error(`No case with slug ${slug}.`);
      return json(item);
    }
    if (kind === 'talk') {
      const talk = (await liveTalks()).find((item) => item.slug === slug);
      if (!talk) throw new Error(`No talk with slug ${slug}.`);
      return json(talk);
    }
    throw new Error('kind must be post, work, or talk.');
  }
  if (name === 'search_published') {
    const query = text(args.query);
    if (!query) throw new Error('query is required.');
    const [settings, posts, work, talks] = await Promise.all([readLiveSiteSettings(), livePosts(), liveWorkCases(), liveTalks()]);
    const hits = searchCorpus({site: siteFor(settings), posts, work, talks}, query, 8);
    if (hits.length === 0) return json({hits: []});
    return json({
      hits: hits.map((hit) => ({
        ...hit,
        draft: hit.kind === 'post' ? posts.find((post) => post.slug === hit.slug)?.draft ?? false : false,
      })),
    });
  }
  if (name === 'read_site_settings') return json(await readLiveSiteSettings());
  if (name === 'upload_image') {
    const slug = slugOf(args.slug);
    const contentType = text(args.content_type);
    if (!IMAGE_TYPES.has(contentType)) throw new Error('Use a PNG, JPEG, WebP, GIF, SVG, or ICO.');
    const filename = text(args.filename).toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'image';
    let bytes: Uint8Array;
    try {
      const cleaned = text(args.data_base64).replace(/^data:[^,]*,/, '').replace(/\s/g, '');
      const binary = atob(cleaned);
      bytes = new Uint8Array(binary.length);
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
    } catch {
      throw new Error('data_base64 is not valid base64.');
    }
    if (bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE) throw new Error('The image must be under 5 MB.');
    const key = `media/${slug}/${filename}`;
    const bucket = await mediaBucket();
    await bucket.put(key, bytes, {httpMetadata: {contentType}});
    return json({url: `/media/${slug}/${filename}`, key});
  }
  if (name === 'list_images') {
    const slug = slugOf(args.slug);
    const bucket = await mediaBucket();
    const listed = await bucket.list({prefix: `media/${slug}/`, limit: 100});
    return json({
      images: listed.objects.map((object) => ({
        key: object.key,
        url: `/${object.key}`,
      })),
    });
  }
  if (name === 'list_artifacts') {
    const studio = await studioArtifactIds();
    const artifacts = await mergedArtifacts();
    return json({
      artifacts: artifacts.map((artifact) => ({
        id: artifact.id,
        title: artifact.title,
        classification: artifact.classification,
        view: artifact.view.type,
        source: studio.has(artifact.id) ? 'studio' : 'catalog',
      })),
    });
  }
  if (name === 'read_artifact') {
    const id = text(args.id);
    if (!isArtifactId(id)) throw new Error('Use a lowercase artifact id.');
    const artifact = await artifactSummary(id);
    if (!artifact) throw new Error('No artifact with that id.');
    return json(artifact);
  }
  if (name === 'preview_artifact') {
    if (args.document !== undefined) return json(previewArtifact(artifactInput(args.document)));
    const id = text(args.id);
    if (!id) throw new Error('Provide an id or a document.');
    if (!isArtifactId(id)) throw new Error('Use a lowercase artifact id.');
    const artifact = await readMergedArtifact(id);
    if (!artifact) throw new Error('No artifact with that id.');
    return json(previewArtifact(artifact));
  }
  if (name === 'create_artifact') {
    const artifact = parseStoredArtifact(artifactInput(args.document));
    if (await readMergedArtifact(artifact.id)) throw new Error('An artifact with that id already exists. Use update_artifact.');
    await writeArtifact(artifact);
    return json({created: true, id: artifact.id, title: artifact.title, view: artifact.view.type});
  }
  if (name === 'update_artifact') {
    const artifact = parseStoredArtifact(artifactInput(args.document));
    if (!(await readMergedArtifact(artifact.id))) throw new Error('No artifact with that id. Use create_artifact.');
    await writeArtifact(artifact);
    return json({updated: true, id: artifact.id, title: artifact.title, view: artifact.view.type});
  }
  if (name === 'attach_artifact') {
    return json(await attachArtifactToDraft(text(args.id), text(args.draft_id)));
  }
  if (name === 'delete_artifact') {
    return json(await deleteArtifactIfAllowed(text(args.id), confirmed(args.confirm)));
  }
  if (name === 'check_seo') {
    const draft = await requireDraft(text(args.id));
    if (draft.kind !== 'post') return json({notes: [{level: 'ok', text: 'SEO check applies to notes.'}]});
    const fields: unknown = JSON.parse(draft.frontmatter);
    if (!isRecord(fields)) throw new Error('Draft fields are unreadable.');
    return json({
      notes: seoHealth({
        title: typeof fields.title === 'string' ? fields.title : '',
        description: typeof fields.description === 'string' ? fields.description : '',
        topics: Array.isArray(fields.topics) ? fields.topics.filter((item): item is string => typeof item === 'string') : [],
        body: draft.body,
      }),
    });
  }
  throw new Error(`Unknown tool: ${name}`);
}
