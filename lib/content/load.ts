import {parseSiteSettings, parseTalk, parseWorkCase, type Talk, type WorkCase} from './schema';
import siteFile from '../../content/site.json';

const workFiles = import.meta.glob('../../content/work/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

const talkFiles = import.meta.glob('../../content/talks/*.md', {
  query: '?raw',
  import: 'default',
  eager: true,
});

function textModules(modules: Record<string, unknown>): [string, string][] {
  return Object.keys(modules)
    .sort()
    .map((file) => {
      const raw = modules[file];
      if (typeof raw !== 'string') throw new Error(`${file}: expected raw text`);
      return [file, raw];
    });
}

export const siteSettings = parseSiteSettings(siteFile);

export const workCases: WorkCase[] = textModules(workFiles).map(([file, raw]) => parseWorkCase(raw, file));

export const talks: Talk[] = textModules(talkFiles).map(([file, raw]) => parseTalk(raw, file));

export function getWorkCase(slug: string) {
  return workCases.find((item) => item.slug === slug);
}

export function deliveredTalk() {
  const talk = talks.find((item) => item.status === 'Delivered');
  if (!talk) throw new Error('content/talks: missing a delivered talk');
  return talk;
}
