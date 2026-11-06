# Writing a blog post

Create a registered draft from Windows CMD:

```cmd
npm run new:post -- "Why this Java bug survived review"
```

The command creates `content/posts/why-this-java-bug-survived-review.tsx` and adds it to the post registry. Drafts never appear on the homepage, blog index, article routes, or RSS feed.

Edit the generated file:

1. Replace every `TODO`.
2. Set the description, excerpt, topics, date, and section links.
3. Write the article body with normal React markup. Use `<pre><code>` for code and `<div className="note">` for a callout.
4. Keep `draft: true` while working.
5. Set `draft: false` when the article is ready.
6. Run `npm run build` before pushing.

The post registry automatically feeds `/blog`, the homepage’s latest-post section, dynamic `/blog/<slug>` pages, and `/feed.xml`.

Do not copy the existing OpenTelemetry article and change its nouns. Start from the generator so each post has its own evidence, scope, and structure.
