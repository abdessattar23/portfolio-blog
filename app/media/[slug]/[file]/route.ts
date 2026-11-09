import {mediaBucket} from '../../../../lib/studio/db';

export async function GET(_request: Request, context: {params: Promise<{slug: string; file: string}>}) {
  const {slug, file} = await context.params;
  if (!/^[a-z0-9-]+$/.test(slug) || !/^[a-z0-9.-]+$/.test(file) || file.includes('..')) {
    return new Response('Not found.', {status: 404});
  }
  const bucket = await mediaBucket();
  const object = await bucket.get(`media/${slug}/${file.toLowerCase()}`);
  if (!object) return new Response('Not found.', {status: 404});
  const contentType = object.httpMetadata?.contentType ?? 'application/octet-stream';
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': 'public, max-age=86400',
    'X-Content-Type-Options': 'nosniff',
  };
  if (contentType === 'image/svg+xml') headers['Content-Security-Policy'] = "default-src 'none'; style-src 'unsafe-inline'; sandbox";
  return new Response(object.body, {headers});
}
