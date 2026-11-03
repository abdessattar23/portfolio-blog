import {pooledHashMapPost} from './pooled-hashmap';
// new-post-import

import type {BlogPost} from './types';

export const allPosts: BlogPost[] = [
  pooledHashMapPost,
  // new-post-entry
];

export const publishedPosts = allPosts
  .filter((post) => !post.draft)
  .sort((left, right) => right.publishedAt.localeCompare(left.publishedAt));

export function getPublishedPost(slug: string) {
  return publishedPosts.find((post) => post.slug === slug);
}
