import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {publishById} from '../../../../lib/studio/publish';

async function readId(request: Request): Promise<string> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const payload: unknown = await request.json();
    if (typeof payload === 'object' && payload !== null && 'id' in payload && typeof payload.id === 'string') return payload.id;
    return '';
  }
  const form = await request.formData();
  return String(form.get('id') ?? '');
}

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const id = await readId(request);
  try {
    await publishById(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Publish failed.';
    const status = message.includes('not found') ? 404 : message.includes('changed on GitHub') || message.includes('no longer') ? 409 : message.includes('not configured') ? 503 : message.startsWith('GitHub 422') ? 409 : 400;
    return new Response(message, {status});
  }
  return Response.redirect(new URL('/studio', request.url), 303);
}
