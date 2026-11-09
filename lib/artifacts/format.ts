import {parseArtifact, type ArtifactClassification, type ArtifactParse} from './schema';

const FENCE = /^:::artifact\{id="([a-z0-9]+(?:-[a-z0-9]+)*)"\}\s*$/;

export function matchArtifactFence(line: string): string | null {
  return FENCE.exec(line.trim())?.[1] ?? null;
}

export function artifactFence(id: string): string {
  return `\n:::artifact{id="${id}"}\n`;
}

export function artifactIdsInMarkdown(markdown: string): string[] {
  const ids: string[] = [];
  let inFence = false;
  for (const line of markdown.split(/\r?\n/)) {
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const id = matchArtifactFence(line);
    if (id) ids.push(id);
  }
  return ids;
}

export function referencesArtifact(markdown: string, id: string): boolean {
  return artifactIdsInMarkdown(markdown).includes(id);
}

export function appendArtifactFence(markdown: string, id: string): string {
  if (referencesArtifact(markdown, id)) return markdown;
  const base = markdown.replace(/\s*$/, '');
  return `${base}\n\n:::artifact{id="${id}"}\n`;
}

export type ArtifactPreview = {
  valid: boolean;
  title: string;
  fallback: string;
  markdown: string;
  errors: string[];
  id?: string;
  classification?: ArtifactClassification;
  view?: string;
};

export function previewFromParse(parsed: ArtifactParse): ArtifactPreview {
  if (!parsed.ok) {
    return {valid: false, title: parsed.title, fallback: parsed.summary, markdown: '', errors: parsed.errors};
  }
  return {
    valid: true,
    title: parsed.artifact.title,
    fallback: parsed.artifact.summary,
    markdown: artifactFence(parsed.artifact.id).trim(),
    errors: [],
    id: parsed.artifact.id,
    classification: parsed.artifact.classification,
    view: parsed.artifact.view.type,
  };
}

export function previewArtifact(input: unknown): ArtifactPreview {
  return previewFromParse(parseArtifact(input));
}
