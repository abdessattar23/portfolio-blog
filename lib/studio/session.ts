export const OWNER = 'abdessattar23';
export const SESSION_COOKIE = 'studio_session';
export const STATE_COOKIE = 'studio_oauth_state';
export const RETURN_COOKIE = 'studio_return';

const SESSION_MS = 7 * 24 * 60 * 60 * 1000;
const encoder = new TextEncoder();

export type Session = {
  login: string;
};

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function base64UrlToBytes(value: string): Uint8Array {
  const padded = value.replaceAll('-', '+').replaceAll('_', '/') + '='.repeat((4 - (value.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmacKey(secret: string, usages: KeyUsage[]) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, usages);
}

export async function signSession(login: string, secret: string): Promise<string> {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify({login, exp: Date.now() + SESSION_MS})));
  const key = await hmacKey(secret, ['sign']);
  const signature = bytesToBase64Url(new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(payload))));
  return `${payload}.${signature}`;
}

export async function verifySession(token: string, secret: string): Promise<Session | null> {
  const [payload, signature] = token.split('.');
  if (!payload || !signature) return null;
  const key = await hmacKey(secret, ['verify']);
  const valid = await crypto.subtle.verify('HMAC', key, base64UrlToBytes(signature), encoder.encode(payload));
  if (!valid) return null;
  let parsed: unknown;
  try {
    parsed = JSON.parse(new TextDecoder().decode(base64UrlToBytes(payload))) as unknown;
  } catch {
    return null;
  }
  if (typeof parsed !== 'object' || parsed === null) return null;
  const record = parsed as Record<string, unknown>;
  if (record['login'] !== OWNER || typeof record['exp'] !== 'number' || record['exp'] < Date.now()) return null;
  return {login: OWNER};
}

export function readCookie(header: string | null, name: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(';')) {
    const [key, ...rest] = part.trim().split('=');
    if (key === name) return decodeURIComponent(rest.join('='));
  }
  return undefined;
}

export function cookieHeader(name: string, value: string, maxAge: number, secure: boolean): string {
  return `${name}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}${secure ? '; Secure' : ''}`;
}

export function clearCookie(name: string, secure: boolean): string {
  return cookieHeader(name, '', 0, secure);
}

export function safeReturnPath(value: string | null): string {
  if (!value || !value.startsWith('/studio') || value.startsWith('//')) return '/studio';
  return value;
}
