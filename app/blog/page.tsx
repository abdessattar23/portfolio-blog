import type {Metadata} from 'next';
import {buildPageMetadata} from '../../lib/seo';
import {SITE, formatUtcDate} from '../../lib/site';
import {livePublishedPosts, liveSiteSettings} from '../../lib/studio/published';

export const dynamic = 'force-dynamic';

export async function generateMetadata(): Promise<Metadata> {
  const site = await liveSiteSettings();
  return buildPageMetadata({
    title: 'Blog',
    description: `Notes on how Java, the JVM, and observability work, by ${site.fullName} (${site.handle}).`,
    path: '/blog',
    site,
  });
}

export default async function Blog() {
  const publishedPosts = await livePublishedPosts();
  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">THE BLOG / TECHNICAL NOTES</div>
        <h1>Follow the reasoning<span>.</span></h1>
        <p>Observability, Java, the JVM, and the mechanics underneath the feature list.</p>
        <a className="text-link" href={SITE.rss}>Subscribe with RSS ↗</a>
      </section>
      <div className="blog-list">
        {publishedPosts.map((post) => (
          <article className="blog-entry" key={post.slug}>
            <div className="eyebrow">
              <time dateTime={post.publishedAt}>{formatUtcDate(post.publishedAt)}</time>
              <br />
              <br />
              {post.topics.join(' · ')}
            </div>
            <div>
              <h2>
                <a href={`/blog/${post.slug}`}>{post.title} ↗</a>
              </h2>
              <p>{post.excerpt}</p>
              <a className="text-link" href={`/blog/${post.slug}`}>Read the note →</a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
