export type WalkDemo = {title: string; steps: string[]};
export type CompareDemo = {title: string; before: string; after: string};

function titled(body: string, fallback: string): {title: string; lines: string[]} {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== '');
  let title = fallback;
  const rest: string[] = [];
  for (const line of lines) {
    const match = /^title:\s*(.+)$/.exec(line);
    if (match?.[1] && title === fallback) title = match[1].trim();
    else rest.push(line);
  }
  return {title, lines: rest};
}

export function parseWalk(body: string): WalkDemo {
  const parsed = titled(body, 'Walkthrough');
  const steps = parsed.lines.flatMap((line) => {
    const step = /^-\s+(.+)$/.exec(line);
    return step?.[1] ? [step[1].trim()] : [];
  });
  return {title: parsed.title, steps};
}

export function parseCompare(body: string): CompareDemo {
  const parsed = titled(body, 'Before and after');
  let before = '';
  let after = '';
  for (const line of parsed.lines) {
    const earlier = /^before:\s*(.+)$/.exec(line);
    const later = /^after:\s*(.+)$/.exec(line);
    if (earlier?.[1]) before = earlier[1].trim();
    if (later?.[1]) after = later[1].trim();
  }
  return {title: parsed.title, before, after};
}

export function formatWalk(title: string, steps: string[]): string {
  const clean = steps.map((step) => step.trim()).filter(Boolean);
  return `\n:::demo{name="walk"}\ntitle: ${title.trim() || 'Walkthrough'}\n${clean.map((step) => `- ${step}`).join('\n')}\n:::\n`;
}

export function formatCompare(title: string, before: string, after: string): string {
  return `\n:::demo{name="compare"}\ntitle: ${title.trim() || 'Before and after'}\nbefore: ${before.trim()}\nafter: ${after.trim()}\n:::\n`;
}

export function formatBucket(): string {
  return '\n:::demo{name="bucket"}\n';
}
