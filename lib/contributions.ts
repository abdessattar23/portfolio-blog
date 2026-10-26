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
  {
    slug: 'bounded-http-sender',
    number: 8276,
    shortTitle: 'Bounded sender threads',
    topic: 'Java · Concurrency',
    title: 'Putting a limit on sender threads',
    summary: 'Bound the default JdkHttpSender executor and report rejected submissions through the error callback.',
    problem:
      'The default executor allowed up to Integer.MAX_VALUE threads and used a SynchronousQueue. Under burst load, this permitted excessive thread creation.',
    change:
      'The merged diff caps the maximum pool size at Math.max(availableProcessors(), 5) and catches RejectedExecutionException to call onError. The final implementation retains AbortPolicy.',
    verification:
      'Added tests check the pool bound and rejection policy, successful responses, I/O failures, and rejected execution reaching the error callback.',
    boundary:
      'The original proposal mentioned CallerRunsPolicy. The merged implementation uses AbortPolicy. No production performance improvement is claimed here.',
  },
  {
    slug: 'jaeger-interval',
];

export const prUrl = (number: number) =>
  `https://github.com/open-telemetry/opentelemetry-java/pull/${number}`;

export function getContribution(slug: string) {
  return contributions.find((item) => item.slug === slug);
}
