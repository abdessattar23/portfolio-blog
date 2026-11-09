export function titlesMatch(left: string, right: string): boolean {
  const normalize = (value: string) => value.trim().toLowerCase().replace(/[.。]\s*$/, '');
  const first = normalize(left);
  const second = normalize(right);
  return first !== '' && first === second;
}

export function stripDuplicateTitle(markdown: string, title = ''): string {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  let seenH2 = false;
  const kept: string[] = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (/^(`{3,}|~{3,})/.test(trimmed)) {
      inFence = !inFence;
      kept.push(line);
      continue;
    }
    if (inFence) {
      kept.push(line);
      continue;
    }
    if (/^#\s+/.test(trimmed) && !/^##/.test(trimmed)) continue;
    if (!seenH2 && /^##\s+/.test(trimmed) && !/^###/.test(trimmed)) {
      seenH2 = true;
      const text = trimmed.replace(/^##\s+/, '').replace(/\s*\{#[a-z0-9-]+\}\s*$/, '');
      if (titlesMatch(text, title)) continue;
    }
    kept.push(line);
  }
  return kept.join('\n');
}

export function isDuplicateOpeningSection(sections: {title: string}[], index: number, title: string): boolean {
  if (index !== 0) return false;
  const first = sections[0];
  return first !== undefined && titlesMatch(first.title, title);
}
