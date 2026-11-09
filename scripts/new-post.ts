import {existsSync, writeFileSync} from 'node:fs';
import {createInterface} from 'node:readline/promises';
import {stdin as input, stdout as output} from 'node:process';
import {resolve} from 'node:path';
import {POST_TEMPLATES, type PostTemplate} from '../lib/content/schema';

const SKELETONS: Record<PostTemplate, string> = {
  'deep-dive': `State the concrete problem in one paragraph.

## The mechanism {#mechanism}

Explain what the code actually does, close to the source.
`,
  'bug-story': `State the bug in one paragraph.

## The problem {#problem}

What broke, and where.

## The change {#change}

What the merged diff does.

## The tests {#tests}

What the regression tests prove.

## Scope {#scope}

What this note does not claim.
`,
  til: `One thing I learned, in a few paragraphs. Keep it specific.
`,
  'talk-notes': `Who the talk was for, and the one idea I wanted them to leave with.

## What I said {#said}

The argument, without the slides.

## What I would add {#add}

What the room changed.
`,
};

function isTemplate(value: string): value is PostTemplate {
  return (POST_TEMPLATES as readonly string[]).includes(value);
}

const args = process.argv.slice(2);
const maybeTemplate = args.at(-1);
const templateFromArgs = maybeTemplate !== undefined && isTemplate(maybeTemplate) ? maybeTemplate : undefined;
const title = (templateFromArgs ? args.slice(0, -1) : args).join(' ').trim();

if (!title) {
  console.error('Usage: npm run new:post -- "Your article title" [deep-dive|bug-story|til|talk-notes]');
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

const postPath = resolve('content', 'posts', `${slug}.md`);
if (existsSync(postPath)) {
  console.error(`A post already exists at content/posts/${slug}.md`);
  process.exit(1);
}

const template = templateFromArgs ?? await chooseTemplate();
const today = new Date().toISOString().slice(0, 10);
const escapedTitle = title.replaceAll('"', '\\"');
const document = `---
slug: ${slug}
title: "${escapedTitle}"
description: TODO
excerpt: TODO
publishedAt: ${today}
updatedAt: ${today}
topics:
  - Java
template: ${template}
draft: true
---

${SKELETONS[template]}`;

writeFileSync(postPath, document);
console.log(`Created draft: content/posts/${slug}.md`);
console.log('Replace every TODO, then set draft: false to publish it.');

async function chooseTemplate(): Promise<PostTemplate> {
  const prompt = createInterface({input, output});
  try {
    const answer = (await prompt.question(`Template (${POST_TEMPLATES.join(', ')}): `)).trim();
    if (!isTemplate(answer)) {
      console.error(`Choose one of: ${POST_TEMPLATES.join(', ')}`);
      process.exit(1);
    }
    return answer;
  } finally {
    prompt.close();
  }
}
