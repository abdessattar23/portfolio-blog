---
slug: how-this-site-works
title: How this site works
description: The public portfolio, private writing Studio, repository content,
  and analytics boundary.
excerpt: The machinery behind the engineering notes, without another portfolio widget.
publishedAt: 2026-11-11
updatedAt: 2026-11-11
topics:
  - Web
  - Architecture
template: deep-dive
draft: false
---

I wanted this site to be a place to read engineering work, not a collection of portfolio widgets. There is still machinery behind the writing. This is the part worth explaining.

## The public reading surface

The site is a Next.js and React application in TypeScript, with a Cloudflare-oriented deployment setup. The casebook is at [Work](/work), notes are at [Blog](/blog), and talks are at [Speaking](/speaking).

A case records the problem, merged change, tests, and scope. A note has room to explain the mechanism. Links between them make it possible to move from a short case to the evidence rather than reading the same summary twice.

Notes are available through RSS; no account or newsletter is required.

## Studio is the editing surface

The private `/studio` area is for drafting and publishing, not a second public website. Drafts are separate from published content. The publishing flow can update the live content store and commit source material back to GitHub.

That distinction matters to this very note: it should be drafted in Studio instead of being inserted as a separate Markdown file through a code change. GitHub remains a versioned representation of published material, not a competing editor.

The reading side uses repository content and can apply published overrides. Both routes need to agree on the canonical note.

## Keep analytics out of private workflows

Analytics are for public reading, not for recording owner editing or sign-in behavior. The important boundary is between public pages and private Studio or authentication pages.

Client-side navigation complicates this: changing routes does not necessarily unload JavaScript already running in the document. Keeping a script off a private route's initial page load is not sufficient if a user can navigate there from a public route without a fresh document.

A meaningful boundary accounts for navigation and execution context, not merely whether a link is visible.

## The point

Publishing should make it easier to explain a bug, cite its test, and connect it to the merged change. A search box, comments section, or newsletter would add things to maintain without making a four-line fix easier to understand.

[Explore the casebook](/work) or [read the notes](/blog).
