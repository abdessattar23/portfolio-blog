import type {CSSProperties, ReactNode} from 'react';
import {isDuplicateOpeningSection} from '../../lib/content/headings';
import type {PostDocument} from '../../lib/content/schema';
import {formatUtcDate} from '../../lib/site';
import {ArticleStickers} from '../article-stickers';

export function PostTemplate({post, children}: {post: PostDocument; children: ReactNode}) {
  const style = {
    ...(post.accent !== undefined ? {'--post-accent': post.accent} : {}),
  } as CSSProperties;
  const sections = post.sections.filter((_section, index) => !isDuplicateOpeningSection(post.sections, index, post.title));
  const contents = sections.map((section) => <a key={section.id} href={`#${section.id}`}>{section.title}</a>);

  return (
    <div className="template" data-template={post.template} data-skin={post.skin ?? 'plain'} style={style}>
      <section className="page-intro">
        <a className="back" href="/blog">All writing</a>
        <div className="eyebrow">
          {post.template === 'talk-notes' ? 'Talk notes · ' : ''}
          {post.topics.join(' · ')}
          <span className="article-date"><time dateTime={post.publishedAt}>{formatUtcDate(post.publishedAt, 'long')}</time></span>
        </div>
        <h1>{post.title}</h1>
        <p>{post.description}</p>
      </section>
      {post.bannerImage ? (
        <figure className="article-banner">
          <img src={post.bannerImage} alt={post.bannerAlt ?? post.title} loading="eager" decoding="async" />
        </figure>
      ) : null}
      <div className="article-layout">
        {post.stickers && post.stickers.length > 0 ? <ArticleStickers slug={post.slug} stickers={post.stickers} /> : null}
        {sections.length > 1 ? (
          <details className="article-contents-mobile">
            <summary>On this page</summary>
            <nav aria-label="Article contents">{contents}</nav>
          </details>
        ) : null}
        <article className="prose" data-article-body>{children}</article>
        {sections.length > 1 && post.template !== 'til' ? (
          <aside className="article-contents">
            <div className="eyebrow">On this page</div>
            <nav aria-label="Article contents">{contents}</nav>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
