import {studioEnv} from './db';
import {
  accessTokenAllows,
  apiKeyMatches,
  authorizationCode,
  authorizationServerMetadata,
  authorizePage,
  bearerToken,
  canonicalResource,
  exchangeCode,
  protectedResourceMetadata,
  consumeAttempt,
  redirectAllowed,
  refreshAccess,
  registerClient,
  studioResource,
  type AuthorizationRequest,
} from './mcp-auth';
import {callStudioTool, STUDIO_TOOLS} from './mcp-tools';

const INSTRUCTIONS = [
  'Private studio for Mohammed Elyagoubi at abdessattar.dev.',
  'Employer is Sofrecom (Orange Group) at sofrecom.com. Orange Group is the parent and has no URL. Never use orange.com.',
  'Search and read before writing. Drafts stay private until publish_draft.',
  'Call publish_draft, unpublish_post, delete_draft, or delete_artifact only when he explicitly asks, with confirm true.',
  'Artifacts are versioned JSON descriptions, never executable code. A conceptual simulation is not a measurement. create_artifact, update_artifact, and attach_artifact do not publish.',
  'A new talk needs a title. Leave slug empty unless he wants a specific URL.',
  'The public /mcp server is read-only.',
].join(' ');

const PATHS = new Set([
  '/studio/mcp',
  '/oauth/authorize',
  '/oauth/token',
  '/oauth/register',
  '/.well-known/oauth-protected-resource',
  '/.well-known/oauth-protected-resource/studio/mcp',
  '/.well-known/oauth-authorization-server',
]);

function pathOf(url: URL): string {
  return url.pathname.length > 1 && url.pathname.endsWith('/') ? url.pathname.slice(0, -1) : url.pathname;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function cors(extra?: HeadersInit): Headers {
  const headers = new Headers(extra);
  headers.set('Access-Control-Allow-Origin', '*');
  headers.set('Access-Control-Allow-Headers', 'Authorization, Content-Type, MCP-Protocol-Version, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
  headers.set('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  headers.set('Access-Control-Expose-Headers', 'Mcp-Session-Id, WWW-Authenticate');
  headers.set('Cache-Control', 'no-store');
  return headers;
}

function json(body: unknown, status: number, extra?: HeadersInit): Response {
  const headers = cors(extra);
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), {status, headers});
}

function html(body: string, status = 200): Response {
  const headers = cors();
  headers.set('Content-Type', 'text/html; charset=utf-8');
  headers.set('Content-Security-Policy', "default-src 'none'; style-src 'unsafe-inline'; form-action 'self'; base-uri 'none'");
  headers.set('Referrer-Policy', 'no-referrer');
  headers.set('X-Robots-Tag', 'noindex');
  return new Response(body, {status, headers});
}

function challenge(origin: string, status = 401): Response {
  const metadata = `${origin}/.well-known/oauth-protected-resource`;
  return json(
    {error: 'unauthorized', error_description: 'Send the studio API key, or sign in through OAuth.'},
    status,
    {'WWW-Authenticate': `Bearer realm="studio", resource_metadata="${metadata}", scope="studio"`},
  );
}

function keyOr503(): string | Response {
  const key = studioEnv().STUDIO_MCP_KEY?.trim() ?? '';
  if (!key) return json({error: 'server_error', error_description: 'STUDIO_MCP_KEY is not configured.'}, 503);
  return key;
}

function clientAddress(request: Request): string {
  return request.headers.get('CF-Connecting-IP')?.trim() || 'unknown';
}

async function submissionAllowed(request: Request, action: 'authorize' | 'token'): Promise<boolean> {
  const bucket = `${action}:${clientAddress(request)}`;
  const limit = action === 'authorize' ? 5 : 20;
  const binding = action === 'authorize' ? studioEnv().AUTH_RATE_LIMIT : studioEnv().TOKEN_RATE_LIMIT;
  if (binding) {
    try {
      const result = await binding.limit({key: bucket});
      return result.success;
    } catch {
      return consumeAttempt(bucket, limit, 60_000);
    }
  }
  return consumeAttempt(bucket, limit, 60_000);
}

function tooMany(page?: string): Response {
  const response = page
    ? html(page, 429)
    : json({error: 'slow_down', error_description: 'Too many sign-in attempts. Wait a minute and try again.'}, 429);
  response.headers.set('Retry-After', '60');
  return response;
}

const lockedPage = () => authorizePage(
  {clientId: '', redirectUri: '', state: '', challenge: '', resource: '', scope: 'studio'},
  'Too many attempts. Wait a minute and try again.',
);

function formValue(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === 'string' ? value : '';
}

function authorizationFrom(source: {get(name: string): string | null}, origin: string): AuthorizationRequest | {error: string} {
  const redirectUri = source.get('redirect_uri') ?? '';
  if (!redirectAllowed(redirectUri)) return {error: 'That redirect URL is not allowed.'};
  const challengeValue = source.get('code_challenge') ?? '';
  if ((source.get('code_challenge_method') ?? 'S256') !== 'S256' || !challengeValue) return {error: 'PKCE S256 is required.'};
  return {
    clientId: source.get('client_id') ?? '',
    redirectUri,
    state: source.get('state') ?? '',
    challenge: challengeValue,
    resource: canonicalResource(source.get('resource') ?? '', origin),
    scope: source.get('scope') || 'studio',
  };
}

async function readFormBody(request: Request): Promise<Record<string, string>> {
  const type = request.headers.get('content-type') ?? '';
  if (type.includes('application/json')) {
    const payload: unknown = await request.json();
    if (!isRecord(payload)) return {};
    const record: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload)) {
      if (typeof value === 'string') record[key] = value;
    }
    return record;
  }
  const form = await request.formData();
  return {
    grant_type: formValue(form, 'grant_type'),
    code: formValue(form, 'code'),
    code_verifier: formValue(form, 'code_verifier'),
    client_id: formValue(form, 'client_id'),
    redirect_uri: formValue(form, 'redirect_uri'),
    refresh_token: formValue(form, 'refresh_token'),
    resource: formValue(form, 'resource'),
  };
}

