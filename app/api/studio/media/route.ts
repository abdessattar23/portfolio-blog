import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {mediaBucket} from '../../../../lib/studio/db';

const TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif']);
const MAX_BYTES = 5 * 1024 * 1024;

export async function GET(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const url = new URL(request.url);
  const key = url.searchParams.get('key') ?? '';
  if (!key.startsWith('media/')) return new Response('Not found.', {status: 404});
  const bucket = await mediaBucket();
  const object = await bucket.get(key);
  if (!object) return new Response('Not found.', {status: 404});
  return new Response(object.body, {
    headers: {'Content-Type': object.httpMetadata?.contentType ?? 'application/octet-stream'},
  });
}

export async function POST(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const form = await request.formData();
  const file = form.get('file');
  const slug = String(form.get('slug') ?? '');
  if (!(file instanceof File) || !TYPES.has(file.type) || file.size > MAX_BYTES) {
    return new Response('Upload a PNG, JPEG, WebP, or GIF under 5 MB.', {status: 400});
  }
  if (!/^[a-z0-9-]+$/.test(slug)) return new Response('Invalid slug.', {status: 400});
  const filename = file.name.toLowerCase().replace(/[^a-z0-9.]+/g, '-').replace(/^-|-$/g, '') || 'image';
  const key = `media/${slug}/${filename}`;
  const bucket = await mediaBucket();
  await bucket.put(key, await file.arrayBuffer(), {httpMetadata: {contentType: file.type}});
  return Response.json({url: `/media/${slug}/${filename}`, key});
}
