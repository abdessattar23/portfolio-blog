---
slug: when-observability-breaks
status: Delivered
event: "A JUG for Everyone : The Voice of Tech"
location: London
title: " Stop Chasing the DOM: Browser Automation Through the Accessibility Tree"
summary: A 45-minute talk for Java/JVM developers that compares DOM targeting
  with accessibility tree targeting in browser automation, showing how semantic
  roles and names can decouple tests from fragile markup while honestly covering
  the limits (missing semantics, custom widgets, cases where DOM access still
  wins).
detail: >-
  Browser tests break when markup shifts: a button moves, a class changes, and a
  selector that worked yesterday can no longer find "Submit". The page is fine,
  but the automation is not. This talk introduces the accessibility tree as a
  second interface to the browser, one that describes controls by role,
  accessible name, and semantics rather than by DOM position and structure.


  Over 45 minutes we compare DOM targeting with accessibility tree targeting and
  look at what each one couples your automation to. Semantic targeting can
  reduce dependence on markup, but it has real limits: missing semantics,
  ambiguous names, custom widgets, and situations where direct DOM access is
  still the right tool. The examples are language independent, though framed for
  Java and JVM developers who build tests, tooling, or browser automation.


  This is not an accessibility compliance talk and not an argument for
  eliminating selectors. The goal is to leave you with one more browser
  interface to reason about, including an honest view of where it stops helping.
---


