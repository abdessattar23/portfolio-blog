---
slug: java-virtual-threads-concurrency-vs-speed
title: "Java Virtual Threads: More Concurrency Doesn't Mean More Speed"
description: Virtual threads help Java handle more waiting tasks, but they don't
  make databases or CPU work faster. A simple guide to concurrency and
  performance.
excerpt: More threads do not automatically mean faster requests. Here's what
  Java virtual threads actually change.
publishedAt: 2026-11-09
updatedAt: 2026-11-09
topics:
  - Java
  - Concurrency
  - Performance
template: deep-dive
draft: false
accent: "#67493a"
---

# Java Virtual Threads: More Concurrency Doesn't Mean More Speed

Imagine a restaurant with ten waiters. Each waiter takes an order, then stands still until the kitchen finishes cooking. Soon, all ten waiters are waiting, and new customers cannot place orders.

Now imagine the waiters can take another order while the kitchen works. The kitchen is not cooking faster. But the restaurant can serve more customers at once.

That is roughly the idea behind **virtual threads** in Java.

## First, what is a thread?

A thread is a path of work inside a program. A web server might use one thread to handle a request, another to call a payment service, and another to read from a database.

Traditional Java **platform threads** are backed by operating-system threads. They work well, but keeping huge numbers of them around can be expensive.

Since Java 21, **virtual threads** have been a standard feature. They are Java threads managed largely by the Java runtime, which can run many virtual threads using a smaller number of operating-system threads.

## The important difference: waiting

Many backend requests spend much of their time waiting: for a database query, an HTTP response, or a file operation.

When a virtual thread encounters supported blocking I/O, Java can pause that virtual thread and let the underlying operating-system thread work on something else.

That makes it practical to handle many concurrent requests using simple, readable blocking code.

**But a virtual thread does not make the database answer faster.** It helps your application avoid wasting a valuable operating-system thread while waiting.

Oracle's documentation puts it plainly: virtual threads are about scaling throughput, not making individual tasks run faster.

## A tiny Java example

This Java 21+ example starts 1,000 tasks that each wait for one second:

```java
import java.time.Duration;
import java.util.concurrent.Executors;

public class VirtualThreadsDemo {
    public static void main(String[] args) throws Exception {
        long start = System.nanoTime();

        try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
            for (int i = 0; i < 1_000; i++) {
                executor.submit(() -> {
                    Thread.sleep(Duration.ofSeconds(1));
                    return null;
                });
            }
        }

        double seconds = (System.nanoTime() - start) / 1_000_000_000.0;
        System.out.printf("Elapsed: %.2f seconds%n", seconds);
    }
}
```

The tasks can overlap instead of waiting in a queue of a few worker threads. The executor's `close()` waits for them to finish.

**Important:** `Thread.sleep` is a teaching example, not a realistic database or HTTP benchmark. No performance result is claimed here. To compare approaches fairly, we would need to measure them under the same workload and environment.

## The database can still be the bottleneck

Suppose your application has **10 database connections** but receives **1,000 requests** at once.

Virtual threads can make it cheaper for the Java application to keep those requests waiting. They cannot magically create 990 extra database connections.

Requests still have to wait for a free connection. If the database is slow, your application can still be slow.

:::artifact{id="where-the-waiting-goes"}

This is why more concurrency is not the same thing as more performance.

Three measurements matter:

- **Latency:** How long does one request take?
- **Throughput:** How many requests can the system complete per second?
- **Resource use:** How much memory, CPU, and how many connections does it consume?

Virtual threads may improve throughput and resource efficiency for workloads that spend lots of time waiting. They do not guarantee lower latency.

## Should every Java application use them?

No.

They are especially useful for applications with many concurrent tasks that spend time blocked on I/O. They are not a shortcut for CPU-heavy calculations, where the available CPU cores still limit how much work can run at once.

There are also implementation details to consider. For example, **Java 24 changed how virtual threads interact with `synchronized`**, reducing an important source of thread pinning that existed in Java 21. Advice written for older JDKs should not be copied without checking the version.

## The takeaway

Virtual threads change the **cost of waiting**, not the **speed of the thing you're waiting for**.

Before enabling them in a production service, ask: *Where is our real bottleneck?* If it's a limited database pool or a slow downstream service, virtual threads alone will not fix it.

Good engineering starts with measuring the problem, not enabling the newest feature.

## Sources

- [OpenJDK JEP 444: Virtual Threads](https://openjdk.org/jeps/444)
- [Oracle: Virtual Threads, Java 24](https://docs.oracle.com/en/java/javase/24/core/virtual-threads.html)
- [Oracle: Virtual Threads, Java 21](https://docs.oracle.com/en/java/javase/21/core/virtual-threads.html)
- [Oracle: Significant Changes in JDK 24 (JEP 491)](https://docs.oracle.com/en/java/javase/25/migrate/significant-changes-jdk-24.html)

---

## One More Question

If virtual threads let us handle thousands of requests, but our database can only serve a handful at once, have we really made our application faster, or just made it better at waiting?

That's the question I'd ask before changing the architecture.
