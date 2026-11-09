import {cloudflare} from '@cloudflare/vite-plugin';
import vinext from 'vinext';
import {defineConfig} from 'vite';

const localDatabaseId = '00000000-0000-0000-0000-000000000001';

export default defineConfig(({command}) => {
  const databaseId = process.env.CLOUDFLARE_D1_ID;
  const attachStorage = command === 'serve' || Boolean(databaseId);

  return {
    plugins: [
      vinext(),
      cloudflare({
        viteEnvironment: {name: 'rsc', childEnvironments: ['ssr']},
        inspectorPort: false,
        config: {
          main: './worker/index.ts',
          compatibility_flags: ['nodejs_compat'],
          ...(attachStorage
            ? {
                d1_databases: [
                  {
                    binding: 'DB',
                    database_name: 'portfolio-blog',
                    database_id: databaseId ?? localDatabaseId,
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
