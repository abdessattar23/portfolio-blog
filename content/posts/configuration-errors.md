---
slug: configuration-errors
title: When a configuration error repeats your secret
description: How malformed configuration and OTLP header errors could expose raw values, and how OpenTelemetry Java changed those messages.
excerpt: Diagnostic messages need to identify the bad property, not echo its credential.
publishedAt: 2026-11-11
updatedAt: 2026-11-11
topics:
  - Java
  - OpenTelemetry
  - Security
template: deep-dive
draft: false
---

Error messages are meant to help explain what failed. But sometimes the value that failed is exactly the value an error message should not print.

That was the problem behind my OpenTelemetry Java configuration-error contribution.

## The leak path {#mechanism}

Some malformed map properties and URL-encoded OTLP header settings could trigger configuration exceptions containing the original supplied values.

Those values are not necessarily harmless strings. An exporter header might include an API key or another credential. Configuration errors frequently surface during application startup, when logs are collected, forwarded, and retained.

A secret does not need to pass through an HTTP request to be exposed. Repeating it in an exception can be enough.

## Keep the location, remove the value {#fix}

A useful diagnostic should tell an engineer *which* property or header could not be parsed. It does not have to reproduce the raw contents.

The merged change preserves identifying names in the relevant error messages while omitting the supplied values. That keeps the message actionable without making the original setting part of the diagnostic output.

This is not a case for vague errors. It is a case for separating **where parsing failed** from **what sensitive bytes were supplied**.

## How the regression was checked {#tests}

The regression tests pass recognizable sentinel credential values through the affected configuration-error paths and assert the redacted exception messages.

That tests the property that matters: an invalid value can still produce a useful failure, but the diagnostic should not echo the credential.

The tests cover the identified malformed map-property and URL-encoded OTLP-header cases. They do not prove that every exception, logger, or exporter path in the entire library is secret-free.

## Source and scope {#source}

See [OpenTelemetry Java PR #8669](https://github.com/open-telemetry/opentelemetry-java/pull/8669) for the merged code, regression tests, and review discussion.

[View the contribution record](/work/configuration-errors).
