---
slug: how-this-site-works
title: How this site works
description: The public pages, private writing Studio, Markdown content, and why analytics should not cross the editorial boundary.
excerpt: A short tour of the publishing mechanism behind this casebook.
publishedAt: 2026-11-11
updatedAt: 2026-11-11
topics:
  - Web
  - Architecture
template: deep-dive
draft: false
---

I wanted this site to be a place to read engineering work, not a collection of portfolio widgets. It still needs machinery behind the writing. Here is the part worth explaining.

## Public pages are the reading surface {#public}

The site is a Next.js and React application written in TypeScript and deployed through a Cloudflare-oriented setup. The casebook records live under `/work`, notes under `/blog`, and talks under `/speaking`.

The repository keeps a Markdown source for each note and case. A note has frontmatter for its slug, title, date, and topics; its body explains the mechanism. A work record has a deliberately narrower shape: problem, merged change, tests, and scope. The two can link to each other without pretending to be the same kind of page.

Public notes are also exposed through RSS, so reading the site does not require signing up for anything.

## Studio is an editing surface, not another public section {#studio}

The private `/studio` area is for drafting and publishing. Its layout requires an owner session and tells search engines not to index it.

Drafts live separately from the published content. The publication path can update the live content store and commit source material back to GitHub. On the reading side, the application loads the repository content and applies published overrides when present. That lets editing and reading use different workflows without building a second public website.

It is also why the Markdown source remains useful: the site is not the only place where an explanation can be inspected.

## The analytics boundary {#analytics}

Analytics belong to the public reading experience, not to the editing and sign-in workflow. The intended boundary is simple: public-page measurement should not become a recorder of activity inside Studio or authentication pages.

One subtle issue in a single-page application is that navigation can preserve the current JavaScript document. Changing a route does not necessarily unload a script already running in that document. A boundary that matters for privacy must account for *how navigation happens*, not just which path a script originally loaded on.

The practical approach is to keep public navigation convenient while requiring a fresh document when crossing from the public site into private areas. That is a separation of execution contexts, not merely hiding a link.

## Why these choices {#why}

The useful feature of the site is still the writing. The mechanism should make it easier to publish a precise note, attach its evidence, and let readers move from a case to the test and pull request.

No comments widget, newsletter funnel, or search box is needed to explain a four-line fix. More mechanisms to maintain would be a strange substitute for more things worth reading.

[Browse the engineering casebook](/work) or [read the notes](/blog).
