import type {MetadataRoute} from 'next';
import {publishedPosts} from '../content/posts';
import {contributions} from '../lib/contributions';
import {SITE} from '../lib/site';

export default function sitemap(): MetadataRoute.Sitemap {
  const latestPostDate = publishedPosts[0]?.publishedAt
    ? new Date(`${publishedPosts[0].publishedAt}T00:00:00Z`)
    : new Date('2026-11-08T00:00:00Z');

  const staticRoutes: MetadataRoute.Sitemap = [
    {url: SITE.url, lastModified: latestPostDate, changeFrequency: 'weekly', priority: 1.0},
    {url: `${SITE.url}/blog`, lastModified: latestPostDate, changeFrequency: 'weekly', priority: 0.9},
    {url: `${SITE.url}/work`, lastModified: latestPostDate, changeFrequency: 'monthly', priority: 0.9},
    {url: `${SITE.url}/speaking`, lastModified: latestPostDate, changeFrequency: 'monthly', priority: 0.8},
    {url: `${SITE.url}/about`, lastModified: latestPostDate, changeFrequency: 'monthly', priority: 0.9},
    {url: `${SITE.url}${SITE.llms}`, lastModified: latestPostDate, changeFrequency: 'weekly', priority: 0.7},
    {url: `${SITE.url}${SITE.llmsFull}`, lastModified: latestPostDate, changeFrequency: 'weekly', priority: 0.7},
  ];

  const postRoutes: MetadataRoute.Sitemap = publishedPosts.map((post) => ({
    url: `${SITE.url}/blog/${post.slug}`,
    lastModified: new Date(`${post.publishedAt}T00:00:00Z`),
    changeFrequency: 'monthly',
    priority: 0.85,
  }));

  const workRoutes: MetadataRoute.Sitemap = contributions.map((c) => ({
    url: `${SITE.url}/work/${c.slug}`,
    lastModified: latestPostDate,
    changeFrequency: 'monthly',
    priority: 0.85,
  }));

  return [...staticRoutes, ...postRoutes, ...workRoutes];
}
