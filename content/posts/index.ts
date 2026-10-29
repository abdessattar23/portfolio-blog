import type {BlogPost} from './types';

export const allPosts: BlogPost[] = [];

export const publishedPosts = allPosts
  .filter((post) => !post.draft)
  .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

export function getPublishedPost(slug: string) {
  return publishedPosts.find((post) => post.slug === slug);
}
