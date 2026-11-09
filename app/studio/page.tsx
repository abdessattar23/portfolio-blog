import {listDrafts, type Draft} from '../../lib/studio/drafts';
import {livePosts, liveTalks, liveWorkCases} from '../../lib/studio/published';
import {seoHealth} from '../../lib/studio/seo';
import {NewTalkForm} from './new-talk-form';

export const dynamic = 'force-dynamic';

const DESTINATIONS = {
  post: 'posts',
  work: 'work',
  talk: 'talks',
  site: 'settings',
} as const;

function editing(drafts: Draft[], kind: Draft['kind'], slug: string): Draft | undefined {
  return drafts.find((draft) => draft.kind === kind && draft.slug === slug);
}

function countWords(text: string): number {
  const cleaned = text.trim();
  if (!cleaned) return 0;
  return cleaned.split(/\s+/).length;
}

function draftTitle(draft: Draft): string {
  try {
    const parsed: unknown = JSON.parse(draft.frontmatter);
    if (typeof parsed === 'object' && parsed !== null && 'title' in parsed && typeof parsed.title === 'string' && parsed.title.trim()) {
      return parsed.title.trim();
    }
  } catch {
    // ignore
  }
  return draft.slug;
}

export default async function StudioHome() {
  let drafts: Draft[] = [];
  let storageError = '';
  try {
    drafts = await listDrafts();
  } catch (error) {
    storageError = error instanceof Error ? error.message : 'Storage is unavailable.';
  }
  const [posts, workCases, talks] = await Promise.all([
    livePosts(),
    liveWorkCases(),
    liveTalks(),
  ]);

  const totalPublishedWords = posts
    .filter((p) => !p.draft)
    .reduce((sum, p) => sum + countWords(p.body), 0);

  const primaryDraft = drafts[0];

  return (
    <div className="atelier-desk">
      {/* Desk Hero / Lamp Welcome */}
      <section className="desk-hero">
        <div className="desk-hero-copy">
          <div className="eyebrow">WRITING SANCTUARY · ATELIER</div>
          <h1>
            Quiet desk, sharp ink<span>.</span>
          </h1>
          <p>
            Every draft rests privately in edge storage until you publish. Publishing updates the live casebook immediately and commits cleanly to GitHub.
          </p>
        </div>

        <div className="desk-stats-bar">
          <div className="desk-stat">
            <span>Active drafts</span>
            <strong>{drafts.length}</strong>
          </div>
          <div className="desk-stat">
            <span>Published essays</span>
            <strong>{posts.filter((p) => !p.draft).length}</strong>
          </div>
          <div className="desk-stat">
            <span>Published words</span>
            <strong>{totalPublishedWords.toLocaleString('en-US')}</strong>
          </div>
          <div className="desk-stat">
            <span>Cases & talks</span>
            <strong>{workCases.length + talks.length}</strong>
          </div>
        </div>
      </section>

      {storageError ? <p className="studio-alert">{storageError}</p> : null}

      {/* Top Split: Continue Writing + Start Fresh Manuscript */}
      <div className="desk-top-grid">
        <section className="desk-card desk-card-spotlight">
          <div className="desk-card-eyebrow">
            <span className="binder-status-dot" data-state="draft" />
            <span>{primaryDraft ? 'ON THE DESK RIGHT NOW' : 'DESK IS CLEAR'}</span>
          </div>
          {primaryDraft ? (
            <>
              <h2>{draftTitle(primaryDraft)}</h2>
              <p className="desk-card-meta">
                <code>{primaryDraft.slug}</code> · {primaryDraft.kind} ·{' '}
                {primaryDraft.body ? `${countWords(primaryDraft.body)} words · ` : ''}
                saved {new Date(primaryDraft.updatedAt).toLocaleString('en-GB', {timeZone: 'UTC'})} UTC
              </p>
              {primaryDraft.body ? (
                <blockquote className="desk-excerpt">
                  {primaryDraft.body.replace(/^[#>*`\s-]+/gm, '').slice(0, 200)}
                  {primaryDraft.body.length > 200 ? '…' : ''}
                </blockquote>
              ) : null}
              <div className="desk-card-actions">
                <a
                  className="atelier-btn-primary"
                  href={
                    primaryDraft.kind === 'site'
                      ? '/studio/settings'
                      : `/studio/${DESTINATIONS[primaryDraft.kind]}/${primaryDraft.id}`
                  }
                >
                  Resume manuscript →
                </a>
                <form action={`/api/studio/drafts/${primaryDraft.id}`} method="post">
                  <input type="hidden" name="_action" value="delete" />
                  <button type="submit" className="atelier-btn-ghost">
                    Discard draft
                  </button>
                </form>
              </div>
            </>
          ) : (
            <>
              <h2>Ready for the next deep dive.</h2>
              <p className="desk-card-meta">
                You have no uncommitted drafts in D1. Start a fresh note on the right or open any existing article below to revise it.
              </p>
            </>
          )}
        </section>

        <section className="desk-card desk-card-compose">
          <div className="desk-card-eyebrow">
            <span>NEW MANUSCRIPT</span>
          </div>
          <h2>Start a fresh note</h2>
          <p className="desk-card-meta">
            Pick a permanent lowercase slug. Opens immediately in the distraction-free editor.
          </p>
          <form className="desk-new-form" action="/api/studio/drafts" method="post">
            <input type="hidden" name="kind" value="post" />
            <label className="desk-slug-field">
              <span>Slug</span>
              <div className="atelier-slug-input">
                <span>/blog/</span>
                <input
                  name="slug"
                  required
                  pattern="[a-z0-9-]+"
                  placeholder="my-new-note"
                />
              </div>
            </label>
            <button type="submit" className="atelier-btn-primary">
              Open draft →
            </button>
          </form>
        </section>
      </div>

      {/* All Active Drafts if > 0 */}
      {drafts.length > 0 ? (
        <section className="desk-section">
          <div className="desk-section-header">
            <div>
              <span className="eyebrow">UNPUBLISHED WORK IN PROGRESS</span>
              <h2>Active drafts ({drafts.length})</h2>
            </div>
          </div>
          <div className="desk-grid-list">
            {drafts.map((draft) => {
              const href =
                draft.kind === 'site'
                  ? '/studio/settings'
                  : `/studio/${DESTINATIONS[draft.kind]}/${draft.id}`;
              const words = countWords(draft.body);
              return (
                <article className="desk-item-card" key={draft.id}>
                  <div className="desk-item-main">
                    <div className="desk-item-badges">
                      <span className="atelier-badge" data-tone="amber">
                        {draft.kind} draft
                      </span>
                      <code>{draft.slug}</code>
                      {words > 0 ? <span>{words} words</span> : null}
                    </div>
                    <h3>
                      <a href={href}>{draftTitle(draft)}</a>
                    </h3>
                    <p>
                      Last touched {new Date(draft.updatedAt).toLocaleString('en-GB', {timeZone: 'UTC'})} UTC
                    </p>
                  </div>
                  <div className="desk-item-actions">
                    <a className="atelier-btn-secondary" href={href}>
                      Continue →
                    </a>
                    <form action={`/api/studio/drafts/${draft.id}`} method="post">
                      <input type="hidden" name="_action" value="delete" />
                      <button type="submit" className="atelier-btn-ghost">
                        Discard
                      </button>
                    </form>
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ) : null}

      {/* Essays & Technical Notes */}
      <section className="desk-section">
        <div className="desk-section-header">
          <div>
            <span className="eyebrow">ARCHIVE & PUBLISHED CORPUS</span>
            <h2>Essays & technical notes ({posts.length})</h2>
          </div>
        </div>
        <div className="desk-grid-list">
          {posts.map((post) => {
            const warnings = seoHealth(post).filter((item) => item.level === 'warn');
            const openDraft = editing(drafts, 'post', post.slug);
            const words = countWords(post.body);
            const mins = Math.max(1, Math.round(words / 220));
            return (
              <article className="desk-item-card" key={post.slug}>
                <div className="desk-item-main">
                  <div className="desk-item-badges">
                    <span className="atelier-badge" data-tone={post.draft ? 'muted' : 'green'}>
                      {post.draft ? 'Hidden file' : 'Published'}
                    </span>
                    <span className="atelier-badge" data-tone="neutral">
                      {post.template}
                    </span>
                    {openDraft ? (
                      <span className="atelier-badge" data-tone="amber">
                        Editing in D1
                      </span>
                    ) : null}
                    <span
                      className="atelier-badge"
                      data-tone={warnings.length > 0 ? 'warn' : 'ok'}
                    >
                      {warnings.length > 0
                        ? `${warnings.length} SEO note${warnings.length === 1 ? '' : 's'}`
                        : 'SEO crisp'}
                    </span>
                  </div>
                  <h3>{post.title}</h3>
                  <p>
                    {post.description}
                  </p>
                  <div className="desk-item-foot">
                    <span>{words.toLocaleString('en-US')} words · ~{mins} min read</span>
                    <span>·</span>
                    <span>Updated {post.updatedAt}</span>
                    <span>·</span>
                    <span>{post.topics.join(', ')}</span>
                  </div>
                </div>
                <div className="desk-item-actions">
                  {openDraft ? (
                    <a className="atelier-btn-secondary" href={`/studio/posts/${openDraft.id}`}>
                      Resume draft →
                    </a>
                  ) : (
                    <form action="/api/studio/drafts" method="post">
                      <input type="hidden" name="kind" value="post" />
                      <input type="hidden" name="slug" value={post.slug} />
                      <button type="submit" className="atelier-btn-secondary">
                        Edit manuscript
                      </button>
                    </form>
                  )}
                  {!post.draft ? (
                    <a className="atelier-btn-ghost" href={`/blog/${post.slug}`} target="_blank" rel="noreferrer">
                      View ↗
                    </a>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      {/* Open Source + Talks + Site Settings */}
      <div className="desk-bottom-columns">
        <section className="desk-section">
          <div className="desk-section-header">
            <div>
              <span className="eyebrow">EVIDENCE</span>
              <h2>Open source cases ({workCases.length})</h2>
            </div>
          </div>
          <div className="desk-compact-list">
            {workCases.map((work) => {
              const openDraft = editing(drafts, 'work', work.slug);
              return (
                <article className="desk-compact-row" key={work.slug}>
                  <div>
                    <div className="desk-item-badges">
                      <code>#{work.number}</code>
                      <span>{work.topic}</span>
                      {openDraft ? (
                        <span className="atelier-badge" data-tone="amber">
                          editing
                        </span>
                      ) : null}
                    </div>
                    <strong>{work.title}</strong>
                  </div>
                  {openDraft ? (
                    <a className="atelier-btn-secondary" href={`/studio/work/${openDraft.id}`}>
                      Resume
                    </a>
                  ) : (
                    <form action="/api/studio/drafts" method="post">
                      <input type="hidden" name="kind" value="work" />
                      <input type="hidden" name="slug" value={work.slug} />
                      <button type="submit" className="atelier-btn-secondary">
                        Edit
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>
        </section>

        <section className="desk-section">
          <div className="desk-section-header">
            <div>
              <span className="eyebrow">STAGE & CONFERENCES</span>
              <h2>Talks ({talks.length})</h2>
            </div>
          </div>
          <NewTalkForm compact />
          <div className="desk-compact-list">
            {talks.map((talk) => {
              const openDraft = editing(drafts, 'talk', talk.slug);
              return (
                <article className="desk-compact-row" key={talk.slug}>
                  <div>
                    <div className="desk-item-badges">
                      <span className="atelier-badge" data-tone="neutral">
                        {talk.status}
                      </span>
                      <span>{talk.event}</span>
                      {openDraft ? (
                        <span className="atelier-badge" data-tone="amber">
                          editing
                        </span>
                      ) : null}
                    </div>
                    <strong>{talk.title}</strong>
                  </div>
                  {openDraft ? (
                    <a className="atelier-btn-secondary" href={`/studio/talks/${openDraft.id}`}>
                      Resume
                    </a>
                  ) : (
                    <form action="/api/studio/drafts" method="post">
                      <input type="hidden" name="kind" value="talk" />
                      <input type="hidden" name="slug" value={talk.slug} />
                      <button type="submit" className="atelier-btn-secondary">
                        Edit
                      </button>
                    </form>
                  )}
                </article>
              );
            })}
          </div>

          <div className="desk-settings-callout">
            <div>
              <span className="eyebrow">SITE IDENTITY</span>
              <strong>Author profile & metadata</strong>
              <p>Bio, employer, role, social links, and JSON-LD graph topics.</p>
            </div>
            <form action="/api/studio/drafts" method="post">
              <input type="hidden" name="kind" value="site" />
              <input type="hidden" name="slug" value="site" />
              <button type="submit" className="atelier-btn-secondary">
                Edit settings
              </button>
            </form>
          </div>
        </section>
      </div>
    </div>
  );
}
