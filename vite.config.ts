import {cloudflare} from '@cloudflare/vite-plugin';
import vinext from 'vinext';
import {defineConfig, loadEnv} from 'vite';

const portfolioBlogDatabaseId = 'ff403fa8-190f-4d84-acb2-3c4c9f007c57';
const secretNames = [
  'GITHUB_CLIENT_ID',
  'GITHUB_CLIENT_SECRET',
  'SESSION_SECRET',
  'GITHUB_CONTENT_TOKEN',
  'INDEXNOW_KEY',
] as const;

export default defineConfig(({command, mode}) => {
  const fileEnv = loadEnv(mode, process.cwd(), '');
  const databaseId = fileEnv.CLOUDFLARE_D1_ID || process.env.CLOUDFLARE_D1_ID || portfolioBlogDatabaseId;
  const attachStorage = true;
  const vars: Record<string, string> = {};
  if (command === 'serve') {
    for (const name of secretNames) {
      const value = fileEnv[name] || process.env[name];
      if (value) vars[name] = value;
    }
  }

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: {name: 'rsc', childEnvironments: ['ssr']},
        inspectorPort: false,
        config: {
          main: './worker/index.ts',
          compatibility_flags: ['nodejs_compat'],
          triggers: {crons: ['*/5 * * * *']},
          ...(Object.keys(vars).length > 0 ? {vars} : {}),
          ...(attachStorage
            ? {
                d1_databases: [
                  {
                    binding: 'DB',
                    database_name: 'portfolio-blog',
                    database_id: databaseId,
                  },
                ],
                r2_buckets: [{binding: 'MEDIA', bucket_name: 'portfolio-blog-media'}],
              }
            : {}),
        },
      }),
    ],
  };
});
