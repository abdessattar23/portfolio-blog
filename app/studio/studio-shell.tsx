'use client';

import {useEffect, useMemo, useState} from 'react';
import {usePathname} from 'next/navigation';
import type {DraftKind} from '../../lib/studio/drafts';

export type BinderItem = {
  id: string;
  slug: string;
  title: string;
  kind: DraftKind;
  subtitle: string;
  href?: string | undefined;
  isDraft?: boolean | undefined;
  unpublishedFile?: boolean | undefined;
};

export function StudioShell({
  login,
  storageError,
  drafts,
  posts,
  workCases,
  talks,
  className,
  children,
}: {
  login: string;
  storageError: string;
  drafts: BinderItem[];
  posts: BinderItem[];
  workCases: BinderItem[];
  talks: BinderItem[];
  className?: string;
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const [binderOpen, setBinderOpen] = useState(true);
  const [zenMode, setZenMode] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [paletteQuery, setPaletteQuery] = useState('');
  const [newPostModal, setNewPostModal] = useState(false);
  const [newSlug, setNewSlug] = useState('');
  const [mode, setMode] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const savedBinder = localStorage.getItem('studio:binder');
    if (savedBinder === 'closed') setBinderOpen(false);
    if (localStorage.getItem('studio:mode') === 'dark') setMode('dark');
  }, []);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
        setPaletteQuery('');
      } else if (mod && event.key === '\\') {
        event.preventDefault();
        setBinderOpen((open) => {
          const next = !open;
          localStorage.setItem('studio:binder', next ? 'open' : 'closed');
          return next;
        });
      } else if (mod && event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setZenMode((zen) => !zen);
        window.dispatchEvent(new CustomEvent('studio:zen-toggle'));
      } else if (event.key === 'Escape') {
        if (paletteOpen) setPaletteOpen(false);
        else if (newPostModal) setNewPostModal(false);
        else if (zenMode) setZenMode(false);
      }
    }

    function handleZenEvent(event: Event) {
      const custom = event as CustomEvent<{zen?: boolean}>;
      if (typeof custom.detail?.zen === 'boolean') {
        setZenMode(custom.detail.zen);
      } else {
        setZenMode((z) => !z);
      }
    }

    function handleNewPostEvent() {
      setNewPostModal(true);
    }

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('studio:set-zen', handleZenEvent);
    window.addEventListener('studio:open-new-post', handleNewPostEvent);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('studio:set-zen', handleZenEvent);
      window.removeEventListener('studio:open-new-post', handleNewPostEvent);
    };
  }, [paletteOpen, newPostModal, zenMode]);

  function toggleBinder() {
    setBinderOpen((open) => {
      const next = !open;
      localStorage.setItem('studio:binder', next ? 'open' : 'closed');
      return next;
    });
  }

  const allItems = useMemo(() => {
    const list: {label: string; sub: string; href?: string | undefined; kind?: DraftKind | undefined; slug?: string | undefined; group: string}[] = [
      {label: 'Studio Desk (Overview)', sub: 'Dashboard & writing metrics', href: '/studio', group: 'Navigation'},
      {label: 'Site Identity & Settings', sub: 'content/site.json', href: '/studio/settings', group: 'Navigation'},
      {label: 'View Live Public Site', sub: 'abdessattar.dev', href: '/', group: 'Navigation'},
    ];
    for (const d of drafts) {
      list.push({label: d.title, sub: `Active draft · ${d.slug}`, href: d.href, group: 'Active Drafts'});
    }
    for (const p of posts) {
      list.push({label: p.title, sub: `Post · /blog/${p.slug}`, href: p.href, kind: 'post', slug: p.slug, group: 'Posts'});
    }
    for (const w of workCases) {
      list.push({label: w.title, sub: `Open Source · ${w.subtitle}`, href: w.href, kind: 'work', slug: w.slug, group: 'Open Source'});
    }
    for (const t of talks) {
      list.push({label: t.title, sub: `Talk · ${t.subtitle}`, href: t.href, kind: 'talk', slug: t.slug, group: 'Talks'});
    }
    return list;
  }, [drafts, posts, workCases, talks]);

  const filteredItems = useMemo(() => {
    const q = paletteQuery.trim().toLowerCase();
    if (!q) return allItems;
    return allItems.filter((item) => item.label.toLowerCase().includes(q) || item.sub.toLowerCase().includes(q));
  }, [allItems, paletteQuery]);

  return (
    <div
      className={className ? `studio-atelier ${className}` : 'studio-atelier'}
      data-binder={binderOpen && !zenMode ? 'open' : 'closed'}
      data-zen={zenMode ? 'true' : 'false'}
      data-mode={mode}
    >
      {/* Top thin lamp bar */}
      <header className="atelier-topbar">
        <div className="atelier-topbar-left">
          <button
            type="button"
            className="atelier-icon-btn"
            onClick={toggleBinder}
            title="Toggle library binder (Ctrl+\)"
            aria-label="Toggle library binder"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <line x1="5.5" y1="2.5" x2="5.5" y2="13.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
          <a href="/studio" className="atelier-brand">
            <span className="atelier-brand-dot" aria-hidden="true" />
            <span>Atelier</span>
            <small>/{login}</small>
          </a>
        </div>

        <div className="atelier-topbar-center">
          <button
            type="button"
            className="atelier-cmd-trigger"
            onClick={() => {
              setPaletteOpen(true);
              setPaletteQuery('');
            }}
          >
            <svg width="13" height="13" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <circle cx="7" cy="7" r="4.8" stroke="currentColor" strokeWidth="1.4" />
              <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
            </svg>
            <span>Jump to manuscript, case, or command…</span>
            <kbd>Ctrl K</kbd>
          </button>
        </div>

        <div className="atelier-topbar-right">
          <button
            type="button"
            className="atelier-pill-btn atelier-pill-primary"
            onClick={() => setNewPostModal(true)}
          >
            <span>+ New note</span>
          </button>
          <button
            type="button"
            className="atelier-icon-btn"
            onClick={() => setZenMode((z) => !z)}
            aria-pressed={zenMode}
            title="Zen distraction-free mode (Ctrl+Shift+F)"
          >
            <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <path d="M2.5 6V2.5H6M10 2.5H13.5V6M13.5 10V13.5H10M6 13.5H2.5V10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
          <button
            type="button"
            className="atelier-icon-btn"
            aria-pressed={mode === 'dark'}
            title={mode === 'dark' ? 'Switch studio to light' : 'Switch studio to dark'}
            onClick={() => setMode((current) => {
              const next = current === 'dark' ? 'light' : 'dark';
              localStorage.setItem('studio:mode', next);
              return next;
            })}
          >
            <span aria-hidden="true">{mode === 'dark' ? '☼' : '◐'}</span>
          </button>
          <a href="/" className="atelier-subtle-link" title="View public blog">
            Live site ↗
          </a>
        </div>
      </header>

      {zenMode ? (
        <button
          type="button"
          className="atelier-zen-exit"
          onClick={() => setZenMode(false)}
          title="Exit Zen mode (Esc)"
        >
          Exit Focus · Esc
        </button>
      ) : null}

      <div className="atelier-body">
        {/* Left Binder Sidebar */}
        <aside className="atelier-binder" aria-label="Manuscript binder">
          <div className="binder-scroll">
            <div className="binder-nav-group">
              <a
                href="/studio"
                className="binder-nav-item"
                data-active={pathname === '/studio'}
              >
                <span className="binder-icon">⌂</span>
                <span>Writing Desk</span>
                {drafts.length > 0 ? <span className="binder-count">{drafts.length}</span> : null}
              </a>
              <a
                href="/studio/settings"
                className="binder-nav-item"
                data-active={pathname === '/studio/settings'}
              >
                <span className="binder-icon">⚙</span>
                <span>Site Identity</span>
              </a>
            </div>

            {drafts.length > 0 ? (
              <div className="binder-section">
                <div className="binder-section-head">
                  <span>In Progress</span>
                  <span className="binder-badge-amber">{drafts.length}</span>
                </div>
                <ul className="binder-list">
                  {drafts.map((item) => {
                    const active = item.href ? pathname === item.href : false;
                    return (
                      <li key={item.id}>
                        <a href={item.href} className="binder-leaf" data-active={active}>
                          <span className="binder-status-dot" data-state="draft" title="Active draft in D1" />
                          <div className="binder-leaf-text">
                            <strong>{item.title}</strong>
                            <small>{item.subtitle}</small>
                          </div>
                        </a>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : null}

            <div className="binder-section">
              <div className="binder-section-head">
                <span>Essays & Notes</span>
                <button
                  type="button"
                  className="binder-add-btn"
                  onClick={() => setNewPostModal(true)}
                  title="Start a new post"
                >
                  +
                </button>
              </div>
              <ul className="binder-list">
                {posts.map((post) => {
                  const active = post.href ? pathname === post.href : false;
                  return (
                    <li key={post.slug}>
                      {post.href ? (
                        <a href={post.href} className="binder-leaf" data-active={active}>
                          <span
                            className="binder-status-dot"
                            data-state="draft"
                            title="Currently editing draft"
                          />
                          <div className="binder-leaf-text">
                            <strong>{post.title}</strong>
                            <small>{post.slug} · editing</small>
                          </div>
                        </a>
                      ) : (
                        <form action="/api/studio/drafts" method="post" className="binder-leaf-form">
                          <input type="hidden" name="kind" value="post" />
                          <input type="hidden" name="slug" value={post.slug} />
                          <button type="submit" className="binder-leaf">
                            <span
                              className="binder-status-dot"
                              data-state={post.unpublishedFile ? 'hidden' : 'live'}
                              title={post.unpublishedFile ? 'Unpublished file' : 'Published'}
                            />
                            <div className="binder-leaf-text">
                              <strong>{post.title}</strong>
                              <small>{post.subtitle}</small>
                            </div>
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="binder-section">
              <div className="binder-section-head">
                <span>Open Source Cases</span>
                <span>{workCases.length}</span>
              </div>
              <ul className="binder-list">
                {workCases.map((work) => {
                  const active = work.href ? pathname === work.href : false;
                  return (
                    <li key={work.slug}>
                      {work.href ? (
                        <a href={work.href} className="binder-leaf" data-active={active}>
                          <span className="binder-status-dot" data-state="draft" />
                          <div className="binder-leaf-text">
                            <strong>{work.title}</strong>
                            <small>{work.subtitle} · editing</small>
                          </div>
                        </a>
                      ) : (
                        <form action="/api/studio/drafts" method="post" className="binder-leaf-form">
                          <input type="hidden" name="kind" value="work" />
                          <input type="hidden" name="slug" value={work.slug} />
                          <button type="submit" className="binder-leaf">
                            <span className="binder-status-dot" data-state="live" />
                            <div className="binder-leaf-text">
                              <strong>{work.title}</strong>
                              <small>{work.subtitle}</small>
                            </div>
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>

            <div className="binder-section">
              <div className="binder-section-head">
                <span>Speaking & Talks</span>
                <span>{talks.length}</span>
              </div>
              <ul className="binder-list">
                {talks.map((talk) => {
                  const active = talk.href ? pathname === talk.href : false;
                  return (
                    <li key={talk.slug}>
                      {talk.href ? (
                        <a href={talk.href} className="binder-leaf" data-active={active}>
                          <span className="binder-status-dot" data-state="draft" />
                          <div className="binder-leaf-text">
                            <strong>{talk.title}</strong>
                            <small>{talk.subtitle} · editing</small>
                          </div>
                        </a>
                      ) : (
                        <form action="/api/studio/drafts" method="post" className="binder-leaf-form">
                          <input type="hidden" name="kind" value="talk" />
                          <input type="hidden" name="slug" value={talk.slug} />
                          <button type="submit" className="binder-leaf">
                            <span className="binder-status-dot" data-state="live" />
                            <div className="binder-leaf-text">
                              <strong>{talk.title}</strong>
                              <small>{talk.subtitle}</small>
                            </div>
                          </button>
                        </form>
                      )}
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          <div className="binder-footer">
            <span>Signed in as <strong>{login}</strong></span>
            <a href="/api/auth/logout">Sign out</a>
          </div>
        </aside>

        {/* Center Workspace */}
        <div className="atelier-stage">
          {storageError ? (
            <div className="atelier-banner-alert" role="alert">
              <strong>Storage notice:</strong> {storageError}
            </div>
          ) : null}
          {children}
        </div>
      </div>

      {/* New Post Modal */}
      {newPostModal ? (
        <div className="atelier-modal-backdrop" onClick={() => setNewPostModal(false)}>
          <div className="atelier-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Start a new post">
            <div className="atelier-modal-head">
              <span className="eyebrow">NEW MANUSCRIPT</span>
              <h2>Begin a fresh note</h2>
              <p>Choose a permanent URL slug. Your draft stays private in D1 until you hit Publish.</p>
            </div>
            <form action="/api/studio/drafts" method="post" className="atelier-modal-form">
              <input type="hidden" name="kind" value="post" />
              <label>
                <span>Article slug</span>
                <div className="atelier-slug-input">
                  <span>abdessattar.dev/blog/</span>
                  <input
                    name="slug"
                    required
                    pattern="[a-z0-9-]+"
                    placeholder="jvm-safepoint-anatomy"
                    value={newSlug}
                    onChange={(e) => setNewSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, ''))}
                    autoFocus
                  />
                </div>
              </label>
              <div className="atelier-modal-actions">
                <button type="button" className="atelier-btn-ghost" onClick={() => setNewPostModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="atelier-btn-primary">
                  Open on the desk →
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Command Palette */}
      {paletteOpen ? (
        <div className="atelier-modal-backdrop" onClick={() => setPaletteOpen(false)}>
          <div className="atelier-palette" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Quick switcher">
            <div className="atelier-palette-search">
              <svg width="15" height="15" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <circle cx="7" cy="7" r="4.8" stroke="currentColor" strokeWidth="1.4" />
                <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              </svg>
              <input
                type="search"
                placeholder="Type a title, slug, or command…"
                value={paletteQuery}
                onChange={(e) => setPaletteQuery(e.target.value)}
                autoFocus
              />
              <kbd>Esc</kbd>
            </div>
            <div className="atelier-palette-results">
              <button
                type="button"
                className="atelier-palette-item"
                onClick={() => {
                  setPaletteOpen(false);
                  setNewPostModal(true);
                }}
              >
                <div>
                  <strong>+ Create a new blog post…</strong>
                  <small>Start a fresh Markdown draft</small>
                </div>
                <span className="atelier-palette-tag">Action</span>
              </button>
              <button
                type="button"
                className="atelier-palette-item"
                onClick={() => {
                  setPaletteOpen(false);
                  setZenMode((z) => !z);
                }}
              >
                <div>
                  <strong>{zenMode ? 'Exit Zen Focus Mode' : 'Enter Zen Focus Mode'}</strong>
                  <small>Hide binder & chrome for pure writing</small>
                </div>
                <span className="atelier-palette-tag">Ctrl+Shift+F</span>
              </button>
              {filteredItems.map((item, idx) =>
                item.href ? (
                  <a
                    key={`${item.group}-${idx}`}
                    href={item.href}
                    className="atelier-palette-item"
                    onClick={() => setPaletteOpen(false)}
                  >
                    <div>
                      <strong>{item.label}</strong>
                      <small>{item.sub}</small>
                    </div>
                    <span className="atelier-palette-tag">{item.group}</span>
                  </a>
                ) : (
                  <form key={`${item.group}-${idx}`} action="/api/studio/drafts" method="post">
                    <input type="hidden" name="kind" value={item.kind} />
                    <input type="hidden" name="slug" value={item.slug} />
                    <button type="submit" className="atelier-palette-item">
                      <div>
                        <strong>{item.label}</strong>
                        <small>{item.sub}</small>
                      </div>
                      <span className="atelier-palette-tag">Open draft</span>
                    </button>
                  </form>
                ),
              )}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
