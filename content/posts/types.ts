import type {ComponentType} from 'react';

export type PostSection = {
  id: string;
  title: string;
};

export type BlogPost = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  topics: string[];
  sections: PostSection[];
  Content?: ComponentType;
  body?: string;
  draft?: boolean;
  homeDiff?: {
    removed: string;
    added: string;
  };
};
