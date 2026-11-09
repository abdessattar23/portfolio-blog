import {parseArtifact, type ArtifactDocument} from './schema';

const modules = import.meta.glob('../../content/artifacts/*.json', {eager: true});

function unwrap(mod: unknown): unknown {
  if (typeof mod === 'object' && mod !== null && 'default' in mod) return (mod as {default: unknown}).default;
  return mod;
}

function records(): unknown[] {
  return Object.values(modules).map((mod) => unwrap(mod));
}

export function gitArtifacts(): ArtifactDocument[] {
  return records().map((record) => {
    const parsed = parseArtifact(record);
    if (!parsed.ok) throw new Error(`content/artifacts: ${parsed.errors.join(' ')}`);
    return parsed.artifact;
  });
}
