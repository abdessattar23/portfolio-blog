import {createHash, generateKeyPairSync} from 'node:crypto';
import {existsSync, readFileSync, writeFileSync} from 'node:fs';

const {publicKey, privateKey} = generateKeyPairSync('ed25519');
const pub = publicKey.export({format: 'jwk'});
const priv = privateKey.export({format: 'jwk'});
if (pub.kty !== 'OKP' || pub.crv !== 'Ed25519' || !pub.x || !priv.d || priv.x !== pub.x) {
  throw new Error('unexpected jwk');
}

const canonical = JSON.stringify({crv: 'Ed25519', kty: 'OKP', x: pub.x});
const thumb = createHash('sha256').update(canonical).digest('base64url');
const keyFile = `export const WEB_BOT_PUBLIC_JWK = {
  kty: 'OKP',
  crv: 'Ed25519',
  x: '${pub.x}',
} as const;
`;
writeFileSync('lib/agent/public-key.ts', keyFile);

const line = `WEB_BOT_AUTH_PRIVATE_JWK=${JSON.stringify({kty: 'OKP', crv: 'Ed25519', x: priv.x, d: priv.d})}`;
if (existsSync('.env')) {
  const current = readFileSync('.env', 'utf8');
  if (!current.includes('WEB_BOT_AUTH_PRIVATE_JWK=')) {
    const suffix = current.endsWith('\n') || current.length === 0 ? '' : '\n';
    writeFileSync('.env', `${current}${suffix}${line}\n`);
    console.log('env=appended');
  } else {
    console.log('env=exists');
  }
} else {
  console.log('env=missing');
}
console.log(`public_x_length=${pub.x.length}`);
console.log(`thumb_length=${thumb.length}`);
