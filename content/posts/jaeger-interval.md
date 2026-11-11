---
slug: jaeger-interval
title: The Jaeger sampler interval that looked configured but was not
description: A one-word configuration mismatch made the Jaeger remote sampler ignore its polling interval, and an improved description made the value testable.
excerpt: The difference between accepting a setting and actually reading it.
publishedAt: 2026-11-11
updatedAt: 2026-11-11
topics:
  - Java
  - OpenTelemetry
  - Configuration
template: deep-dive
draft: false
---

A configuration option can exist, be documented, and still have no effect. The bug I worked on in OpenTelemetry Java's declarative Jaeger remote sampler was only one word long.

## The bug {#mechanism}

The declarative configuration exposes a polling setting named `interval`. The provider code was looking up `internal` instead. That is not a different unit or a confusing default. It is a different key.

When a user supplied `interval`, the provider did not retrieve that value through the misspelled lookup. The sampler could therefore use its default polling interval instead of the configured interval.

The important failure mode is quiet: the configuration can appear valid while the running component behaves as if the option was absent.

## Why a simple assertion did not catch it {#tests}

The existing comparison-based test relied on the sampler's string description. That description did not expose the polling interval, so two samplers could look equivalent in the test even when their configured interval differed.

The merged change fixed the lookup to read `interval`. It also made the Jaeger sampler description include the endpoint and polling interval, then updated the description assertions.

That second part matters. A test can only distinguish two configurations if its observed output actually includes the field being tested.

## What changed {#fix}

This was a targeted fix in the declarative Jaeger remote sampler provider and its description-based test coverage. It did not redesign Jaeger sampling, change every sampler, or demonstrate a production incident.

A useful question when reviewing a configuration test: *If I changed this one setting, would the assertion notice?*

## Source and scope {#source}

The explanation comes from the merged change and review discussion in [OpenTelemetry Java PR #8668](https://github.com/open-telemetry/opentelemetry-java/pull/8668). Inspect the PR's **Files changed** and tests for the exact implementation.

[View the contribution record](/work/jaeger-interval).
