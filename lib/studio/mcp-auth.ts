const encoder = new TextEncoder();
const ACCESS_SECONDS = 30 * 24 * 60 * 60;
const REFRESH_SECONDS = 90 * 24 * 60 * 60;
const CODE_SECONDS = 5 * 60;
const SCOPE = 'studio';

const CLIENT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com', 'claude.ai']);
const REDIRECT_HOSTS = new Set(['chatgpt.com', 'chat.openai.com', 'claude.ai']);

type TokenKind = 'code' | 'access' | 'refresh' | 'client';

type TokenBody = {
  exp: number;
  cid?: string;
  red?: string;
  ch?: string;
  res?: string;
  aud?: string;
  uris?: string[];
};

export type AuthorizationRequest = {
  clientId: string;
  redirectUri: string;
  state: string;
  challenge: string;
  resource: string;
  scope: string;
};

export function studioResource(origin: string): string {
  return `${origin.replace(/\/$/, '')}/studio/mcp`;
}

export function canonicalResource(value: string, origin: string): string {
  const fallback = studioResource(origin);
  if (!value) return fallback;
  try {
    const url = new URL(value);
    const path = url.pathname.replace(/\/$/, '') || '/';
    if (url.origin === origin && path === '/studio/mcp') return fallback;
  } catch {
    return value;
  }
  return value;
}

export function protectedResourceMetadata(origin: string) {
  return {
    resource: studioResource(origin),
    authorization_servers: [origin],
    scopes_supported: [SCOPE],
    bearer_methods_supported: ['header'],
    resource_name: 'Studio',
  };
}

export function authorizationServerMetadata(origin: string) {
  return {
    issuer: origin,
    authorization_endpoint: `${origin}/oauth/authorize`,
    token_endpoint: `${origin}/oauth/token`,
    registration_endpoint: `${origin}/oauth/register`,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    code_challenge_methods_supported: ['S256'],
    token_endpoint_auth_methods_supported: ['none'],
    client_id_metadata_document_supported: true,
    authorization_response_iss_parameter_supported: true,
    scopes_supported: [SCOPE],
  };
}

export function redirectAllowed(value: string): boolean {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }
  if (url.username || url.password || url.hash) return false;
  return url.protocol === 'https:' && REDIRECT_HOSTS.has(url.hostname);
}

const attempts = new Map<string, {count: number; reset: number}>();

/** Returns true when this attempt is still inside the window. Used when the Worker rate-limit binding is absent. */
export function consumeAttempt(key: string, limit: number, windowMs: number, now = Date.now()): boolean {
  const current = attempts.get(key);
  if (!current || current.reset <= now) {
    attempts.set(key, {count: 1, reset: now + windowMs});
    return true;
  }
  current.count += 1;
  return current.count <= limit;
}

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

async function hmac(value: string, secret: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), {name: 'HMAC', hash: 'SHA-256'}, false, ['sign']);
  const signature = new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
  return bytesToBase64Url(signature);
}

async function same(left: string, right: string): Promise<boolean> {
  const a = encoder.encode(await hmac(left, 'studio-mcp-compare'));
  const b = encoder.encode(await hmac(right, 'studio-mcp-compare'));
  let diff = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) diff |= (a[index] ?? 0) ^ (b[index] ?? 0);
  return diff === 0;
}

export async function apiKeyMatches(provided: string, expected: string): Promise<boolean> {
  if (!provided || !expected) return false;
  return same(provided, expected);
}

async function sign(prefix: string, body: TokenBody, secret: string): Promise<string> {
  const payload = bytesToBase64Url(encoder.encode(JSON.stringify(body)));
  const signature = await hmac(`${prefix}.${payload}`, secret);
  return `${prefix}.${payload}.${signature}`;
}

