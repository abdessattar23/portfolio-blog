// Local secrets live in .env (see .env.example). `pnpm dev` copies them onto the Worker.
// Production secrets are set on the mohammed-java-casebook Worker:
// GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, GITHUB_CONTENT_TOKEN, INDEXNOW_KEY
//
// Storage bindings are attached during local dev. A production build attaches them
// only when CLOUDFLARE_D1_ID is set, so a deploy without that database is unchanged.
// Create them with:
//   wrangler d1 create portfolio-blog
//   wrangler r2 bucket create portfolio-blog-media

interface StudioEnv {
  DB?: D1Database;
  MEDIA?: R2Bucket;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  SESSION_SECRET?: string;
  GITHUB_CONTENT_TOKEN?: string;
  INDEXNOW_KEY?: string;
}

declare module 'cloudflare:workers' {
  export const env: StudioEnv;
}
