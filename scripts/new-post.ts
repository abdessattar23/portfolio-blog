import {existsSync, readFileSync, writeFileSync} from 'node:fs';
import {resolve} from 'node:path';

const capitalize = (word: string): string =>
  word.charAt(0).toUpperCase() + word.slice(1);

const title = process.argv.slice(2).join(' ').trim();
if (!title) {
  console.error('Usage: npm run new:post -- "Your article title"');
  process.exit(1);
}

const slug = title
  .normalize('NFKD')
  .toLowerCase()
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');

if (!slug) {
  console.error('The title must contain at least one letter or number.');
  process.exit(1);
}

const [firstWord = 'post', ...restWords] = slug.split('-');
const exportName = `${firstWord}${restWords.map(capitalize).join('')}Post`;
const componentName = [firstWord, ...restWords].map(capitalize).join('');
const postPath = resolve('content', 'posts', `${slug}.tsx`);
const registryPath = resolve('content', 'posts', 'index.ts');
const templatePath = resolve('templates', 'blog-post.tsx.txt');

if (existsSync(postPath)) {
  console.error(`A post already exists at content/posts/${slug}.tsx`);
  process.exit(1);
}

const escapedTitle = title.replaceAll('\\', '\\\\').replaceAll("'", "\\'");
const post = readFileSync(templatePath, 'utf8')
  .replaceAll('__SLUG__', slug)
  .replaceAll('__TITLE__', escapedTitle)
  .replaceAll('__DATE__', new Date().toISOString().slice(0, 10))
  .replaceAll('__EXPORT_NAME__', exportName)
  .replaceAll('__COMPONENT_NAME__', componentName);

const registry = readFileSync(registryPath, 'utf8')
  .replace('// new-post-import', `import {${exportName}} from './${slug}';\n// new-post-import`)
  .replace('  // new-post-entry', `  ${exportName},\n  // new-post-entry`);

writeFileSync(postPath, post);
writeFileSync(registryPath, registry);

console.log(`Created draft: content/posts/${slug}.tsx`);
console.log('Write the article, replace every TODO, then set draft: false to publish it.');
