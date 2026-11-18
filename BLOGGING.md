# Writing a blog post

Create a draft from the project root:

```text
npm run new:post -- "Why this Java bug survived review"
```

The command asks which template to use: `deep-dive`, `bug-story`, `til`, or `talk-notes`. You can also pass the template as the last argument. It writes `content/posts/<slug>.md`. Drafts never appear on the homepage, blog index, article routes, RSS feed, or sitemap.

Edit the generated file:

1. Replace every `TODO`.
2. Set the description, excerpt, topics, and dates.
3. Write the article in Markdown. Use fenced code blocks for code, `:::note` for a callout, `:::demo{name="bucket"}` for the built-in bucket example, and `:::artifact{id="virtual-thread-pool"}` for a reusable figure. See [ARTIFACTS.md](./ARTIFACTS.md).
4. Keep `draft: true` while working.
5. Set `draft: false` when the article is ready.
6. Run `pnpm build` before pushing.

Every Markdown file in `content/posts` is picked up automatically. It feeds `/blog`, the homepage, `/blog/<slug>`, `/feed.xml`, `/sitemap.xml`, and `/llms.txt`.

Do not copy the existing OpenTelemetry article and change its nouns. Start from the generator so each post has its own evidence, scope, and structure.

## Code examples

Use a language and a filename on source fences. Highlight only the lines being discussed:

````markdown
```java title="TimingAgent.java" {3-5,8}
// example code
```

```cmd
mvn clean package
```

```text kind="output" title="Expected output"
Hello, Java!
```
````

`filename="TimingAgent.java"` is an alias for `title`. `highlight="3-5,8"` is an alias for the brace syntax. Metadata is optional. Existing fences still work; an unambiguous inline filename in the paragraph immediately before a fence becomes its label. Terminal languages get a command header; output requires `kind="output"` or the `output` language. A `text` fence stays plain text, since it could be a directory tree or configuration rather than program output. Copy always copies code only.

## Evidence and scope

Build each technical article around one concrete problem. Show the smallest useful code, the command that exercises it, and the result before expanding the explanation. Link a runnable repository when one exists. Record versions and commands used. Label expected or illustrative output honestly; do not present an unexecuted example as a captured result.

Use a diagram or interactive figure when it explains a mechanism more clearly than the code alone. End when the technical argument is complete. Closing sections such as “What I learned” or “One more question” are optional, not a recurring article requirement.
