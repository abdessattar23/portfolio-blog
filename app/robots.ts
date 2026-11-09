import type {MetadataRoute} from 'next';
import {SITE} from '../lib/site';

const EXPLICIT_BOTS = [
  'Googlebot',
  'Bingbot',
  'GPTBot',
  'OAI-SearchBot',
  'ChatGPT-User',
  'ClaudeBot',
  'Claude-Web',
  'PerplexityBot',
  'Google-Extended',
  'Applebot-Extended',
  'CCBot',
] as const;

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/studio', '/api/'],
      },
      ...EXPLICIT_BOTS.map((bot) => ({
        userAgent: bot,
        allow: '/',
        disallow: ['/studio', '/api/'],
      })),
    ],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
