import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {unpublishById} from '../../../../lib/studio/publish';

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  try {
    await unpublishById(id);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unpublish failed.';
    const status = message.includes('not found') || message.includes('Only a post') ? 400 : 502;
    return new Response(message, {status});
  }
  return Response.redirect(new URL('/studio', request.url), 303);
}
