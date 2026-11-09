import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {unpublishById} from '../../../../lib/studio/publish';

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const form = await request.formData();
  const id = String(form.get('id') ?? '');
  const frontmatter = form.get('frontmatter');
  const body = form.get('body');
  const override: {frontmatter?: string; body?: string} = {
    ...(typeof frontmatter === 'string' ? {frontmatter} : {}),
    ...(typeof body === 'string' ? {body} : {}),
  };
  try {
    await unpublishById(id, override);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unpublish failed.';
    const status = message.includes('not found') ? 404 : message.includes('changed on GitHub') || message.includes('no longer') ? 409 : message.includes('not configured') ? 503 : message.startsWith('GitHub 422') ? 409 : 400;
    return new Response(message, {status});
  }
  return Response.redirect(new URL('/studio', request.url), 303);
}
