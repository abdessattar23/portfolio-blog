import {posts, talks, workCases} from '../../lib/content/load';
import {listDrafts, type Draft} from '../../lib/studio/drafts';

export const dynamic = 'force-dynamic';

function editing(drafts: Draft[], kind: Draft['kind'], slug: string) {
  return drafts.some((draft) => draft.kind === kind && draft.slug === slug);
}

export default async function StudioHome() {
  let drafts: Draft[] = [];
  let storageError = '';
  try {
    drafts = await listDrafts();
  } catch (error) {
    storageError = error instanceof Error ? error.message : 'Storage is unavailable.';
  }

  return (
    <>
      <section className="page-intro">
        <div className="eyebrow">STUDIO</div>
        <h1>The desk<span>.</span></h1>
        <p>Drafts stay here until you publish them. Publishing writes one commit and the site rebuilds.</p>
      </section>
      {storageError ? <p className="studio-alert">{storageError}</p> : null}
      <section className="studio-section">
        <h2>New post</h2>
        <form className="studio-inline" action="/api/studio/drafts" method="post">
          <input type="hidden" name="kind" value="post" />
          <label>Slug <input name="slug" required pattern="[a-z0-9-]+" placeholder="my-new-note" /></label>
          <button type="submit">Open draft</button>
        </form>
      </section>
      <section className="studio-section">
        <h2>Posts</h2>
        {posts.map((post) => (
          <article className="studio-row" key={post.slug}>
            <div>
              <strong>{post.title}</strong>
              <p>{post.draft ? 'Unpublished file' : 'Published'}{editing(drafts, 'post', post.slug) ? ' · editing' : ''} · {post.template}</p>
            </div>
            <form action="/api/studio/drafts" method="post">
              <input type="hidden" name="kind" value="post" />
              <input type="hidden" name="slug" value={post.slug} />
              <button type="submit">Edit</button>
            </form>
          </article>
        ))}
      </section>
      <section className="studio-section">
        <h2>Open source</h2>
        {workCases.map((work) => (
          <article className="studio-row" key={work.slug}>
            <div><strong>{work.title}</strong><p>#{work.number}{editing(drafts, 'work', work.slug) ? ' · editing' : ''}</p></div>
            <form action="/api/studio/drafts" method="post">
              <input type="hidden" name="kind" value="work" />
              <input type="hidden" name="slug" value={work.slug} />
              <button type="submit">Edit</button>
            </form>
          </article>
        ))}
      </section>
      <section className="studio-section">
        <h2>Site settings</h2>
        <form action="/api/studio/drafts" method="post">
          <input type="hidden" name="kind" value="site" />
          <input type="hidden" name="slug" value="site" />
          <button type="submit">Edit settings</button>
        </form>
      </section>
      <section className="studio-section">
        <h2>Talks</h2>
        {talks.map((talk) => (
          <article className="studio-row" key={talk.slug}>
            <div><strong>{talk.title}</strong><p>{talk.status}{editing(drafts, 'talk', talk.slug) ? ' · editing' : ''}</p></div>
            <form action="/api/studio/drafts" method="post">
              <input type="hidden" name="kind" value="talk" />
              <input type="hidden" name="slug" value={talk.slug} />
              <button type="submit">Edit</button>
            </form>
          </article>
        ))}
      </section>
    </>
  );
}
