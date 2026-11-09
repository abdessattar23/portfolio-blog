import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {publishById} from '../../../../lib/studio/publish';

type PublishPayload = {
  id: string;
  frontmatter?: string;
  body?: string;
};

async function readPublishPayload(request: Request): Promise<PublishPayload> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const payload: unknown = await request.json();
    if (typeof payload === 'object' && payload !== null) {
      const record = payload as Record<string, unknown>;
      return {
        id: typeof record.id === 'string' ? record.id : '',
        ...(typeof record.frontmatter === 'string' ? {frontmatter: record.frontmatter} : {}),
        ...(typeof record.body === 'string' ? {body: record.body} : {}),
      };
    }
    return {id: ''};
  }
  const form = await request.formData();
  const frontmatter = form.get('frontmatter');
  const body = form.get('body');
  return {
    id: String(form.get('id') ?? ''),
    ...(typeof frontmatter === 'string' ? {frontmatter} : {}),
    ...(typeof body === 'string' ? {body} : {}),
  };
}

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const payload = await readPublishPayload(request);
  try {
    const override: {frontmatter?: string; body?: string} = {
      ...(payload.frontmatter !== undefined ? {frontmatter: payload.frontmatter} : {}),
      ...(payload.body !== undefined ? {body: payload.body} : {}),
    };
    await publishById(payload.id, override);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed.';
    const status = message.includes('not found') ? 404 : message.includes('changed on GitHub') || message.includes('no longer') ? 409 : message.includes('not configured') ? 503 : message.startsWith('GitHub 422') ? 409 : 400;
    return new Response(message, {status});
  }
  return Response.redirect(new URL('/studio', request.url), 303);
}
