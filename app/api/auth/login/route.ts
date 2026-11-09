import {RETURN_COOKIE, STATE_COOKIE, cookieHeader, safeReturnPath} from '../../../../lib/studio/auth';
import {studioEnv} from '../../../../lib/studio/db';

export async function GET(request: Request) {
  const env = studioEnv();
  if (!env.GITHUB_CLIENT_ID) return new Response('GitHub sign-in is not configured.', {status: 503});

  const url = new URL(request.url);
  const state = crypto.randomUUID();
  const authorize = new URL('https://github.com/login/oauth/authorize');
  authorize.searchParams.set('client_id', env.GITHUB_CLIENT_ID);
  authorize.searchParams.set('redirect_uri', `${url.origin}/api/auth/callback`);
  authorize.searchParams.set('scope', 'read:user');
  authorize.searchParams.set('state', state);

  const secure = url.protocol === 'https:';
  const response = new Response(null, {status: 302, headers: {Location: authorize.toString()}});
  response.headers.append('Set-Cookie', cookieHeader(STATE_COOKIE, state, 600, secure));
  response.headers.append('Set-Cookie', cookieHeader(RETURN_COOKIE, safeReturnPath(url.searchParams.get('return')), 600, secure));
  return response;
}
