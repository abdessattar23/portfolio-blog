import type {Metadata} from 'next';
import {buildPageMetadata, buildProfilePageJsonLd, serializeJsonLd} from '../lib/seo';
import {SITE, formatUtcDate} from '../lib/site';
import {livePublishedPosts, liveTalks, liveWorkCases} from '../lib/studio/published';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = buildPageMetadata({
  description: SITE.bio,
  path: '/',
  type: 'profile',
  includeIdentityKeywords: true,
});

export default async function Home() {
  const [publishedPosts, contributions, talks] = await Promise.all([
    livePublishedPosts(),
    liveWorkCases(),
    liveTalks(),
  ]);
  const latestPost = publishedPosts[0];
  const featuredTalk = talks.find((talk) => talk.status === 'Delivered') ?? talks[0];

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{__html: serializeJsonLd(buildProfilePageJsonLd('/'))}}
      />
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Observability · Java · JVM</p>
          <h1>{SITE.name}</h1>
          <p className="hero-lead">
            I want the mechanism. How it works, not the brochure for what it does.
          </p>
          <p className="hero-detail">
            Mostly <span>observability, Java, the JVM, open source, and AI.</span>
          </p>
          <div className="social-links">
            <a href={SITE.github} rel="me">GitHub</a>
            <a href={SITE.linkedin} rel="me">LinkedIn</a>
          </div>
        </div>
        <figure className="hero-art">
          <img
            src="/mohammed-figurine.png"
            alt={`${SITE.fullName} (${SITE.handle}), writing on observability, Java, and the JVM`}
            width="1024"
            height="1536"
          />
          <figcaption>small me, big rabbit holes.</figcaption>
          <blockquote className="hero-quote">
            <p>Act like the bug is already beaten. Then do the work that makes it true.</p>
          </blockquote>
        </figure>
      </section>
      <div className="home-grid">
        <div className="home-main">
          <section className="latest" aria-labelledby="latest-heading">
            <div className="home-section-heading">
              <h2 id="latest-heading">Latest writing</h2>
              <div className="home-section-actions">
                <a href="/blog">All posts</a>
                <a href={SITE.rss}>RSS</a>
              </div>
            </div>
            {latestPost && (
              <article className="featured-post">
                <div className="post-meta">
                  <time dateTime={latestPost.publishedAt}>{formatUtcDate(latestPost.publishedAt)}</time>
                  <span>{latestPost.topics.join(' / ')}</span>
                </div>
                <h3>
                  <a href={`/blog/${latestPost.slug}`}>{latestPost.title}</a>
                </h3>
                <p>{latestPost.excerpt}</p>
                {latestPost.homeDiff && (
                  <div className="mini-diff" aria-label="Simplified change">
                    <code className="removed">− {latestPost.homeDiff.removed}</code>
                    <code className="added">+ {latestPost.homeDiff.added}</code>
                  </div>
                )}
                <a className="text-link" href={`/blog/${latestPost.slug}`}>Read the note →</a>
              </article>
            )}
          </section>
        </div>
        <aside className="home-sidebar">
          <section aria-labelledby="oss-heading">
            <h2 id="oss-heading">Open source</h2>
            <p className="sidebar-intro">Selected OpenTelemetry Java contributions</p>
            <div className="contribution-list">
              {contributions.map((c) => (
                <a href={`/work/${c.slug}`} key={c.slug}>
                  <span className="pr-number">#{c.number}</span>
                  <span>{c.shortTitle}</span>
                  <small>Merged</small>
                </a>
              ))}
            </div>
            <a className="text-link" href="/work">All contributions →</a>
          </section>
          {featuredTalk && (
            <section className="speaking-summary" aria-labelledby="speaking-heading">
              <h2 id="speaking-heading">Speaking</h2>
              <p className="event-meta">{featuredTalk.event}</p>
              <h3>{featuredTalk.title}</h3>
              <a className="text-link" href="/speaking">Talk details →</a>
            </section>
          )}
        </aside>
      </div>
    </>
  );
}
