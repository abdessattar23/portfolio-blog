import type {Metadata} from 'next';
import {publishedPosts} from '../../content/posts';
import {SITE, formatUtcDate} from '../../lib/site';

export const metadata: Metadata = {title: 'Blog'};

export default function Blog() {
  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">THE BLOG / TECHNICAL NOTES</div>
        <h1>Follow the reasoning<span>.</span></h1>
        <p>Java, observability, and the details that change how code behaves.</p>
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