function wantsSse(accept: string | null): boolean {
  if (!accept) return false;
  const types = accept.split(',').map((part) => part.split(';')[0]?.trim().toLowerCase() ?? '');
  return types.includes('text/event-stream') && !types.includes('application/json') && !types.includes('*/*');
}

function rpc(accept: string | null, payload: unknown, status = 200): Response {
  const headers = cors();
  if (wantsSse(accept)) {
    headers.set('Content-Type', 'text/event-stream');
    return new Response(`event: message\ndata: ${JSON.stringify(payload)}\n\n`, {status, headers});
  }
  headers.set('Content-Type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(payload), {status, headers});
}

async function handleMcp(request: Request, origin: string, secret: string): Promise<Response> {
  const token = bearerToken(request);
  if (!(await accessTokenAllows(token, secret, studioResource(origin)))) return challenge(origin);
  if (request.method === 'DELETE') return new Response(null, {status: 204, headers: cors()});
  if (request.method !== 'POST') return json({error: 'method_not_allowed'}, 405, {Allow: 'POST, DELETE, OPTIONS'});

  const accept = request.headers.get('Accept');
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return rpc(accept, {jsonrpc: '2.0', id: null, error: {code: -32700, message: 'Parse error'}}, 400);
  }
  if (Array.isArray(payload) || !isRecord(payload) || typeof payload.method !== 'string') {
    return rpc(accept, {jsonrpc: '2.0', id: null, error: {code: -32600, message: 'Invalid request'}}, 400);
  }
  const id = payload.id ?? null;
  const hasId = Object.prototype.hasOwnProperty.call(payload, 'id');
  if (!hasId) return new Response(null, {status: 202, headers: cors()});
  const params = isRecord(payload.params) ? payload.params : {};

  if (payload.method === 'initialize') {
    const requested = typeof params.protocolVersion === 'string' ? params.protocolVersion : '2025-06-18';
    const protocolVersion = ['2025-06-18', '2025-03-26', '2024-11-05'].includes(requested) ? requested : '2025-06-18';
    return rpc(accept, {
      jsonrpc: '2.0',
      id,
      result: {
        protocolVersion,
        capabilities: {tools: {listChanged: false}},
        serverInfo: {name: 'abdessattar-studio', version: '1.0.0'},
        instructions: INSTRUCTIONS,
      },
    });
  }
  if (payload.method === 'ping' || payload.method === 'logging/setLevel') return rpc(accept, {jsonrpc: '2.0', id, result: {}});
  if (payload.method === 'tools/list') {
    return rpc(accept, {
      jsonrpc: '2.0',
      id,
      result: {
        tools: STUDIO_TOOLS.map((item) => ({
          name: item.name,
          title: item.title,
          description: item.description,
          inputSchema: item.inputSchema,
          annotations: item.annotations,
        })),
      },
    });
  }
  if (payload.method === 'tools/call') {
    const name = typeof params.name === 'string' ? params.name : '';
    const args = isRecord(params.arguments) ? params.arguments : {};
    try {
      const text = await callStudioTool(name, args, origin);
      return rpc(accept, {jsonrpc: '2.0', id, result: {content: [{type: 'text', text}], isError: false}});
    } catch (error) {
      const text = error instanceof Error ? error.message : 'The studio could not do that.';
      return rpc(accept, {jsonrpc: '2.0', id, result: {content: [{type: 'text', text}], isError: true}});
    }
  }
  return rpc(accept, {jsonrpc: '2.0', id, error: {code: -32601, message: 'Method not found'}});
}

