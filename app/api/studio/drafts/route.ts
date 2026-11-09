import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {isDraftKind, listDrafts, openDraft} from '../../../../lib/studio/drafts';

const DESTINATIONS = {
  post: 'posts',
  work: 'work',
  talk: 'talks',
  site: 'settings',
} as const;

async function readOpen(request: Request): Promise<{kind: string; slug: string} | Response> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const payload: unknown = await request.json();
    if (typeof payload !== 'object' || payload === null) return new Response('Invalid draft.', {status: 400});
    const record = payload as Record<string, unknown>;
    return {kind: typeof record.kind === 'string' ? record.kind : '', slug: typeof record.slug === 'string' ? record.slug : ''};
  }
  const form = await request.formData();
  return {kind: String(form.get('kind') ?? ''), slug: String(form.get('slug') ?? '')};
}

export async function GET(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  return Response.json(await listDrafts());
}

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const open = await readOpen(request);
  if (open instanceof Response) return open;
  if (!isDraftKind(open.kind) || !/^[a-z0-9-]+$/.test(open.slug)) {
    return new Response('Choose a kind and a lowercase slug.', {status: 400});
  }
  const draft = await openDraft(open.kind, open.slug);
  const destination = open.kind === 'site' ? '/studio/settings' : `/studio/${DESTINATIONS[open.kind]}/${draft.id}`;
  return Response.redirect(new URL(destination, request.url), 303);
}
