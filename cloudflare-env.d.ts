// Local secrets live in .env (see .env.example). `pnpm dev` copies them onto the Worker.
// Production secrets are set on the mohammed-java-casebook Worker:
// GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, SESSION_SECRET, GITHUB_CONTENT_TOKEN, INDEXNOW_KEY, WEB_BOT_AUTH_PRIVATE_JWK, STUDIO_MCP_KEY, UMAMI_BASE_URL, UMAMI_WEBSITE_ID, UMAMI_API_KEY
//
// Storage bindings are attached during local dev. A production build attaches them
// only when CLOUDFLARE_D1_ID is set, so a deploy without that database is unchanged.
// Create them with:
//   wrangler d1 create portfolio-blog
//   wrangler r2 bucket create portfolio-blog-media

declare namespace Cloudflare {
  interface AuthRateLimit {
    limit(options: {key: string}): Promise<{success: boolean}>;
  }

  interface Env {
    DB?: D1Database;
    MEDIA?: R2Bucket;
    AUTH_RATE_LIMIT?: AuthRateLimit;
    TOKEN_RATE_LIMIT?: AuthRateLimit;
    GITHUB_CLIENT_ID?: string;
    GITHUB_CLIENT_SECRET?: string;
    SESSION_SECRET?: string;
    GITHUB_CONTENT_TOKEN?: string;
    INDEXNOW_KEY?: string;
    WEB_BOT_AUTH_PRIVATE_JWK?: string;
    STUDIO_MCP_KEY?: string;
    UMAMI_BASE_URL?: string;
    UMAMI_WEBSITE_ID?: string;
    UMAMI_API_KEY?: string;
  }
}
