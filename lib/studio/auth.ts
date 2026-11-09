import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {studioEnv} from './db';
import {
  OWNER,
  RETURN_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  cookieHeader,
  readCookie as readHeaderCookie,
  safeReturnPath,
  signSession,
  verifySession,
  type Session,
} from './session';

export {
  OWNER,
  RETURN_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  cookieHeader,
  safeReturnPath,
  signSession,
  verifySession,
};
export type {Session};

export function readCookie(request: Request, name: string): string | undefined {
  return readHeaderCookie(request.headers.get('cookie'), name);
}

export async function requireOwnerApi(request: Request): Promise<Session | Response> {
  const secret = studioEnv().SESSION_SECRET;
  if (!secret) return new Response('GitHub sign-in is not configured.', {status: 503});
  const token = readCookie(request, SESSION_COOKIE);
  const session = token ? await verifySession(token, secret) : null;
  if (!session) return new Response('Sign in required.', {status: 401});
  return session;
}

export function isRefusal(value: Session | Response): value is Response {
  return value instanceof Response;
}

export async function requireOwner(): Promise<Session> {
  const secret = studioEnv().SESSION_SECRET;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const session = secret && token ? await verifySession(token, secret) : null;
  if (!session) redirect('/api/auth/login?return=/studio');
  return session;
}
