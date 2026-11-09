import {WEB_BOT_PUBLIC_JWK} from './public-key';

export type Ed25519PrivateJwk = {
  kty: 'OKP';
  crv: 'Ed25519';
  x: string;
  d: string;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function base64(bytes: Uint8Array): string {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replaceAll('+', '-').replaceAll('/', '_').replaceAll('=', '');
}

function randomNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return base64(bytes);
}

export function parsePrivateJwk(value: string | undefined): Ed25519PrivateJwk | null {
  if (!value) return null;
  try {
    const parsed: unknown = JSON.parse(value);
    if (!isRecord(parsed)) return null;
    const {kty, crv, x, d} = parsed;
    if (kty !== 'OKP' || crv !== 'Ed25519' || typeof x !== 'string' || typeof d !== 'string') return null;
    return {kty: 'OKP', crv: 'Ed25519', x, d};
  } catch {
    return null;
  }
}

export function usablePrivateJwk(value: string | undefined): Ed25519PrivateJwk | null {
  const parsed = parsePrivateJwk(value);
  if (!parsed || parsed.x !== WEB_BOT_PUBLIC_JWK.x) return null;
  return parsed;
}

export async function jwkThumbprint(x: string): Promise<string> {
  const canonical = JSON.stringify({crv: 'Ed25519', kty: 'OKP', x});
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(canonical));
  return base64Url(new Uint8Array(digest));
}

async function signUtf8(privateJwk: Ed25519PrivateJwk, payload: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'jwk',
    {kty: privateJwk.kty, crv: privateJwk.crv, x: privateJwk.x, d: privateJwk.d},
    {name: 'Ed25519'},
    false,
    ['sign'],
  );
  const signature = await crypto.subtle.sign({name: 'Ed25519'}, key, new TextEncoder().encode(payload));
  return base64(new Uint8Array(signature));
}

export function directoryDocument(): string {
  return JSON.stringify({
    keys: [{kty: WEB_BOT_PUBLIC_JWK.kty, crv: WEB_BOT_PUBLIC_JWK.crv, x: WEB_BOT_PUBLIC_JWK.x}],
  });
}

export async function directorySignatureHeaders(
  authority: string,
  privateJwk: Ed25519PrivateJwk | null,
): Promise<Record<string, string>> {
  if (!privateJwk) return {};
  const created = Math.floor(Date.now() / 1000);
  const expires = created + 60;
  const kid = await jwkThumbprint(privateJwk.x);
  const nonce = randomNonce();
  const params = `("@authority";req);alg="ed25519";keyid="${kid}";nonce="${nonce}";tag="http-message-signatures-directory";created=${created};expires=${expires}`;
  const base = `"@authority";req: ${authority}\n"@signature-params": ${params}\n`;
  const signature = await signUtf8(privateJwk, base);
  return {
    Signature: `sig1=:${signature}:`,
    'Signature-Input': `sig1=${params}`,
  };
}

export async function webBotRequestHeaders(options: {
  authority: string;
  directoryUrl: string;
  privateJwk: Ed25519PrivateJwk;
}): Promise<Record<string, string>> {
  const created = Math.floor(Date.now() / 1000);
  const expires = created + 60;
  const kid = await jwkThumbprint(options.privateJwk.x);
  const nonce = randomNonce();
  const agent = `"${options.directoryUrl}"`;
  const params = `("@authority" "signature-agent");created=${created};keyid="${kid}";alg="ed25519";expires=${expires};nonce="${nonce}";tag="web-bot-auth"`;
  const base = `"@authority": ${options.authority}\n"signature-agent": ${agent}\n"@signature-params": ${params}\n`;
  const signature = await signUtf8(options.privateJwk, base);
  return {
    'Signature-Agent': agent,
    'Signature-Input': `sig1=${params}`,
    Signature: `sig1=:${signature}:`,
  };
}
