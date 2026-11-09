import {parse} from 'yaml';

export function readDocument(raw: string, file: string): {data: unknown; body: string} {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(raw);
  const source = match?.[1];
  const whole = match?.[0];
  if (!source || !whole) throw new Error(`${file}: missing frontmatter`);
  return {data: parse(source) as unknown, body: raw.slice(whole.length)};
}
