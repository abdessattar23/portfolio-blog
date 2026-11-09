import type {CSSProperties, ReactNode} from 'react';
import {isDuplicateOpeningSection} from '../../lib/content/headings';
import type {PostDocument} from '../../lib/content/schema';
import {formatUtcDate} from '../../lib/site';
import {ArticleStickers} from '../article-stickers';

const ASIDE_LABEL: Record<PostDocument['template'], string> = {
  'deep-dive': 'In this note',
  'bug-story': 'The case',
  til: 'Note',
  'talk-notes': 'In this talk',
};

export function PostTemplate({post, children}: {post: PostDocument; children: ReactNode}) {
  const style = {
    ...(post.accent !== undefined ? {'--post-accent': post.accent} : {}),
  } as CSSProperties;

  return (
    <div className="template" data-template={post.template} data-skin={post.skin ?? 'plain'} style={style}>
      <section className="page-intro">
        <a className="back" href="/blog">← All writing</a>
        <div className="eyebrow">
          {post.template === 'talk-notes' ? 'Talk notes · ' : ''}
          {post.topics.join(' · ')} / {formatUtcDate(post.publishedAt, 'long')}
        </div>
        <h1>{post.title}<span>.</span></h1>
        <p>{post.description}</p>
      </section>
      <div className="article-layout">
        {post.stickers && post.stickers.length > 0 ? <ArticleStickers slug={post.slug} stickers={post.stickers} /> : null}
        <aside>
          <div className="eyebrow">{ASIDE_LABEL[post.template]}</div>
          {post.sections.flatMap((section, index) => (
            isDuplicateOpeningSection(post.sections, index, post.title)
              ? []
              : [(
                <a key={section.id} href={`#${section.id}`}>
                  {post.template === 'bug-story' ? `0${index + 1} ` : ''}
                  {section.title}
                </a>
              )]
          ))}
        </aside>
        <article className="prose">{children}</article>
      </div>
    </div>
  );
}
