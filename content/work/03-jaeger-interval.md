---
slug: jaeger-interval
number: 8668
shortTitle: Jaeger sampler interval
topic: Configuration · Tracing
title: A polling interval hidden by a typo
summary: Read the declarative Jaeger remote sampler’s interval key correctly.
problem: |
  The configuration exposed interval, while the provider looked up internal. A supplied polling interval could therefore fall back to the default.
change: |
  The provider now reads interval. The sampler description also includes its endpoint and polling interval, making those values visible to existing comparison-based tests.
verification: |
  The merged change updates description assertions. The review discussion explains why the existing toString-based comparison previously missed the interval mismatch.
boundary: |
  This is a declarative configuration fix for the Jaeger remote sampler, not a change to all sampling behavior.
noteSlug: jaeger-interval
---
