---
slug: pooled-hashmap
title: Why walking a bucket backwards can keep a metric alive
seoTitle: "Fixing skipped metrics in OpenTelemetry Java’s PooledHashMap"
description: "How forward iteration skipped entries in OpenTelemetry Java’s PooledHashMap, and why reversing the traversal fixed it."
excerpt: Removal, shifting indices, and the regression test that makes a subtle
  collection bug visible. A technical note based on OpenTelemetry Java PR
publishedAt: 2026-11-08
updatedAt: 2026-11-09
topics:
  - Java
  - Collections
template: deep-dive
draft: false
homeDiff:
  removed: forward iteration
  added: backward iteration
stickers:
  - bug
---

A loop can visit every index and still miss an entry. The catch is that an index does not keep pointing at the same object when the collection changes underneath it.

## The mechanism {#mechanism}

In OpenTelemetry Java's PooledHashMap, each hash bucket is backed by an ArrayList. The original forEach implementation walked a bucket from index zero upwards and invoked the supplied action for each entry.

That action can remove the entry being visited. Removing an item from an ArrayList shifts later items one position to the left. If the loop then increments its index, it moves past the entry that just shifted into the current position.

This mattered in AsynchronousMetricStorage using REUSABLE_DATA. Collection removes stale series while iterating. A live series in the same bucket as a removed stale series could be skipped in that collection cycle. The PR describes a gap followed by a jump for cumulative asynchronous metrics.

## Two entries are enough {#example}

Suppose a bucket contains stale entry A followed by live entry B. The example below isolates the index movement. It is an illustration of the algorithm, not a running OpenTelemetry SDK.

:::demo{name="bucket"}

## Change the traversal direction {#fix}

The merged fix walks each bucket backwards. When the callback removes the current entry, the entries that shift have already been visited. The next lower index still points at the next unvisited entry.

```java
for (int i = bucket.size() - 1; i >= 0; i--) {
  Entry<K, V> entry = bucket.get(i);
  action.accept(entry.key, entry.value);
}
```

This is a narrow guarantee: the callback can remove the entry it is currently visiting. It does not establish that arbitrary mutation, adding entries, or concurrent access is safe. Reversing a loop is not a general-purpose solution to collection mutation.

## Test the collision, then the consequence {#tests}

The map-level regression test uses two distinct keys with the same hash code. That forces them into the same bucket, independently of the map's capacity. During iteration, the callback removes the first entry it visits. The assertion checks that both keys were visited and that one entry remains.

The storage-level test exercises the consequence rather than only the loop. A first collection reports a set of series. On the next collection, only the even-numbered series report; the others become stale. The test checks that the collected attributes contain exactly the expected live series.

These tests answer different questions. One establishes that removing the current colliding entry does not skip another entry. The other checks that the metric storage path preserves live series when stale ones are removed.

:::note
A debugging question to keep
When data disappears during cleanup, inspect whether cleanup changes the collection that the traversal is still using.
:::

## Source and scope {#source}

This note is based on the public description, merged diff, and regression tests in [OpenTelemetry Java PR #8499](https://github.com/open-telemetry/opentelemetry-java/pull/8499), contributed by abdessattar23. The affected behavior described here is the reusable-data path; the PR identifies the immutable-data path, which uses ConcurrentHashMap, as unaffected.

No production incident, benchmark result, or permanent data-loss claim is implied.

[View the contribution record](/work/pooled-hashmap)
