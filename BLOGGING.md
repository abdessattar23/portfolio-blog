# Writing a blog post

Create a draft from the project root:

```text
npm run new:post -- "Why this Java bug survived review"
```

The command asks which template to use: `deep-dive`, `bug-story`, `til`, or `talk-notes`. You can also pass the template as the last argument. It writes `content/posts/<slug>.md`. Drafts never appear on the homepage, blog index, article routes, RSS feed, or sitemap.

Edit the generated file:

1. Replace every `TODO`.
2. Set the description, excerpt, topics, and dates.
3. Write the article in Markdown. Use fenced code blocks for code, `:::note` for a callout, and `:::demo{name="bucket"}` for an interactive example.
4. Keep `draft: true` while working.
5. Set `draft: false` when the article is ready.
6. Run `pnpm build` before pushing.

Every Markdown file in `content/posts` is picked up automatically. It feeds `/blog`, the homepage, `/blog/<slug>`, `/feed.xml`, `/sitemap.xml`, and `/llms.txt`.

Do not copy the existing OpenTelemetry article and change its nouns. Start from the generator so each post has its own evidence, scope, and structure.
