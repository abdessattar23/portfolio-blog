import type {Metadata} from 'next';
import {notFound} from 'next/navigation';
import {getPublishedPost, publishedPosts} from '../../../content/posts';
import {formatUtcDate} from '../../../lib/site';

type BlogPostPageProps = {params: Promise<{slug: string}>};

export function generateStaticParams() {
  return publishedPosts.map((post) => ({slug: post.slug}));
}

export async function generateMetadata({params}: BlogPostPageProps): Promise<Metadata> {
  const {slug} = await params;
  const post = getPublishedPost(slug);
  if (!post) return {};
  return {title: post.title, description: post.description};
}

export default async function BlogPostPage({params}: BlogPostPageProps) {
  const {slug} = await params;
  const post = getPublishedPost(slug);
  if (!post) return notFound();

  const Content = post.Content;

  return (
    <>
      <section className="page-intro">
        <a className="back" href="/blog">← All writing</a>
        <div className="eyebrow">{post.topics.join(' · ')} / {formatUtcDate(post.publishedAt, 'long')}</div>
        <h1>{post.title}<span>.</span></h1>
        <p>{post.description}</p>
      </section>
      <div className="article-layout">
        <aside>
          <div className="eyebrow">IN THIS NOTE</div>
          {post.sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>{section.title}</a>
          ))}
        </aside>
        <article className="prose">
          <Content />
        </article>
      </div>
    </>
  );
}
