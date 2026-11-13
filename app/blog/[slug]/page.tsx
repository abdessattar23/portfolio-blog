import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {publishedPosts} from '../../../content/posts';
import {ArticleEngagement} from '../../../components/article-engagement';
import {PostTemplate} from '../../../components/templates/post-template';
import {artifactsForMarkdown} from '../../../lib/artifacts/resolve';
import {MarkdownView} from '../../../lib/content/render';
import {postSearchTitle} from '../../../lib/content/schema';
import {buildBlogPostJsonLd, buildPageMetadata, serializeJsonLd} from '../../../lib/seo';
import {livePublishedPost, liveSiteSettings} from '../../../lib/studio/published';

export const dynamic = 'force-dynamic';

type BlogPostPageProps = {params: Promise<{slug: string}>};

export function generateStaticParams() {
  return publishedPosts.map((post) => ({slug: post.slug}));
}

export async function generateMetadata({params}: BlogPostPageProps): Promise<Metadata> {
  const {slug} = await params;
  const [post, site] = await Promise.all([livePublishedPost(slug), liveSiteSettings()]);
  if (!post) return {};
  return buildPageMetadata({
    title: postSearchTitle(post),
    description: post.description,
    path: `/blog/${post.slug}`,
    type: 'article',
    publishedTime: post.publishedAt,
    keywords: post.topics,
    site,
    image: post.bannerImage
      ? {url: post.bannerImage, width: 1200, height: 675, alt: post.bannerAlt ?? post.title}
      : {url: `/og/${post.slug}`, width: 1200, height: 630, alt: post.title},
  });
}

export default async function BlogPostPage({params}: BlogPostPageProps) {
  const {slug} = await params;
  const [post, site] = await Promise.all([livePublishedPost(slug), liveSiteSettings()]);
  if (!post) return notFound();
  const artifacts = await artifactsForMarkdown(post.body);

  const words = post.body.trim() ? post.body.trim().split(/\s+/).length : 0;
  const estimatedReadingMinutes = Math.max(1, Math.round(words / 220));

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: serializeJsonLd(buildBlogPostJsonLd(post, site))}}
      />
      <ArticleEngagement
        slug={post.slug}
        title={post.title}
        topics={post.topics.join(', ')}
        estimatedReadingMinutes={estimatedReadingMinutes}
      />
      <PostTemplate post={post}>
        <MarkdownView markdown={post.body} title={post.title} artifacts={artifacts} />
      </PostTemplate>
    </>
  );
}
