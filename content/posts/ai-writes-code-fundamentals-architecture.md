---
slug: ai-writes-code-fundamentals-architecture
title: AI Can Write Code. You Still Need the Fundamentals.
description: AI can generate architecture in minutes. But retries, concurrency,
  timeouts, and partial failures still determine whether your system works.
excerpt: If AI handles implementation, are we ready to jump straight to system
  design? A checkout failure illustrates why fundamentals still matter.
publishedAt: 2026-11-12
updatedAt: 2026-11-12
topics:
  - AI
  - Software Engineering
  - System Design
  - Java
  - Distributed Systems
template: deep-dive
draft: false
accent: "#67493a"
---

“AI can write the code now. Developers should focus on system design and architecture.”

That's what I keep hearing.

And I get the argument. AI can generate controllers, services, repositories, tests, Dockerfiles, and probably the diagram explaining all of it. So why spend our time typing code?

But there's a question missing from that advice:

**How are you supposed to design systems if you don't understand how the pieces work?**

I'm not talking about memorizing Java APIs. I'm talking about threads, transactions, network failures, retries, and the guarantees your components actually give you.

Those aren't low-level details you graduate past when you become an architect. They're the things your architecture is made of.

## The diagram is the easy part

Imagine we're building a checkout system.

Ask AI to design it and you'll probably get something plausible: an API, a checkout service, PostgreSQL, a payment provider, and Kafka for notifying other services.

:::artifact{id="ai-fundamentals-happy-path"}

*Figure 1. The boxes show where requests go, but not what the system guarantees.*

Nothing is inherently wrong with this. But a clean diagram isn't proof that we've made the important decisions.

Before asking whether we should use Kafka, I have a less exciting question:

**What happens when a customer pays, the request times out, and they try again?**

## One checkout. Two charges.

Here's a hypothetical example.

A customer submits a €49 checkout request. Our service calls the payment provider. The provider charges the customer, but its response never reaches our application.

From the provider's perspective, the payment succeeded.

From our service's perspective, it timed out.

The client retries.

If our application treats the retry as a new payment attempt, the customer could be charged twice for one purchase.

:::artifact{id="ai-fundamentals-duplicate-payment"}

*Figure 2. A missing response doesn't mean the operation didn't happen.*

Our services can have excellent boundaries. Our controllers can be clean. Our architecture diagram can look fantastic.

We still missed one basic fact about networks:

**A timeout tells you the response didn't arrive in time. It doesn't tell you whether the other side completed the work.**

Adding exponential backoff doesn't fix that. Retrying a non-idempotent operation may simply repeat the damage more politely.

## "Just check whether it already exists"

Okay, so let's ask AI for a fix. One possible suggestion is to check the database before processing the checkout:

> If a checkout with this request key already exists, return it. Otherwise, charge and save it.

Sounds reasonable.

But two requests can arrive at the same time.

Request A checks: nothing exists.

Request B checks: nothing exists.

Both continue.

That's a race condition. A check followed by an action isn't an atomic claim, regardless of how nice the method name looks.

:::artifact{id="ai-fundamentals-check-vs-claim"}

*Figure 3. An atomic database claim is one safeguard. It's not an entire payment implementation.*

We can give each logical checkout a stable idempotency key and enforce uniqueness in the database. Only the request that successfully claims that key should initiate work. A repeated request can retrieve or wait for the original result.

But there's another trap: **a database unique constraint cannot undo an external charge that already happened.**

If we call the payment provider *before* establishing who owns the checkout attempt, the database might reject the second insert while the customer is already charged twice.

We also need to reuse a stable idempotency key with the payment provider, subject to the provider's actual guarantees. If the response is ambiguous, we may need to query or reconcile the payment state instead of blindly creating a new charge.

Now we're making architecture decisions.

Not because we added another box, but because we understand what can go wrong between two operations.

## And then Kafka enters the story

Suppose the payment succeeds and our database records it. Now we want to publish an `OrderPaid` event.

