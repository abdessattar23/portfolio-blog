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

The generator creates a hidden draft and registers it with the homepage, blog index, article route, and RSS feed. Edit the generated file, then set `draft` to `false` when it is ready. See [BLOGGING.md](./BLOGGING.md) for the full workflow.

## Build

```text
pnpm build
```

The application uses Next.js, React, TypeScript, and Vinext for Cloudflare deployment.

## License

The source code is available under the [MIT License](./LICENSE). Personal likeness assets are excluded from that license; see [ASSET_LICENSE.md](./ASSET_LICENSE.md).
