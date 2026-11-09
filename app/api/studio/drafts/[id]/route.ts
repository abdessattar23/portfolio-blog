import {isRefusal, requireOwnerApi} from '../../../../../lib/studio/auth';
import {deleteDraft, getDraft, updateDraftContent} from '../../../../../lib/studio/drafts';

export async function GET(request: Request, context: {params: Promise<{id: string}>}) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const {id} = await context.params;
  const draft = await getDraft(id);
  if (!draft) return new Response('Draft not found.', {status: 404});
  return Response.json(draft);
}

export async function PUT(request: Request, context: {params: Promise<{id: string}>}) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const {id} = await context.params;
  const draft = await getDraft(id);
  if (!draft) return new Response('Draft not found.', {status: 404});
  const payload: unknown = await request.json();
  if (typeof payload !== 'object' || payload === null) return new Response('Invalid draft.', {status: 400});
  const record = payload as Record<string, unknown>;
  if (typeof record.frontmatter !== 'string' || typeof record.body !== 'string') {
    return new Response('A draft needs frontmatter and a body.', {status: 400});
  }
  const slug = typeof record.slug === 'string' && /^[a-z0-9-]+$/.test(record.slug) ? record.slug : draft.slug;
  await updateDraftContent(id, slug, record.frontmatter, record.body);
  return Response.json({ok: true});
}

export async function POST(request: Request, context: {params: Promise<{id: string}>}) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const {id} = await context.params;
  const form = await request.formData();
  if (String(form.get('_action') ?? '') === 'delete') {
    await deleteDraft(id);
  }
  return Response.redirect(new URL('/studio', request.url), 303);
}

export async function DELETE(request: Request, context: {params: Promise<{id: string}>}) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const {id} = await context.params;
  await deleteDraft(id);
  return Response.json({ok: true});
}