async function read(token: string, prefix: string, secret: string): Promise<TokenBody | null> {
  const parts = token.split('.');
  if (parts.length !== 3 || parts[0] !== prefix || !parts[1] || !parts[2]) return null;
  const expected = await hmac(`${prefix}.${parts[1]}`, secret);
  if (!(await same(expected, parts[2]))) return null;
  try {
    const parsed: unknown = JSON.parse(new TextDecoder().decode(base64UrlToBytes(parts[1])));
    if (typeof parsed !== 'object' || parsed === null) return null;
    const body = parsed as TokenBody;
    if (typeof body.exp !== 'number' || body.exp < Date.now()) return null;
    return body;
  } catch {
    return null;
  }
}

export async function s256(verifier: string): Promise<string> {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(verifier)));
  return bytesToBase64Url(digest);
}

function verifierOk(value: string): boolean {
  return /^[A-Za-z0-9._~-]{43,128}$/.test(value);
}

export async function registerClient(secret: string, redirectUris: string[], name: string): Promise<{client_id: string; redirect_uris: string[]}> {
  const uris = [...new Set(redirectUris.map((item) => item.trim()).filter(Boolean))];
  if (uris.length === 0 || uris.length > 5) throw new Error('Register one to five redirect URLs.');
  if (uris.some((uri) => !redirectAllowed(uri) || uri.length > 300)) throw new Error('That redirect URL is not allowed.');
  const clientId = await sign('c1', {exp: Date.now() + 365 * 24 * 60 * 60 * 1000, uris, cid: name.slice(0, 80)}, secret);
  return {client_id: clientId, redirect_uris: uris};
}

