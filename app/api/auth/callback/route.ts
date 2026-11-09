import {
  OWNER,
  RETURN_COOKIE,
  SESSION_COOKIE,
  STATE_COOKIE,
  clearCookie,
  cookieHeader,
  readCookie,
  safeReturnPath,
  signSession,
} from '../../../../lib/studio/auth';
import {studioEnv} from '../../../../lib/studio/db';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function GET(request: Request) {
  const env = studioEnv();
  const url = new URL(request.url);
  const secure = url.protocol === 'https:';
  const state = url.searchParams.get('state');
  const code = url.searchParams.get('code');
  if (!env.GITHUB_CLIENT_ID || !env.GITHUB_CLIENT_SECRET || !env.SESSION_SECRET) {
    return new Response('GitHub sign-in is not configured.', {status: 503});
  }
  if (!state || !code || state !== readCookie(request, STATE_COOKIE)) {
    return new Response('Sign-in could not be verified. Start again.', {status: 400});
  }

  const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {Accept: 'application/json', 'Content-Type': 'application/json'},
    body: JSON.stringify({
      client_id: env.GITHUB_CLIENT_ID,
      client_secret: env.GITHUB_CLIENT_SECRET,
      code,
      redirect_uri: `${url.origin}/api/auth/callback`,
    }),
  });
  const tokenPayload: unknown = await tokenResponse.json();
  const accessToken = isRecord(tokenPayload) && typeof tokenPayload.access_token === 'string' ? tokenPayload.access_token : undefined;
  if (!accessToken) return new Response('GitHub did not return an access token.', {status: 502});

  const userResponse = await fetch('https://api.github.com/user', {
    headers: {Accept: 'application/vnd.github+json', Authorization: `Bearer ${accessToken}`, 'User-Agent': 'abdessattar-studio'},
  });
  const userPayload: unknown = await userResponse.json();
  const login = isRecord(userPayload) && typeof userPayload.login === 'string' ? userPayload.login : undefined;
  if (login !== OWNER) return new Response('This studio is private.', {status: 403});

  const destination = safeReturnPath(readCookie(request, RETURN_COOKIE) ?? null);
  const response = new Response(null, {status: 302, headers: {Location: destination}});
  response.headers.append('Set-Cookie', cookieHeader(SESSION_COOKIE, await signSession(OWNER, env.SESSION_SECRET), 7 * 24 * 60 * 60, secure));
  response.headers.append('Set-Cookie', clearCookie(STATE_COOKIE, secure));
  response.headers.append('Set-Cookie', clearCookie(RETURN_COOKIE, secure));
  return response;
}
