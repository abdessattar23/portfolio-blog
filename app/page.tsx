import {publishedPosts} from '../content/posts';
import {contributions} from '../lib/contributions';
import {SITE, formatUtcDate} from '../lib/site';

export default function Home() {
  const latestPost = publishedPosts[0];

  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <p className="kicker">Java · OpenTelemetry · Rabat</p>
          <h1>{SITE.name}</h1>
          <p className="hero-lead">
            I work on Java backends, contribute to OpenTelemetry, and write about the bugs hiding between abstractions.
          </p>
          <p className="hero-detail">
            Mostly interested in the <span>bugs hiding between abstractions.</span>
          </p>
          <div className="social-links">
            <a href={SITE.github}>GitHub</a>
            <a href={SITE.linkedin}>LinkedIn</a>
          </div>
        </div>
        <figure className="hero-art">
          <img
            src="/mohammed-figurine.png"
            alt="A miniature of Mohammed in a navy suit, based on his portrait, standing on a clear display base"
            width="1024"
            height="1536"
          />
          <figcaption>small me, big rabbit holes.</figcaption>
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
          <section className="speaking-summary" aria-labelledby="speaking-heading">
            <h2 id="speaking-heading">Speaking</h2>
            <p className="event-meta">Devoxx Morocco · 2026</p>
            <h3>The Future of Open Source Has New Faces</h3>
            <a className="text-link" href="/speaking">Talk details →</a>
          </section>
        </aside>
      </div>
    </>
  );
}
