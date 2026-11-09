import {mediaBucket} from '../../../../lib/studio/db';

export async function GET(_request: Request, context: {params: Promise<{slug: string; file: string}>}) {
  const {slug, file} = await context.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9.-]+$/.test(file) || file.includes('..')) {
    return new Response('Not found.', {status: 404});
  }
  const bucket = await mediaBucket();
  const object = await bucket.get(`media/${slug}/${file.toLowerCase()}`);
  if (!object) return new Response('Not found.', {status: 404});
  return new Response(object.body, {
    headers: {
      'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream',
      'Cache-Control': 'public, max-age=86400',
    },
  });
}
