# Mohammed Elyagoubi — Java casebook

Source for my site. The writing is about observability, Java, the JVM, open source, and AI: how a system works, not the brochure for what it does. The casebook documents OpenTelemetry Java contributions with the code and the tests.

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
