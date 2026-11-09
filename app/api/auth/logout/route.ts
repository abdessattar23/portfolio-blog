import {RETURN_COOKIE, SESSION_COOKIE, STATE_COOKIE, clearCookie} from '../../../../lib/studio/auth';

export function GET(request: Request) {
  const secure = new URL(request.url).protocol === 'https:';
  const response = new Response(null, {status: 302, headers: {Location: '/'}});
  response.headers.append('Set-Cookie', clearCookie(SESSION_COOKIE, secure));
  response.headers.append('Set-Cookie', clearCookie(STATE_COOKIE, secure));
  response.headers.append('Set-Cookie', clearCookie(RETURN_COOKIE, secure));
  return response;
}
