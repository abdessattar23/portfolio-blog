import {readFileSync} from 'node:fs';

const source = readFileSync('dist/server/index.js', 'utf8');
for (const needle of ['Signature-Input', 'WEB_BOT_AUTH_PRIVATE_JWK']) {
  let from = 0;
  let count = 0;
  while (count < 2) {
    const at = source.indexOf(needle, from);
    if (at < 0) break;
    count += 1;
    console.log(`--- ${needle} @${at} ---`);
    console.log(source.slice(at - 220, at + 280));
    from = at + needle.length;
  }
  if (count === 0) console.log(`missing ${needle}`);
}
