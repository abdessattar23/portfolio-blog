---
slug: how-http-client-creates-too-many-threads
title: How an HTTP Client Can Create Too Many Threads
description: An unbounded executor in OpenTelemetry Java could create too many
  platform threads. Here's how it worked, how we bounded it, and why limits
  still matter.
excerpt: A thread pool isn't necessarily bounded. Here's what I found inside
  OpenTelemetry's JDK HTTP sender and how the fix works.
publishedAt: 2026-11-11
updatedAt: 2026-11-11
topics:
  - Java
  - Concurrency
  - OpenTelemetry
  - Performance
template: deep-dive
draft: false
accent: "#67493a"
---

# How an HTTP Client Can Create Too Many Threads

In my [previous article about Java virtual threads](https://abdessattar.dev/blog/java-virtual-threads-concurrency-vs-speed), I argued that more concurrency doesn't automatically mean more speed. Virtual threads let Java handle lots of waiting tasks without dedicating an operating-system thread to every one of them.

But what happens when a library *does* create a platform thread for every new piece of work?

That question led me to a small change in OpenTelemetry Java. The change itself was not complicated. Understanding why it mattered was the interesting part.

## An HTTP request isn't always just an HTTP request

Imagine an application exporting telemetry to a collector. It sends some data, then waits for the collector to respond.

If the code uses a blocking HTTP call, a thread can spend most of that time doing nothing useful. It is waiting for the network, the remote service, or perhaps a retry delay.

One common way to offer an asynchronous API around blocking work is to put that work on an executor. The caller submits a task, and a worker thread performs the blocking call.

That is broadly what OpenTelemetry's JDK HTTP sender did: it submitted work through **CompletableFuture.supplyAsync** to an executor, where the sender ultimately used the blocking JDK HTTP client call.

Important distinction: the JDK HTTP client wasn't inherently creating unlimited threads. The potential problem was in the **executor configuration around it**.

## A thread pool with almost no limit

Here is the important part of the old configuration, simplified:

~~~java
new ThreadPoolExecutor(
    0,
    Integer.MAX_VALUE,
    60,
    TimeUnit.SECONDS,
    new SynchronousQueue<>()
);
~~~

At first glance, it is just a thread pool. But look at two details.

**Integer.MAX_VALUE** is the maximum number of worker threads. That is a theoretical limit, not a practical safeguard against resource exhaustion.

And **SynchronousQueue** isn't a regular queue where tasks wait for their turn. It has no storage capacity. A submitted task must be handed directly to a worker that can accept it. When existing workers are busy and no worker is ready to take the task, the executor can create another thread, up to its configured maximum.

Now picture multiple requests being submitted while earlier workers are blocked waiting for HTTP responses. Without a meaningful upper bound, the number of platform threads can keep growing.

Each platform thread consumes resources. Enough of them can put serious pressure on memory and the operating system, even if CPU usage initially looks quiet because most threads are waiting.

## Let's reproduce the behavior without sending any HTTP requests

We don't need a real collector or thousands of connections to understand this. We only need tasks that overlap and wait.

This Java example intentionally submits 30 tasks to two executors. Every task waits on a latch so that the workers stay occupied while we submit the rest.

~~~java
import java.util.concurrent.*;

public class ExecutorDemo {

    static void run(int maxThreads) throws InterruptedException {
        var release = new CountDownLatch(1);

        var pool = new ThreadPoolExecutor(
            0,
            maxThreads,
            60,
            TimeUnit.SECONDS,
            new SynchronousQueue<>(),
            new ThreadPoolExecutor.AbortPolicy()
        );

        int rejected = 0;

        for (int i = 0; i < 30; i++) {
            try {
                pool.execute(() -> {
                    try {
                        release.await();
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                    }
                });
            } catch (RejectedExecutionException e) {
                rejected++;
            }
        }

        System.out.printf(
            "max=%d, workers=%d, rejected=%d%n",
            maxThreads, pool.getPoolSize(), rejected
        );

        release.countDown();
        pool.shutdown();
        pool.awaitTermination(5, TimeUnit.SECONDS);
    }

    public static void main(String[] args) throws InterruptedException {
        run(Integer.MAX_VALUE);
        run(5);
    }
}
~~~

Save it as **ExecutorDemo.java** and run it with Java installed:

~~~cmd
javac ExecutorDemo.java && java ExecutorDemo
~~~

You should see roughly this pattern:

~~~text
max=2147483647, workers=30, rejected=0
max=5, workers=5, rejected=25
~~~

We deliberately used only 30 tasks. Don't turn this into an experiment with hundreds of thousands of threads on your own machine.

Notice what changed: not the work, not the waiting time, and not the HTTP protocol. Only the maximum number of workers.

The bounded executor cannot quietly turn every new blocked task into another platform thread. In this example, it rejects submissions once all five workers are occupied.

That is not free performance. It is an explicit failure mode instead of uncontrolled resource growth.

## What made the OpenTelemetry case interesting

There is an important caveat here, and it came up during [the review of my contribution](https://github.com/open-telemetry/opentelemetry-java/pull/8276).

OpenTelemetry's usual batching processors do not continuously fire concurrent export requests through this sender. A maintainer rightly asked whether I had evidence of thread counts growing in normal usage.

The scenario I was concerned about involved **SimpleSpanProcessor** paired with a network exporter. It can export directly as spans end on application threads. If many submissions overlap while a remote backend is slow or returning errors that trigger retries, more workers can remain occupied.

But that pairing is not the recommended normal configuration. **BatchSpanProcessor** is the better choice for typical network exporting, and I should not pretend this change came from a demonstrated production outage.

The risk was in the unbounded configuration under concurrent load. The review helped establish the real boundary of the claim.

## The fix: limit the workers and handle rejection

The merged change replaced the almost-unlimited maximum with:

~~~java
Math.max(Runtime.getRuntime().availableProcessors(), 5)
~~~

That bounds the sender's default worker pool to at least five threads, or the available processor count if it is higher.

:::artifact{id="otel-http-executor-before-after"}

Now we need to answer the less glamorous question: what should happen when all workers are busy?

My first proposal used **CallerRunsPolicy**, which runs rejected work on the thread that submitted it. That can provide backpressure, but it can also make an application thread unexpectedly execute blocking exporter work.

After review, we kept the executor's **AbortPolicy** instead. A saturated pool throws a **RejectedExecutionException**. The sender catches that exception and passes it to its existing **onError** callback rather than letting it escape unexpectedly.

:::artifact{id="otel-http-executor-saturation"}

The change also addressed shutdown behavior so in-flight work has an opportunity to finish before the HTTP client closes.

None of this makes a slow collector fast. It sets a limit on how many worker threads this sender can create and defines what happens when that capacity is exhausted.

And that is the point: a limit is useful only if you understand the behavior at the limit.

## So, why not use virtual threads?

This brings us back to the previous article.

Virtual threads would make it much cheaper to have many concurrent tasks waiting on supported blocking I/O. They don't require one operating-system thread per waiting request.

But cheaper waiting is not unlimited capacity.

Imagine the collector can process 100 requests per second while your application tries to send 10,000. Switching the waiting tasks to virtual threads doesn't make the collector process requests any faster. There are still connection limits, network capacity, timeouts, retries, memory use, and downstream pressure to consider.

Virtual threads solve a thread-efficiency problem. They do not automatically solve an overload-control problem.

Those are related, but they are not the same thing.

## What I learned from this fix

Before reading the sender code, it would have been easy to assume that an executor meant work was being managed safely. But **a pool is not necessarily a bound**.

When reviewing asynchronous Java code, I now want to know four things:

1. How many tasks can run at once?
2. Where does excess work go?
3. What happens if the downstream service slows down?
4. What happens when the executor rejects a task?

The numbers matter, but the behavior matters more.

The [OpenTelemetry Java PR](https://github.com/open-telemetry/opentelemetry-java/pull/8276) was a fairly small patch. It made me think much more carefully about how an innocent-looking executor can affect the behavior of an entire application.

## One More Question

If your application receives work faster than an external service can handle it, where should that excess work go?

Into more threads? Into a queue? Back to the caller as an error?

There isn't one correct answer for every system.

But leaving the decision to **Integer.MAX_VALUE** is probably not a design decision at all.

## Sources

- [OpenTelemetry Java PR #8276: Bound JdkHttpSender thread pool](https://github.com/open-telemetry/opentelemetry-java/pull/8276)
- [Java ThreadPoolExecutor documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/ThreadPoolExecutor.html)
- [Java SynchronousQueue documentation](https://docs.oracle.com/en/java/javase/21/docs/api/java.base/java/util/concurrent/SynchronousQueue.html)
- [OpenJDK JEP 444: Virtual Threads](https://openjdk.org/jeps/444)


[View the contribution record](/work/bounded-http-sender)
