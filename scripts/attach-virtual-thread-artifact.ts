import {readFileSync, readdirSync} from 'node:fs';
import {resolve} from 'node:path';

const title = "Java Virtual Threads: More Concurrency Doesn't Mean More Speed";
const root = resolve(import.meta.dirname, '..');
const posts = readdirSync(resolve(root, 'content/posts')).filter((name) => name.endsWith('.md'));
const inGit = posts.some((name) => readFileSync(resolve(root, 'content/posts', name), 'utf8').includes(title));

if (inGit) console.log('The article is in the git catalog. A studio draft is required before the fence can be inserted.');

try {
  const studio = await import('../lib/studio/artifacts');
  const result = await studio.attachVirtualThreadsArtifact();
  console.log(result.reason);
} catch (error) {
  const message = error instanceof Error ? error.message : 'The studio database is unavailable.';
  if (inGit) console.log(`The article is in git, but a draft was not opened. ${message}`);
  else console.log('The live article was not in this database.');
}
