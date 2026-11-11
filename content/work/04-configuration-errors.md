---
slug: configuration-errors
number: 8669
shortTitle: Safer configuration errors
topic: Configuration · Security
title: Useful errors without the raw credentials
summary: Keep property and header names in configuration errors while omitting their raw values.
problem: |
  Malformed map properties and URL-encoded OTLP headers could include raw values in configuration exceptions. Those values can contain credentials and appear in startup logs.
change: |
  Error messages retain the property or header name and omit the corresponding raw value.
verification: |
  Regression tests use sentinel credential values and assert the expected redacted exception messages.
boundary: |
  The fix covers the identified configuration error paths. It is not a claim that every possible logging path is secret-free.
---

noteSlug: configuration-errors
