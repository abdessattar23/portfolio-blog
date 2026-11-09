# Mohammed Elyagoubi — Java casebook

Source for my personal portfolio and Java technical blog. The site focuses on backend engineering, OpenTelemetry Java contributions, technical writing, and speaking evidence.

## Run locally

Requires Node.js 22.13 or newer and pnpm 11.

```text
pnpm install
pnpm dev
```

## Create a blog post

```text
npm run new:post -- "Your article title"
```

The generator asks for a template and writes a hidden Markdown draft. Published posts show up on the homepage, the blog index, the article route, and the RSS feed. See [BLOGGING.md](./BLOGGING.md).

## Build

```text
pnpm build
```

The application uses Next.js, React, TypeScript, and Vinext for Cloudflare deployment.

## License

The source code is available under the [MIT License](./LICENSE). Personal likeness assets are excluded from that license; see [ASSET_LICENSE.md](./ASSET_LICENSE.md).
