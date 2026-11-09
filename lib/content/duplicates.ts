import type {PostDocument} from './schema';

export type DuplicateReport = {
  blocked: boolean;
  warnings: string[];
};

function tokens(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .split(/[^a-z0-9]+/)
      .filter((word) => word.length > 2),
  );
}

function similarity(left: string, right: string): number {
  const first = tokens(left);
  const second = tokens(right);
  if (first.size === 0 || second.size === 0) return 0;
  let shared = 0;
  for (const word of first) {
    if (second.has(word)) shared += 1;
  }
  const union = first.size + second.size - shared;
  return union === 0 ? 0 : shared / union;
}

export function findDuplicates(
  draft: Pick<PostDocument, 'slug' | 'title' | 'description'>,
  existing: Pick<PostDocument, 'slug' | 'title' | 'description'>[],
): DuplicateReport {
  const warnings: string[] = [];
  let blocked = false;
  for (const post of existing) {
    if (post.slug === draft.slug) {
      blocked = true;
      continue;
    }
    if (similarity(draft.title, post.title) >= 0.6) warnings.push(`Title is close to “${post.title}”.`);
    if (similarity(draft.description, post.description) >= 0.6) {
      warnings.push(`Description is close to “${post.title}”.`);
    }
  }
  return {blocked, warnings};
}
