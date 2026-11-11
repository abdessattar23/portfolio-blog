---
slug: bounded-http-sender
number: 8276
shortTitle: Bounded sender threads
topic: Java · Concurrency
title: Putting a limit on sender threads
summary: Bound the default JdkHttpSender executor and report rejected submissions through the error callback.
problem: |
  The default executor allowed up to Integer.MAX_VALUE threads and used a SynchronousQueue. Under burst load, this permitted excessive thread creation.
change: |
  The merged diff caps the maximum pool size at Math.max(availableProcessors(), 5) and catches RejectedExecutionException to call onError. The final implementation retains AbortPolicy.
verification: |
  Added tests check the pool bound and rejection policy, successful responses, I/O failures, and rejected execution reaching the error callback.
boundary: |
  The original proposal mentioned CallerRunsPolicy. The merged implementation uses AbortPolicy. No production performance improvement is claimed here.
noteSlug: how-http-client-creates-too-many-threads
---
