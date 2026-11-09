import {readDatabase} from '../studio/db';
import {artifactIdsInMarkdown} from './format';
import {gitArtifacts} from './git';
import {parseArtifact, type ArtifactDocument} from './schema';

type ArtifactRow = {id: string; document: string};

async function overlayMap(): Promise<Map<string, ArtifactDocument>> {
  const map = new Map<string, ArtifactDocument>();
  const db = readDatabase();
  if (!db) return map;
  try {
    const rows = await db.prepare('select id, document from artifacts').all<ArtifactRow>();
    for (const row of rows.results) {
      try {
        const parsed = parseArtifact(JSON.parse(row.document));
        if (parsed.ok && parsed.artifact.id === row.id) map.set(row.id, parsed.artifact);
      } catch {
        // Skip a row that is not artifact JSON.
      }
    }
  } catch {
    // The table is created on the next studio write.
  }
  return map;
}

export async function mergedArtifacts(): Promise<ArtifactDocument[]> {
  const map = new Map<string, ArtifactDocument>(gitArtifacts().map((artifact) => [artifact.id, artifact]));
  for (const [id, artifact] of await overlayMap()) map.set(id, artifact);
  return [...map.values()].sort((left, right) => left.id.localeCompare(right.id));
}

export async function artifactsForMarkdown(markdown: string): Promise<ArtifactDocument[]> {
  const wanted = new Set(artifactIdsInMarkdown(markdown));
  if (wanted.size === 0) return [];
  const merged = await mergedArtifacts();
  return merged.filter((artifact) => wanted.has(artifact.id));
}

export async function readMergedArtifact(id: string): Promise<ArtifactDocument | null> {
  const overlay = await overlayMap();
  return overlay.get(id) ?? gitArtifacts().find((artifact) => artifact.id === id) ?? null;
}

export async function studioArtifactIds(): Promise<Set<string>> {
  return new Set((await overlayMap()).keys());
}
