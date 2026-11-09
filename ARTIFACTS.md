# Interactive artifacts

Artifacts are reusable figures for technical notes. A figure is a version 1 JSON document. It describes what to draw and which numbers a reader can change. It never contains JavaScript, HTML, or raw SVG.

The same document can be previewed in Blog Studio, inserted by the studio MCP tools, and rendered in a published article.

## Schema

```json
{
  "version": 1,
  "id": "virtual-thread-pool",
  "title": "Platform threads, virtual threads, and the database pool",
  "summary": "A conceptual picture. This is not a measurement.",
  "classification": "conceptual",
  "view": { "type": "carrier-pool" }
}
```

- `version` is `1`. Any other version fails closed.
- `id` is lowercase letters, numbers, and hyphens. It is stable across notes.
- `title` and `summary` are plain text. The summary is the accessible description and the static fallback.
- `classification` is `conceptual` or `measured`. The carrier-pool view is only `conceptual`.
- `view.type` is one of `carrier-pool`, `architecture`, `flowchart`, `sequence`, `frames`, `code-compare`, `callout`, or `svg-scene`.

Number controls have `label`, `min`, `max`, `step`, and `default`. The renderer clamps them. There is no expression language.

`architecture` and `flowchart` use `nodes` (`id`, `label`, optional `lane`) and `edges` (`from`, `to`, optional `label`). `sequence` uses `participants` and `messages`. `frames` uses ordered `{title, text}` steps. `code-compare` uses `before` and `after`. `callout` uses `text`. `svg-scene` uses a bounded canvas and only `rect`, `line`, `circle`, and `text`.

Unknown versions, unknown view types, markup, script URLs, and raw SVG paths fail validation. The figure then shows the title and summary, not an error dump and not a guess.

## Markdown

Reference a saved artifact on its own line:

```text
:::artifact{id="virtual-thread-pool"}
```

There is no closing fence and no body. The id is the reuse key. Existing `:::demo{name="bucket"}`, `:::demo{name="walk"}`, `:::demo{name="compare"}`, and `:::note` fences are unchanged. A fence inside a code block stays code.

## Lifecycle

Git is the reviewed catalog: `content/artifacts/<id>.json`. Studio edits live in the D1 `artifacts` table and override the git file for preview and for the live renderer in that environment. Create and update do not publish an article and do not commit to GitHub.

1. Validate the JSON.
2. Save it in the studio database, or keep the reviewed copy in git.
3. Insert the fence into a note draft.
4. Publish the note only when the owner asks. Publishing a note does not, by itself, delete or replace the git catalog.

`delete_artifact` requires `confirm: true`. It removes only the studio row. It refuses while a note still references the id, and it never deletes the git file.

The proof-of-concept file is `content/artifacts/virtual-thread-pool.json`. A published article can render it after this repository is deployed. This slice does not deploy.

## Renderer

`MarkdownView` splits the artifact fence out of the Markdown, then draws it with `ArtifactFigure`. The carrier-pool view is a normal import so its default state is in the server HTML. The other views are loaded when a note uses them.

The shared chrome is the classification line, title, and summary. The carrier-pool figure says **Conceptual simulation, not a measurement**. Its sliders are native range inputs. The picture shows platform threads, virtual threads, and database connections. Requests beyond the smaller of those two limits wait. The readout counts what is mounted, waiting, and unused. It does not invent latency, throughput, or a speedup.

Colors come from the article tokens, so light and dark stay the same system. Rows wrap on a narrow screen. A short fill transition runs only when the reader has not asked for reduced motion. There is no autoplay.

If the id is missing, the figure says it is not available.

Article pages own the title. A Markdown h1 is dropped, and the first h2 is dropped when its text is the article title. The contents list skips that same opening section.

## MCP

These tools are on the authenticated `/studio/mcp` server. The public `/mcp` server does not get them. The server tells clients that the tool list can change. ChatGPT keeps the list it saved when the app was added, so refresh that app after a deploy to load tools that were not in the original 14.

| Tool | Effect |
| --- | --- |
| `list_artifacts` | Read the catalog. |
| `read_artifact` | Read one JSON document. |
| `preview_artifact` | Validate JSON. Returns errors, fallback text, and the fence. No HTML. |
| `create_artifact` | Save a new id. Fails if the id exists. |
| `update_artifact` | Replace an existing id. |
| `attach_artifact` | Insert the fence into a note draft. Does not publish. |
| `delete_artifact` | Destructive. Requires `confirm: true` and no remaining references. |

`publish_draft`, `unpublish_post`, and `delete_draft` are unchanged and still require an explicit request.

## Security

- View components are an allowlist compiled into the site. JSON cannot choose a module path or a function body.
- Parameters are numbers. The component clamps them.
- Markdown is rendered without `rehype-raw`, so raw HTML in a note stays text.
- SVG is drawn by the components from numbers and plain text. Author SVG markup, `path`, images, and links are rejected.
- Titles, labels, and summaries cannot contain markup or `javascript:` URLs.
- Studio writes require the owner session or the studio MCP credential. Delete and publish require `confirm: true`.

## Workflow

1. In ChatGPT, call `preview_artifact` before saving.
2. `create_artifact` or `update_artifact`.
3. `attach_artifact` with the note's draft id, or insert the fence from the Studio demo composer.
4. Read the preview in Studio. The article is still a draft.
5. Publish only after an explicit request.

The Studio composer can edit a carrier-pool figure, preview it with the same component the article uses, and insert the fence. Other view types can be previewed and inserted there; their JSON is created through MCP.

## Extending the catalog

A future note about garbage collection, Kafka partitions, distributed tracing, circuit breakers, HTTP connection pools, database replication, or retries should first try an existing view: an architecture or flowchart for structure, a sequence for a protocol, frames for a walk-through, a callout for the invariant, and code-compare for a diff.

A new simulation needs a new allowlisted `view.type` and a React component in this repository. Authors still send JSON. They do not send code.
