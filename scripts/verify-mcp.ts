import {
  accessTokenAllows,
  apiKeyMatches,
  authorizationCode,
  canonicalResource,
  consumeAttempt,
  exchangeCode,
  redirectAllowed,
  refreshAccess,
  registerClient,
  s256,
} from '../lib/studio/mcp-auth';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const secret = 'test-studio-key-test-studio-key';
const origin = 'http://localhost:5173';
const resource = `${origin}/studio/mcp`;
const redirectUri = 'https://chatgpt.com/connector_platform_oauth_redirect';

assert(redirectAllowed(redirectUri), 'ChatGPT redirect should be allowed');
assert(!redirectAllowed('http://127.0.0.1:4321/callback'), 'Loopback redirects should be rejected');
assert(!redirectAllowed('http://localhost:5173/callback'), 'Localhost redirects should be rejected');
assert(!redirectAllowed('https://evil.example/steal'), 'An unknown host should be rejected');
assert(!redirectAllowed('javascript:alert(1)'), 'A script redirect should be rejected');
assert(canonicalResource(`${resource}/`, origin) === resource, 'A trailing slash should still name the studio MCP');

let registrationFailed = false;
try {
  await registerClient(secret, ['https://evil.example/steal'], 'nope');
} catch {
  registrationFailed = true;
}
assert(registrationFailed, 'Registration should reject an unknown redirect host');

const verifier = 'a'.repeat(48);
const challenge = await s256(verifier);
const client = await registerClient(secret, [redirectUri], 'verify');
const code = await authorizationCode(secret, {
  clientId: client.client_id,
  redirectUri,
  state: 'state',
  challenge,
  resource,
  scope: 'studio',
});

let rejected = false;
try {
  await exchangeCode(secret, {code, verifier: `${verifier}nope`.slice(0, 50), clientId: client.client_id, redirectUri, resource});
} catch {
  rejected = true;
}
assert(rejected, 'A wrong PKCE verifier should be rejected');

const tokens = await exchangeCode(secret, {code, verifier, clientId: client.client_id, redirectUri, resource});
assert(await accessTokenAllows(tokens.access_token, secret, resource), 'The access token should open the studio');
assert(await accessTokenAllows(secret, secret, resource), 'The raw API key should open the studio');
assert(!(await accessTokenAllows('wrong-key', secret, resource)), 'A wrong API key should be rejected');
assert(!(await accessTokenAllows(tokens.refresh_token, secret, resource)), 'A refresh token should not work as an access token');
assert(!(await apiKeyMatches(secret, 'other-key')), 'Different keys should not match');

const refreshed = await refreshAccess(secret, tokens.refresh_token, resource);
assert(await accessTokenAllows(refreshed.access_token, secret, resource), 'A refreshed token should open the studio');

let foreignClient = false;
try {
  await authorizationCode(secret, {
    clientId: 'https://evil.example/client.json',
    redirectUri: 'https://chatgpt.com/connector_platform_oauth_redirect',
    state: '',
    challenge,
    resource,
    scope: 'studio',
  });
} catch {
  foreignClient = true;
}
assert(foreignClient, 'A client metadata document on an unknown host should be rejected');

const rateKey = `verify-${crypto.randomUUID()}`;
assert(consumeAttempt(rateKey, 2, 60_000, 1_000), 'The first attempt should be allowed');
assert(consumeAttempt(rateKey, 2, 60_000, 1_001), 'The second attempt should be allowed');
assert(!consumeAttempt(rateKey, 2, 60_000, 1_002), 'The third attempt inside the window should be refused');
assert(consumeAttempt(rateKey, 2, 60_000, 61_000), 'An attempt after the window should be allowed');

let localRegistration = false;
try {
  await registerClient(secret, ['http://127.0.0.1:4321/callback'], 'local');
} catch {
  localRegistration = true;
}
assert(localRegistration, 'Client registration should reject a loopback redirect');

console.log('Verified studio MCP key checks, OAuth redirects, PKCE, and token use.');
