export type Contribution = {
  slug: string;
  number: number;
  shortTitle: string;
  topic: string;
  title: string;
  summary: string;
  problem: string;
  change: string;
  verification: string;
  boundary: string;
  noteSlug?: string;
};

export const contributions: Contribution[] = [
  {
    slug: 'pooled-hashmap',
    number: 8499,
    shortTitle: 'Collection iteration',
    topic: 'Metrics · Collections',
    title: 'When removing one entry skips another',
    summary: 'A bucket iteration bug in PooledHashMap could skip live metric series during collection.',
    problem:
      'PooledHashMap walked each bucket by increasing index. When a callback removed its current entry, the next entry shifted into that same slot. Incrementing the index then skipped it.',
    change:
      'The merged change walks each bucket back-to-front. Removing the current entry shifts only entries that have already been visited.',
    verification:
      'Regression tests cover colliding keys and removal during iteration, plus metric storage collecting live series while stale series are removed.',
    boundary:
      'This concerns the reusable-data path. It is not evidence that all metric collection modes were affected, or that data was permanently lost.',
    noteSlug: 'pooled-hashmap',
  },
];

export const prUrl = (number: number) =>
  `https://github.com/open-telemetry/opentelemetry-java/pull/${number}`;

export function getContribution(slug: string) {
  return contributions.find((item) => item.slug === slug);
}