async function clientAllows(secret: string, clientId: string, redirectUri: string): Promise<boolean> {
  if (!redirectAllowed(redirectUri)) return false;
  if (clientId.startsWith('https://')) {
    let url: URL;
    try {
      url = new URL(clientId);
    } catch {
      return false;
    }
    if (url.protocol !== 'https:' || !CLIENT_HOSTS.has(url.hostname)) return false;
    const response = await fetch(clientId, {
      headers: {Accept: 'application/json'},
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (!response.ok) return false;
    const text = await response.text();
    if (text.length > 65_536) return false;
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return false;
    }
    if (typeof parsed !== 'object' || parsed === null) return false;
    const record = parsed as Record<string, unknown>;
    if (record['client_id'] !== clientId) return false;
    const uris = record['redirect_uris'];
    return Array.isArray(uris) && uris.some((item) => item === redirectUri);
  }
  const body = await read(clientId, 'c1', secret);
  return Boolean(body?.uris?.includes(redirectUri));
}

export async function authorizationCode(secret: string, request: AuthorizationRequest): Promise<string> {
  if (!(await clientAllows(secret, request.clientId, request.redirectUri))) {
    throw new Error('This app is not allowed to sign in.');
  }
  if (!request.challenge || request.challenge.length > 128) throw new Error('PKCE S256 is required.');
  return sign('d1', {
    exp: Date.now() + CODE_SECONDS * 1000,
    cid: request.clientId,
    red: request.redirectUri,
    ch: request.challenge,
    res: request.resource,
  }, secret);
}

export async function exchangeCode(
  secret: string,
  input: {code: string; verifier: string; clientId: string; redirectUri: string; resource: string},
): Promise<{access_token: string; refresh_token: string; expires_in: number; scope: string}> {
  if (!verifierOk(input.verifier)) throw new Error('PKCE verifier is invalid.');
  const code = await read(input.code, 'd1', secret);
  if (!code || code.cid !== input.clientId || code.red !== input.redirectUri) throw new Error('Authorization code is invalid.');
  if (input.resource && code.res && input.resource !== code.res) throw new Error('Token resource does not match.');
  const challenge = await s256(input.verifier);
  if (!(await same(challenge, code.ch ?? ''))) throw new Error('PKCE verification failed.');
  const audience = code.res || input.resource;
  return issueTokens(secret, audience);
}

export async function refreshAccess(
  secret: string,
  refreshToken: string,
  resource: string,
): Promise<{access_token: string; refresh_token: string; expires_in: number; scope: string}> {
  const body = await read(refreshToken, 'r1', secret);
  if (!body?.aud) throw new Error('Refresh token is invalid.');
  if (resource && body.aud !== resource) throw new Error('Token resource does not match.');
  return issueTokens(secret, body.aud);
}

async function issueTokens(secret: string, audience: string) {
  const access = await sign('a1', {exp: Date.now() + ACCESS_SECONDS * 1000, aud: audience}, secret);
  const refresh = await sign('r1', {exp: Date.now() + REFRESH_SECONDS * 1000, aud: audience}, secret);
  return {access_token: access, refresh_token: refresh, expires_in: ACCESS_SECONDS, scope: SCOPE};
}

export async function accessTokenAllows(token: string, secret: string, resource: string): Promise<boolean> {
  if (await apiKeyMatches(token, secret)) return true;
  const body = await read(token, 'a1', secret);
  if (!body?.aud) return false;
  return body.aud === resource || body.aud === resource.replace(/\/$/, '');
}

export function bearerToken(request: Request): string {
  const header = request.headers.get('Authorization') ?? '';
  const match = /^Bearer\s+(\S+)\s*$/i.exec(header);
  return match?.[1] ?? '';
}

function escapeHtml(value: string): string {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

export function authorizePage(request: AuthorizationRequest, error = ''): string {
  const fields: Array<[string, string]> = [
    ['response_type', 'code'],
    ['client_id', request.clientId],
    ['redirect_uri', request.redirectUri],
    ['state', request.state],
    ['code_challenge', request.challenge],
    ['code_challenge_method', 'S256'],
    ['resource', request.resource],
    ['scope', request.scope || SCOPE],
  ];
  const hidden = fields
    .map(([name, value]) => `<input type="hidden" name="${escapeHtml(name)}" value="${escapeHtml(value)}" />`)
    .join('');
  const message = error ? `<p class="error">${escapeHtml(error)}</p>` : '';
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <meta name="robots" content="noindex" />
  <title>Unlock the studio</title>
  <style>
    :root { color-scheme: light dark; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f5f2ea; color: #17202a; font: 16px/1.5 ui-sans-serif, system-ui, sans-serif; }
    main { width: min(26rem, calc(100% - 2rem)); }
    h1 { margin: 0 0 0.4rem; font-size: 1.8rem; letter-spacing: -0.04em; }
    p { margin: 0 0 1rem; color: #4d565e; }
    label { display: grid; gap: 0.4rem; font-size: 0.85rem; }
    input { width: 100%; box-sizing: border-box; min-height: 44px; padding: 0 0.8rem; border: 1px solid #17202a; border-radius: 10px; background: #fff; color: #17202a; font: inherit; }
    button { margin-top: 0.9rem; min-height: 44px; padding: 0 1rem; border: 0; border-radius: 999px; background: #17202a; color: #f5f2ea; font: inherit; font-weight: 650; cursor: pointer; }
    .error { color: #8d2f24; }
    @media (prefers-color-scheme: dark) {
      body { background: #15181d; color: #f3efe7; }
      p { color: #b7b1a8; }
      input { background: #20242a; color: #f3efe7; border-color: #f3efe7; }
      button { background: #f3efe7; color: #15181d; }
    }
  </style>
</head>
<body>
  <main>
    <h1>Unlock the studio</h1>
    <p>Paste the studio API key. ChatGPT receives a token after this, not the key itself.</p>
    ${message}
    <form method="post" action="/oauth/authorize" autocomplete="off">
      ${hidden}
      <label>API key
        <input name="api_key" type="password" required maxlength="200" autocomplete="current-password" autofocus />
      </label>
      <button type="submit">Continue</button>
    </form>
  </main>
</body>
</html>`;
}