What if the application crashes after committing the database transaction but before publishing to Kafka?

The order says *paid*. The downstream service never receives the event.

Try publishing first, and you introduce the reverse failure: an event may be sent for a database change that eventually rolls back.

A transactional outbox is one answer. Save the business state and the outgoing event record in the **same database transaction**. Let a separate process publish the event later.

But even that relay may send an event more than once. Consumers still need idempotent handling. Kafka's exactly-once features don't automatically make arbitrary external side effects happen exactly once.

:::artifact{id="ai-fundamentals-design-guardrails"}

*Figure 4. Some of the guarantees the checkout flow needs. This is a design sketch, not a drop-in production architecture.*

Does every application need an outbox? No.

Does every project need Kafka? Definitely not.

The point is that we can't decide which patterns are necessary until we understand the problems they're meant to solve.

## Fundamentals aren't beneath architecture

We've started talking about system design as if it's a separate skill above programming: AI handles implementation and humans move to the diagrams.

I don't buy that division.

A database transaction isn't a minor detail when your design depends on atomicity.

An HTTP timeout isn't a minor detail when you don't know whether a remote operation succeeded.

A thread pool isn't a minor detail when a struggling dependency can exhaust your application.

I encountered that last kind of problem while [contributing to OpenTelemetry Java](https://github.com/open-telemetry/opentelemetry-java/pull/8276). An HTTP sender had a thread pool that could grow without a practical upper bound. The fix involved bounding it. No fancy architecture diagram, just understanding what happens when work piles up and threads keep getting created.

Yet that kind of detail can determine whether an application stays alive under pressure.

When I say *fundamentals*, I'm not asking everyone to implement a linked list from memory, stop using libraries, or refuse AI tools.

I mean knowing how concurrency, I/O, transactions, resource limits, and failure boundaries behave.

Abstraction is necessary in architecture. You don't need to understand every JVM instruction or every PostgreSQL internal.

But you need to understand **what the components promise, what they don't promise, and the consequences when they fail**.

Otherwise you're not designing the system. You're arranging technology names.

## If AI writes the code, what should we focus on?

I use AI myself. It helps me explore ideas, write repetitive code, understand unfamiliar APIs, and think through alternatives.

But the time it saves shouldn't be an excuse to skip understanding. I'd rather use that time to ask:

- Can this operation run twice, and how do we recognize the *same* logical request?
- Which changes are atomic? Which ones cross a boundary we cannot atomically control?
- What can time out after succeeding?
- What happens when two requests arrive simultaneously?
- Which resources have limits: threads, connections, queues, memory?
- What if the process crashes between two steps?
- What evidence would prove our design works under those failures?

For the checkout example, I'd test two simultaneous requests with the same key; a provider response lost *after* a successful charge; a crash between database commit and event publication; and a duplicated event reaching the consumer.

Those tests are more useful than another arrow on the diagram.

AI can suggest answers and tests too. Great. Then verify the assumptions and own the result.

## Maybe we've got the advice backwards

“AI writes code, so focus on architecture” makes architecture sound like the place you go when implementation is no longer your problem.

But architecture is exactly where your assumptions about implementation become expensive.

AI makes it easier to build systems. It doesn't make concurrency, network ambiguity, or partial failure disappear.

So yes, let AI help write the code.

**Then use the time you saved to understand more, not less.**

Because you can't make good architectural decisions about systems you don't understand.

---

### Technical references

The checkout scenario is hypothetical. The underlying mechanisms are documented in:

- [PostgreSQL: uniqueness constraints](https://www.postgresql.org/docs/current/ddl-constraints.html) and [atomic conflict handling](https://www.postgresql.org/docs/current/sql-insert.html)
- [Apache Kafka: message delivery semantics](https://kafka.apache.org/40/design/design/)
- [AWS: transactional outbox pattern](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html)
- [OpenTelemetry Java PR #8276](https://github.com/open-telemetry/opentelemetry-java/pull/8276)
