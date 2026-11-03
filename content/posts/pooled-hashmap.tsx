import BucketDemo from '../../components/bucket-demo';
import {prUrl} from '../../lib/contributions';
import type {BlogPost} from './types';

function PooledHashMapContent() {
  return <>
    <p className="lead">A loop can visit every index and still miss an entry. The catch is that an index does not keep pointing at the same object when the collection changes underneath it.</p>
    <h2 id="mechanism">The mechanism</h2>
    <p>In OpenTelemetry Java’s PooledHashMap, each hash bucket is backed by an ArrayList. The original forEach implementation walked a bucket from index zero upwards and invoked the supplied action for each entry.</p>
    <p>That action can remove the entry being visited. Removing an item from an ArrayList shifts later items one position to the left. If the loop then increments its index, it moves past the entry that just shifted into the current position.</p>
    <p>This mattered in AsynchronousMetricStorage using REUSABLE_DATA. Collection removes stale series while iterating. A live series in the same bucket as a removed stale series could be skipped in that collection cycle. The PR describes a gap followed by a jump for cumulative asynchronous metrics.</p>
    <h2 id="example">Two entries are enough</h2>
    <p>Suppose a bucket contains stale entry A followed by live entry B. The example below isolates the index movement. It is an illustration of the algorithm, not a running OpenTelemetry SDK.</p>
    <BucketDemo />
    <h2 id="fix">Change the traversal direction</h2>
    <p>The merged fix walks each bucket backwards. When the callback removes the current entry, the entries that shift have already been visited. The next lower index still points at the next unvisited entry.</p>
    <pre><code>{`for (int i = bucket.size() - 1; i >= 0; i--) {\n  Entry<K, V> entry = bucket.get(i);\n  action.accept(entry.key, entry.value);\n}`}</code></pre>
    <p>This is a narrow guarantee: the callback can remove the entry it is currently visiting. It does not establish that arbitrary mutation, adding entries, or concurrent access is safe. Reversing a loop is not a general-purpose solution to collection mutation.</p>
    <h2 id="tests">Test the collision, then the consequence</h2>
    <p>The map-level regression test uses two distinct keys with the same hash code. That forces them into the same bucket, independently of the map’s capacity. During iteration, the callback removes the first entry it visits. The assertion checks that both keys were visited and that one entry remains.</p>
    <p>The storage-level test exercises the consequence rather than only the loop. A first collection reports a set of series. On the next collection, only the even-numbered series report; the others become stale. The test checks that the collected attributes contain exactly the expected live series.</p>
    <p>These tests answer different questions. One establishes that removing the current colliding entry does not skip another entry. The other checks that the metric storage path preserves live series when stale ones are removed.</p>
    <div className="note"><h3>A debugging question to keep</h3><p>When data disappears during cleanup, inspect whether cleanup changes the collection that the traversal is still using.</p></div>
    <h2 id="source">Source and scope</h2>
    <p>This note is based on the public description, merged diff, and regression tests in <a href={prUrl(8499)}>OpenTelemetry Java PR #8499</a>, contributed by abdessattar23. The affected behavior described here is the reusable-data path; the PR identifies the immutable-data path, which uses ConcurrentHashMap, as unaffected.</p>
    <p>No production incident, benchmark result, or permanent data-loss claim is implied.</p>
    <a className="text-link" href="/work/pooled-hashmap">View the contribution record ↗</a>
  </>;
}

export const pooledHashMapPost: BlogPost = {
  slug: 'pooled-hashmap',
  title: 'Why walking a bucket backwards can keep a metric alive',
  description: 'A technical note on removal during iteration, based on the merged OpenTelemetry Java contribution #8499.',
  excerpt: 'Removal, shifting indices, and the regression test that makes a subtle collection bug visible. A technical note based on OpenTelemetry Java PR #8499.',
  publishedAt: '2026-11-08',
  topics: ['Java', 'Collections'],
  sections: [
    {id: 'mechanism', title: 'The mechanism'},
    {id: 'example', title: 'Walk the bucket'},
    {id: 'fix', title: 'The fix'},
    {id: 'tests', title: 'The regression tests'},
    {id: 'source', title: 'Source & scope'},
  ],
  homeDiff: {removed: 'forward iteration', added: 'backward iteration'},
  draft: true,
  Content: PooledHashMapContent,
};
