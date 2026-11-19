---
slug: what-is-observability-why-developers-care
title: Your API Is Up. Why Is It Slow?
description: "A beginner-friendly introduction to observability: follow a slow
  checkout request through logs, metrics, traces, and see where OpenTelemetry
  fits."
excerpt: The API returned HTTP 200, yet checkout took 2.4 seconds. Follow that
  request to understand why observability matters and how logs, metrics, and
  traces help.
publishedAt: 2026-11-19
updatedAt: 2026-11-19
topics:
  - Observability
  - OpenTelemetry
  - Backend Development
template: deep-dive
draft: false
---

# Your API Is Up. Why Is It Slow?

A user clicks **Pay**. The page waits. Two and a half seconds later, the order goes through.

Your dashboard is green. The API returned HTTP 200. Nobody reported an exception.

So why did the checkout feel broken?

A successful response tells you the request completed. It does **not** tell you what happened while the user was waiting. That gap is the reason observability matters.

Let's follow a fictional checkout request to make the idea concrete. The numbers below are **illustrative**, not measurements from a production system.

## A successful request can still be a problem

Imagine a small shop with this flow:

~~~text
Browser
  |
  v
Checkout API
  |-- Check inventory
  |-- Request payment
  |-- Return confirmation
~~~

One particular \`POST /checkout\` returns \`200 OK\`, but it takes **2.4 seconds**.

If all you have is an uptime check, this request looks fine. The service responds. It isn't down. Even an error-rate graph might look perfectly healthy.

But the user didn't experience a status code. They experienced a long wait.

What you need now isn't another green indicator. You need to answer a new question: **where did those 2.4 seconds go?**

## Observability means being able to investigate

Observability is the ability to understand what's going on inside a system by looking at the information it produces.

In software, that information is often called **telemetry**: records and measurements describing how the application behaves.

Monitoring and observability overlap. Monitoring is often organized around questions you already know to ask, such as *Is the API up?* or *Is the error rate above 5%?* Observability is especially useful when the failure doesn't fit the dashboard you already built.

Instead of guessing from the outside, you gather enough context to ask questions such as:

- Which endpoint became slower?
- Does it affect every request or only some of them?
- Is time spent in our code, a database query, or an outbound call?
- Did the behavior change after a deployment?

An observability tool won't magically answer every question. **The application has to produce useful data in the first place.**

Three common types of that data are logs, metrics, and traces. Let's look at the *same slow checkout* through each one.

## First view: logs tell us what happened

A log is a record of an event. You probably already use them:

~~~text
11:02:14.100 INFO checkout.started request_id=7f2
11:02:16.500 INFO checkout.completed request_id=7f2 status=200
~~~

These two fictional entries tell us the checkout began, then completed about 2.4 seconds later.

That is useful. We can identify this request, reconstruct the order of events, and search for nearby warnings.

But notice what is missing: **there's no record explaining which step consumed most of the time.** You could add logs around inventory, payment, and other operations. That might help, but it also requires consistent instrumentation and correlation across components.

Logs are excellent for details about events. They don't automatically give us the complete path of a request.

## Second view: metrics show the pattern

A metric is a measurement you can track over time.

For the checkout API, you might collect request counts, error rates, and response times. Instead of opening individual log entries, you can look at the shape of the problem:

~~~text
Checkout API, last 15 minutes (illustrative)

Request rate:         120 requests/minute
Error rate:           0.2%
95th percentile:      2.4 seconds
~~~

The **95th percentile**, or **p95**, means that roughly 95% of the recorded request durations in that time window were at or below 2.4 seconds. About 5% were above it. This is an *aggregate*, not the duration of one particular request.

Now we can see the important distinction: **low error rate does not mean good performance**.

Metrics help answer *how widespread is this?* and *when did it start?* They are useful for trends and alerts, but this metric alone still doesn't identify the slow operation.

## Third view: traces show one request's journey

A trace represents the work involved in processing a request. It's often composed of smaller operations called **spans**. For now, just think of a span as a timed piece of work.

Imagine the recorded timeline for our slow request looks like this:

~~~text
POST /checkout                       2,400 ms
  |
  |-- Inventory check                   30 ms
  |
  |-- HTTP call to payment service   2,100 ms
~~~

This is not a complete breakdown of every millisecond, and in real traces operations can overlap.

But it immediately narrows the search. The payment HTTP call occupies most of the observed time.

**Does that prove the payment service itself was slow?** No. The time could include network delay, connection setup, retries, or the remote service's processing. We now have a useful lead, not a proven root cause.

That is what a good trace buys us: less guessing and a more specific next investigation.

:::artifact{id="observability-slow-checkout-three-views"}

Notice that these three signals are answering different questions about the same incident. Logs capture events; metrics summarize behavior over time; traces describe the path and timing of an individual operation.

They're most powerful when you can connect them, for example by using a trace identifier to find logs from the request you're investigating.

## Where does OpenTelemetry fit?

At this point, a fair question is: *Do I have to write custom timing and logging code everywhere?*

Not necessarily.

**OpenTelemetry**, often shortened to **OTel**, is an open-source, vendor-neutral collection of APIs, SDKs, instrumentation libraries, and tools for generating, collecting, and exporting telemetry such as traces, metrics, and logs.

Its job is not to be your dashboard.

Think of a typical setup like this:

~~~text
Your application
  |  (instrumented with OpenTelemetry)
  v
Telemetry data
  |
  v
OpenTelemetry Collector (optional)
  |
  v
Observability backend
  |
  v
Dashboards, queries, alerts, trace views
~~~

*Instrumentation* just means adding the ability to record useful information about what the application does. Some instrumentation can be automatic, depending on the language and libraries. You can also add it manually when you need application-specific detail.

The Collector is a separate component that can receive, process, and forward telemetry. It isn't mandatory for every deployment. The backend is responsible for storing, querying, and visualizing the data.

That separation matters: OpenTelemetry is **not** a replacement for every monitoring tool. It gives applications a more standardized way to produce and transport the information those tools need.

I'll cover the exact pieces of OpenTelemetry in the next article. For now, the distinction worth remembering is:

**Observability is the capability you're trying to build. OpenTelemetry is one set of tools that can help you build it.**

## A small exercise for your next API

You don't need a complicated microservices architecture to start thinking this way.

Take one endpoint in an application you understand and ask:

1. Can I tell whether it's slow, not just whether it returned an error?
2. Can I see whether slowness is isolated to a few requests or affects many?
3. For a slow request, can I distinguish time spent in application code from time spent waiting on another component?
4. Can I connect the evidence without guessing which log lines belong together?

If the answer to the third question is “I would add a bunch of \`println\` statements and try again,” that's a perfectly normal starting point. It's also a clue that the system may need better instrumentation.

None of this requires thousands of services. Even a single Spring Boot application making a database query and one HTTP call can be difficult to debug when the only clue is “it feels slow.”

## The useful question

The point of observability isn't to collect as much data as possible. More telemetry can mean more noise, expense, and opportunities to expose information you shouldn't collect.

The point is to collect **enough trustworthy evidence to understand what your software is doing when it matters**.

Our checkout completed successfully. Without useful telemetry, we know only the outcome. With logs, metrics, and traces, we can move from *something is slow* toward *this particular operation deserves investigation*.

That's a much better place to start debugging.

**Next in the series:** What exactly is OpenTelemetry, what does it do, and what doesn't it do?

## Sources

- [OpenTelemetry: Observability primer](https://opentelemetry.io/docs/concepts/observability-primer/)
- [OpenTelemetry: What is OpenTelemetry?](https://opentelemetry.io/docs/what-is-opentelemetry/)
- [OpenTelemetry: Traces](https://opentelemetry.io/docs/concepts/signals/traces/)
- [OpenTelemetry: Instrumentation](https://opentelemetry.io/docs/concepts/instrumentation/)