export async function studioMcpResponse(request: Request): Promise<Response | null> {
  const url = new URL(request.url);
  const path = pathOf(url);
  if (!PATHS.has(path)) return null;
  const origin = url.origin;
  if (request.method === 'OPTIONS') return new Response(null, {status: 204, headers: cors()});

  if (path === '/.well-known/oauth-protected-resource' || path === '/.well-known/oauth-protected-resource/studio/mcp') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({error: 'method_not_allowed'}, 405);
    return json(protectedResourceMetadata(origin), 200);
  }
  if (path === '/.well-known/oauth-authorization-server') {
    if (request.method !== 'GET' && request.method !== 'HEAD') return json({error: 'method_not_allowed'}, 405);
    return json(authorizationServerMetadata(origin), 200);
  }

  const secret = keyOr503();
  if (secret instanceof Response) return secret;

  if (path === '/studio/mcp') return handleMcp(request, origin, secret);

  if (path === '/oauth/register') {
    if (request.method !== 'POST') return json({error: 'method_not_allowed'}, 405);
    let payload: unknown;
    try {
      payload = await request.json();
    } catch {
      return json({error: 'invalid_client_metadata'}, 400);
    }
    if (!isRecord(payload) || !Array.isArray(payload.redirect_uris)) return json({error: 'invalid_client_metadata'}, 400);
    const uris = payload.redirect_uris.filter((item): item is string => typeof item === 'string');
    try {
      const client = await registerClient(secret, uris, typeof payload.client_name === 'string' ? payload.client_name : 'ChatGPT');
      return json({
        ...client,
        client_id_issued_at: Math.floor(Date.now() / 1000),
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }, 201);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Registration failed.';
      return json({error: 'invalid_client_metadata', error_description: description}, 400);
    }
  }

  if (path === '/oauth/authorize') {
    if (request.method === 'GET') {
      const parsed = authorizationFrom(url.searchParams, origin);
      if ('error' in parsed) return html(authorizePage({clientId: '', redirectUri: '', state: '', challenge: '', resource: studioResource(origin), scope: 'studio'}, parsed.error), 400);
      return html(authorizePage(parsed));
    }
    if (request.method !== 'POST') return json({error: 'method_not_allowed'}, 405);
    if (!(await submissionAllowed(request, 'authorize'))) return tooMany(lockedPage());
    const form = await request.formData();
    const parsed = authorizationFrom({get: (name) => formValue(form, name) || null}, origin);
    if ('error' in parsed) return html(authorizePage({clientId: '', redirectUri: '', state: '', challenge: '', resource: studioResource(origin), scope: 'studio'}, parsed.error), 400);
    if (!(await apiKeyMatches(formValue(form, 'api_key'), secret))) return html(authorizePage(parsed, 'That API key does not match.'), 401);
    try {
      const code = await authorizationCode(secret, parsed);
      const target = new URL(parsed.redirectUri);
      target.searchParams.set('code', code);
      if (parsed.state) target.searchParams.set('state', parsed.state);
      target.searchParams.set('iss', origin);
      return Response.redirect(target, 302);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Sign-in failed.';
      return html(authorizePage(parsed, message), 400);
    }
  }

  if (path === '/oauth/token') {
    if (request.method !== 'POST') return json({error: 'method_not_allowed'}, 405);
    if (!(await submissionAllowed(request, 'token'))) return tooMany();
    const body = await readFormBody(request);
    try {
      const tokens = body.grant_type === 'refresh_token'
        ? await refreshAccess(secret, body.refresh_token ?? '', canonicalResource(body.resource ?? '', origin))
        : await exchangeCode(secret, {
          code: body.code ?? '',
          verifier: body.code_verifier ?? '',
          clientId: body.client_id ?? '',
          redirectUri: body.redirect_uri ?? '',
          resource: canonicalResource(body.resource ?? '', origin),
        });
      return json({token_type: 'Bearer', ...tokens}, 200);
    } catch (error) {
      const description = error instanceof Error ? error.message : 'Token request failed.';
      return json({error: 'invalid_grant', error_description: description}, 400);
    }
  }

  return null;
}
