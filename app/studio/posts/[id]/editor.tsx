'use client';

import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {
  ARTICLE_STICKERS,
  POST_SKINS,
  POST_TEMPLATES,
  sectionsFromMarkdown,
  slugifyHeading,
  type ArticleSticker,
  type HomeDiff,
  type PostDocument,
  type PostSkin,
  type PostTemplate,
} from '../../../../lib/content/schema';
import {ArtifactComposer} from '../../artifact-composer';
import type {ArtifactDocument} from '../../../../lib/artifacts/schema';
import {formatBucket, formatCompare, formatWalk} from '../../../../lib/content/demos';
import {findDuplicates} from '../../../../lib/content/duplicates';
import {MarkdownView} from '../../../../lib/content/render';
import {PostTemplate as PostTemplateView} from '../../../../components/templates/post-template';
import {seoHealth} from '../../../../lib/studio/seo';

type Fields = {
  slug: string;
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  topics: string[];
  template: PostTemplate;
  draft: boolean;
  accent?: string;
  homeDiff?: HomeDiff;
  skin?: PostSkin;
  stickers?: ArticleSticker[];
};

type ViewMode = 'write' | 'split' | 'preview';
type InspectorTab = 'meta' | 'outline' | 'seo' | 'craft' | 'magic';
type DemoKind = 'walk' | 'compare' | 'bucket' | 'artifact';
type PaperFont = 'serif' | 'sans' | 'mono';
type PaperWidth = 'narrow' | 'medium' | 'wide';
type PaperSize = 'cozy' | 'roomy' | 'compact';

function isTemplate(value: string): value is PostTemplate {
  return (POST_TEMPLATES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

type DraftJson = {
  slug?: unknown;
  title?: unknown;
  description?: unknown;
  excerpt?: unknown;
  publishedAt?: unknown;
  updatedAt?: unknown;
  topics?: unknown;
  template?: unknown;
  draft?: unknown;
  accent?: unknown;
  homeDiff?: unknown;
  skin?: unknown;
  stickers?: unknown;
};

function isSkin(value: string): value is PostSkin {
  return (POST_SKINS as readonly string[]).includes(value);
}

function isSticker(value: string): value is ArticleSticker {
  return (ARTICLE_STICKERS as readonly string[]).includes(value);
}

function readFields(raw: string, fallbackSlug: string): Fields {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error('Draft fields are unreadable.');
  const data = parsed as DraftJson;
  const template = typeof data.template === 'string' && isTemplate(data.template) ? data.template : 'deep-dive';
  const topics = Array.isArray(data.topics) ? data.topics.filter((topic): topic is string => typeof topic === 'string') : [];
  const accent = typeof data.accent === 'string' && data.accent.trim() !== '' ? data.accent.trim() : undefined;
  const diff = isRecord(data.homeDiff) ? (data.homeDiff as {removed?: unknown; added?: unknown}) : null;
  const homeDiff =
    diff && typeof diff.removed === 'string' && typeof diff.added === 'string'
      ? {removed: diff.removed, added: diff.added}
      : undefined;
  const skin = typeof data.skin === 'string' && isSkin(data.skin) && data.skin !== 'plain' ? data.skin : undefined;
  const stickers = Array.isArray(data.stickers) ? data.stickers.filter((item): item is ArticleSticker => typeof item === 'string' && isSticker(item)) : [];
  return {
    slug: typeof data.slug === 'string' && data.slug.trim() !== '' ? data.slug.trim() : fallbackSlug,
    title: typeof data.title === 'string' ? data.title : '',
    description: typeof data.description === 'string' ? data.description : '',
    excerpt: typeof data.excerpt === 'string' ? data.excerpt : '',
    publishedAt: typeof data.publishedAt === 'string' ? data.publishedAt : '',
    updatedAt: typeof data.updatedAt === 'string' ? data.updatedAt : '',
    topics,
    template,
    draft: data.draft !== false,
    ...(accent !== undefined ? {accent} : {}),
    ...(homeDiff !== undefined ? {homeDiff} : {}),
    ...(skin !== undefined ? {skin} : {}),
    ...(stickers.length > 0 ? {stickers} : {}),
  };
}

function extractHeadings(markdown: string): {level: number; title: string; id: string; line: number}[] {
  const list: {level: number; title: string; id: string; line: number}[] = [];
  let inFence = false;
  const lines = markdown.split(/\r?\n/);
  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i] ?? '';
    if (/^(`{3,}|~{3,})/.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = /^(#{2,3})\s+(.+?)\s*(?:\{#([a-z0-9-]+)\})?\s*$/.exec(line);
    if (!match) continue;
    const hashes = match[1] ?? '##';
    const rawTitle = (match[2] ?? '').trim();
    if (!rawTitle) continue;
    const id = match[3] ?? slugifyHeading(rawTitle);
    list.push({level: hashes.length, title: rawTitle, id, line: i + 1});
  }
  return list;
}

export function PostEditor({
  id,
  slug,
  frontmatter,
  body,
  existing,
  isPublishedAlready = false,
  artifacts: initialArtifacts = [],
}: {
  id: string;
  slug: string;
  frontmatter: string;
  body: string;
  existing: {slug: string; title: string; description: string}[];
  isPublishedAlready?: boolean;
  artifacts?: ArtifactDocument[];
}) {
  const initial = useMemo(() => readFields(frontmatter, slug), [frontmatter, slug]);
  const [fields, setFields] = useState<Fields>(initial);
  const [markdown, setMarkdown] = useState(body);
  const [topicDraft, setTopicDraft] = useState('');
  const [status, setStatus] = useState<'Draft' | 'Editing' | 'Saving…' | 'Saved' | 'Could not save' | 'Uploading image…' | 'Image upload failed'>('Draft');
  const [lastSavedAt, setLastSavedAt] = useState<string>('');
  const [dirty, setDirty] = useState(false);

  // Studio layout & comfort preferences
  const [viewMode, setViewMode] = useState<ViewMode>('write');
  const [inspectorOpen, setInspectorOpen] = useState(true);
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('meta');
  const [paperFont, setPaperFont] = useState<PaperFont>('sans');
  const [paperWidth, setPaperWidth] = useState<PaperWidth>('medium');
  const [paperSize, setPaperSize] = useState<PaperSize>('cozy');
  const [typewriter, setTypewriter] = useState(false);
  const [focusSpot, setFocusSpot] = useState(false);
  const [wordGoal, setWordGoal] = useState(1200);
  const [catalog, setCatalog] = useState(initialArtifacts);
  const [demoOpen, setDemoOpen] = useState(false);
  const [demoKind, setDemoKind] = useState<DemoKind>('walk');
  const [demoTitle, setDemoTitle] = useState('How it moves');
  const [demoSteps, setDemoSteps] = useState(['The first state.', 'What changes.', 'What you can check.']);
  const [demoBefore, setDemoBefore] = useState('Walk the bucket from index zero.');
  const [demoAfter, setDemoAfter] = useState('Walk the bucket from the last index.');
  const [activeParagraph, setActiveParagraph] = useState<string>('');
  const [cursorMetrics, setCursorMetrics] = useState({line: 1, col: 1, wordsBefore: 0});

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const serializedFrontmatter = useMemo(() => JSON.stringify({...fields, slug}), [fields, slug]);

  // Load saved craft preferences
  useEffect(() => {
    const savedFont = localStorage.getItem('studio:font') as PaperFont | null;
    const savedWidth = localStorage.getItem('studio:width') as PaperWidth | null;
    const savedInspector = localStorage.getItem('studio:inspector');
    const savedGoal = localStorage.getItem('studio:goal');
    if (savedFont === 'serif' || savedFont === 'sans' || savedFont === 'mono') setPaperFont(savedFont);
    if (savedWidth === 'narrow' || savedWidth === 'medium' || savedWidth === 'wide') setPaperWidth(savedWidth);
    if (savedInspector === 'closed') setInspectorOpen(false);
    if (savedGoal) {
      const parsed = Number.parseInt(savedGoal, 10);
      if (Number.isInteger(parsed) && parsed >= 100) setWordGoal(parsed);
    }
  }, []);

  const saveNow = useCallback(async () => {
    setStatus('Saving…');
    try {
      const response = await fetch(`/api/studio/drafts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, frontmatter: serializedFrontmatter, body: markdown}),
      });
      if (response.ok) {
        setStatus('Saved');
        setDirty(false);
        setLastSavedAt(new Date().toLocaleTimeString([], {hour: '2-digit', minute: '2-digit', second: '2-digit'}));
      } else {
        setStatus('Could not save');
      }
    } catch {
      setStatus('Could not save');
    }
  }, [id, slug, serializedFrontmatter, markdown]);

  // Debounced autosave
  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => {
      void saveNow();
    }, 750);
    return () => clearTimeout(timer);
  }, [dirty, saveNow]);

  // Auto-grow textarea in write mode so paper scrolls naturally
  useEffect(() => {
    const el = textareaRef.current;
    if (!el || viewMode === 'split') return;
    el.style.height = 'auto';
    el.style.height = `${Math.max(560, el.scrollHeight + 48)}px`;
  }, [markdown, viewMode, paperFont, paperSize, paperWidth]);

  function update(next: Partial<Fields>) {
    setFields((current) => ({...current, ...next, slug}));
    setDirty(true);
    setStatus('Editing');
  }

  function updateAccent(value: string) {
    setFields((current) => {
      const next: Fields = {...current, slug};
      if (value.trim() !== '') next.accent = value.trim();
      else delete next.accent;
      return next;
    });
    setDirty(true);
    setStatus('Editing');
  }

  function updateHomeDiff(part: 'removed' | 'added', value: string) {
    setFields((current) => {
      const existingDiff = current.homeDiff ?? {removed: '', added: ''};
      const updated = {...existingDiff, [part]: value};
      const hasBoth = updated.removed.trim() !== '' || updated.added.trim() !== '';
      const next: Fields = {...current, slug};
      if (hasBoth) next.homeDiff = updated;
      else delete next.homeDiff;
      return next;
    });
    setDirty(true);
    setStatus('Editing');
  }

  function setSkin(nextSkin: PostSkin) {
    setFields((current) => {
      const next: Fields = {...current, slug};
      if (nextSkin === 'plain') delete next.skin;
      else next.skin = nextSkin;
      return next;
    });
    setDirty(true);
    setStatus('Editing');
  }

  function toggleSticker(sticker: ArticleSticker) {
    setFields((current) => {
      const owned = current.stickers ?? [];
      const nextStickers = owned.includes(sticker) ? owned.filter((item) => item !== sticker) : [...owned, sticker];
      const next: Fields = {...current, slug};
      if (nextStickers.length > 0) next.stickers = nextStickers;
      else delete next.stickers;
      return next;
    });
    setDirty(true);
    setStatus('Editing');
  }

  async function upload(file: File) {
    setStatus('Uploading image…');
    const form = new FormData();
    form.set('file', file);
    form.set('slug', slug);
    const response = await fetch('/api/studio/media', {method: 'POST', body: form});
    if (!response.ok) {
      setStatus('Image upload failed');
      return;
    }
    const payload: unknown = await response.json();
    if (typeof payload === 'object' && payload !== null && 'url' in payload && typeof payload.url === 'string') {
      insertSnippet(`\n![${file.name.replace(/\.[^.]+$/, '')}](${payload.url})\n`);
      setStatus('Editing');
    }
  }

  function insertSnippet(before: string, after = '', placeholder = '') {
    const el = textareaRef.current;
    if (!el) {
      setMarkdown((current) => `${current}${before}${placeholder}${after}`);
      setDirty(true);
      setStatus('Editing');
      return;
    }
    const start = el.selectionStart ?? markdown.length;
    const end = el.selectionEnd ?? markdown.length;
    const selected = markdown.slice(start, end) || placeholder;
    const nextText = `${markdown.slice(0, start)}${before}${selected}${after}${markdown.slice(end)}`;
    setMarkdown(nextText);
    setDirty(true);
    setStatus('Editing');
    requestAnimationFrame(() => {
      el.focus();
      const cursorStart = start + before.length;
      const cursorEnd = cursorStart + selected.length;
      el.setSelectionRange(cursorStart, cursorEnd);
    });
  }

  function insertHeadingWithId() {
    const el = textareaRef.current;
    const selected = el ? markdown.slice(el.selectionStart, el.selectionEnd).trim() : '';
    const title = selected || 'Section heading';
    const sectionId = slugifyHeading(title);
    insertSnippet(`\n## ${title} {#${sectionId}}\n`);
  }

  function handleCaretActivity() {
    const el = textareaRef.current;
    if (!el) return;
    const pos = el.selectionStart ?? 0;
    const before = markdown.slice(0, pos);
    const linesBefore = before.split(/\r?\n/);
    const line = linesBefore.length;
    const col = (linesBefore[linesBefore.length - 1]?.length ?? 0) + 1;
    const wordsBefore = before.trim() ? before.trim().split(/\s+/).length : 0;
    setCursorMetrics({line, col, wordsBefore});

    // Extract active paragraph for Focus Spotlight
    const prevBreak = markdown.lastIndexOf('\n\n', pos - 1);
    const nextBreak = markdown.indexOf('\n\n', pos);
    const paraStart = prevBreak === -1 ? 0 : prevBreak + 2;
    const paraEnd = nextBreak === -1 ? markdown.length : nextBreak;
    setActiveParagraph(markdown.slice(paraStart, paraEnd).trim());

    if (typewriter) {
      const style = getComputedStyle(el);
      const lineHeight = Number.parseFloat(style.lineHeight) || 32;
      const caretTop = el.offsetTop + (line - 1) * lineHeight;
      const scroller = el.closest('.manuscript-sheet-wrap');
      if (scroller instanceof HTMLElement) {
        const target = caretTop - scroller.clientHeight * 0.42;
        if (Math.abs(scroller.scrollTop - target) > lineHeight * 2) {
          scroller.scrollTo({top: Math.max(0, target)});
        }
      }
    }
  }

  function handleTextareaKeyDown(event: React.KeyboardEvent<HTMLTextAreaElement>) {
    const mod = event.metaKey || event.ctrlKey;
    if (mod && event.key.toLowerCase() === 's') {
      event.preventDefault();
      void saveNow();
      return;
    }
    if (mod && event.key.toLowerCase() === 'b') {
      event.preventDefault();
      insertSnippet('**', '**', 'bold text');
      return;
    }
    if (mod && event.key.toLowerCase() === 'i') {
      event.preventDefault();
      insertSnippet('*', '*', 'italic text');
      return;
    }
    if (mod && event.key.toLowerCase() === 'e') {
      event.preventDefault();
      insertSnippet('`', '`', 'code');
      return;
    }
    if (mod && event.shiftKey && event.key.toLowerCase() === 'k') {
      event.preventDefault();
      insertSnippet('\n```java\n', '\n```\n', '// Java snippet');
      return;
    }
    if (mod && event.shiftKey && event.key.toLowerCase() === 'p') {
      event.preventDefault();
      setViewMode((m) => (m === 'write' ? 'split' : m === 'split' ? 'preview' : 'write'));
      return;
    }
    if (event.key === 'Tab') {
      event.preventDefault();
      insertSnippet('  ');
    }
  }

  function jumpToLine(lineNumber: number) {
    const el = textareaRef.current;
    if (!el) return;
    if (viewMode === 'preview') setViewMode('write');
    const lines = markdown.split(/\r?\n/);
    let charIndex = 0;
    for (let i = 0; i < Math.min(lineNumber - 1, lines.length); i += 1) {
      charIndex += (lines[i]?.length ?? 0) + 1;
    }
    requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(charIndex, charIndex);
      handleCaretActivity();
    });
  }

  function addTopic(raw: string) {
    const cleaned = raw.trim();
    if (!cleaned) return;
    if (!fields.topics.includes(cleaned)) {
      update({topics: [...fields.topics, cleaned]});
    }
    setTopicDraft('');
  }

  function removeTopic(topic: string) {
    const next = fields.topics.filter((t) => t !== topic);
    update({topics: next.length > 0 ? next : ['Java']});
  }

  // Telemetry calculations
  const stats = useMemo(() => {
    const trimmed = markdown.trim();
    const words = trimmed ? trimmed.split(/\s+/).length : 0;
    const chars = markdown.length;
    const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).length : 0;
    const codeBlocks = Math.floor(([...markdown.matchAll(/^(`{3,}|~{3,})/gm)].length) / 2);
    const readMins = Math.max(1, Math.ceil(words / 220));
    const cursorMins = Math.max(0, Math.floor(cursorMetrics.wordsBefore / 220));
    const cursorSecs = Math.round(((cursorMetrics.wordsBefore % 220) / 220) * 60);
    return {words, chars, paragraphs, codeBlocks, readMins, cursorMins, cursorSecs};
  }, [markdown, cursorMetrics.wordsBefore]);

  const headings = useMemo(() => extractHeadings(markdown), [markdown]);
  const notes = useMemo(
    () => seoHealth({title: fields.title, description: fields.description, topics: fields.topics, body: markdown}),
    [fields.title, fields.description, fields.topics, markdown],
  );
  const duplicates = useMemo(
    () => findDuplicates({slug, title: fields.title, description: fields.description}, existing),
    [slug, fields.title, fields.description, existing],
  );

  const previewPost: PostDocument = useMemo(
    () => ({
      slug,
      title: fields.title || 'Untitled manuscript',
      description: fields.description || 'Add a crisp summary in the Metadata inspector.',
      excerpt: fields.excerpt || fields.description,
      publishedAt: fields.publishedAt || new Date().toISOString().slice(0, 10),
      updatedAt: fields.updatedAt || new Date().toISOString().slice(0, 10),
      topics: fields.topics.length > 0 ? fields.topics : ['Java'],
      template: fields.template,
      sections: sectionsFromMarkdown(markdown),
      body: markdown,
      draft: fields.draft,
      ...(fields.accent ? {accent: fields.accent} : {}),
      ...(fields.homeDiff ? {homeDiff: fields.homeDiff} : {}),
      ...(fields.skin ? {skin: fields.skin} : {}),
      ...(fields.stickers && fields.stickers.length > 0 ? {stickers: fields.stickers} : {}),
    }),
    [slug, fields, markdown],
  );

  const goalProgress = Math.min(100, Math.round((stats.words / Math.max(100, wordGoal)) * 100));

  return (
    <div
      className="atelier-workbench"
      data-view={viewMode}
      data-inspector={inspectorOpen ? 'open' : 'closed'}
      data-font={paperFont}
      data-width={paperWidth}
      data-size={paperSize}
      data-focus={focusSpot ? 'true' : 'false'}
    >
      {/* Studio Utility Ribbon */}
      <div className="workbench-ribbon">
        <div className="workbench-ribbon-left">
          <div className="workbench-Segmented" role="group" aria-label="Editor view mode">
            <button
              type="button"
              data-active={viewMode === 'write'}
              onClick={() => setViewMode('write')}
              title="Pure Manuscript Canvas"
            >
              Manuscript
            </button>
            <button
              type="button"
              data-active={viewMode === 'split'}
              onClick={() => setViewMode('split')}
              title="Side-by-side Live Proof (Ctrl+Shift+P)"
            >
              Split Proof
            </button>
            <button
              type="button"
              data-active={viewMode === 'preview'}
              onClick={() => setViewMode('preview')}
              title="Full Live Template Reader"
            >
              Article View
            </button>
          </div>

          {/* Formatting Craft Bar */}
          {viewMode !== 'preview' ? (
            <div className="workbench-tools" role="toolbar" aria-label="Markdown craft tools">
              <button type="button" onClick={insertHeadingWithId} title="Insert ## Section with {#id} anchor">
                H2 <span>#id</span>
              </button>
              <button type="button" onClick={() => insertSnippet('\n### ', '\n', 'Subheading')} title="Insert ### Subheading">
                H3
              </button>
              <span className="workbench-divider" />
              <button type="button" onClick={() => insertSnippet('**', '**', 'bold')} title="Bold (Ctrl+B)">
                <strong>B</strong>
              </button>
              <button type="button" onClick={() => insertSnippet('*', '*', 'emphasis')} title="Italic (Ctrl+I)">
                <em>I</em>
              </button>
              <button type="button" onClick={() => insertSnippet('`', '`', 'symbol')} title="Inline code (Ctrl+E)">
                <code>{'<>'}</code>
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('\n```java\n', '\n```\n', '// Evidence or benchmark')}
                title="Fenced Java code block (Ctrl+Shift+K)"
              >
                JavaCode
              </button>
              <span className="workbench-divider" />
              <button
                type="button"
                onClick={() => insertSnippet('\n:::note\nKey takeaway\n', '\n:::\n', 'Explain the invariant or edge case here.')}
                title="Insert :::note callout block"
              >
                :::note
              </button>
              <button
                type="button"
                data-active={demoOpen}
                onClick={() => setDemoOpen((open) => !open)}
                title="Build an interactive demo"
              >
                Demo
              </button>
              <button
                type="button"
                onClick={() => insertSnippet('[', '](https://)', 'link text')}
                title="Insert Markdown link"
              >
                Link
              </button>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                title="Upload image to R2 media bucket (or paste/drop directly)"
              >
                Image ↑
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                hidden
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void upload(file);
                  e.target.value = '';
                }}
              />
            </div>
          ) : null}
        </div>

        <div className="workbench-ribbon-right">
          {/* Save indicator */}
          <button
            type="button"
            className="workbench-save-pill"
            data-state={status === 'Saved' ? 'saved' : status === 'Could not save' || status === 'Image upload failed' ? 'error' : 'dirty'}
            onClick={() => void saveNow()}
            title="Click to save immediately (Ctrl+S)"
          >
            <span className="save-dot" />
            <span>{status}</span>
            {lastSavedAt && status === 'Saved' ? <small>· {lastSavedAt}</small> : null}
          </button>

          {/* Primary Publish / Unpublish actions */}
          <form action="/api/studio/publish" method="post" onSubmit={() => setDirty(false)}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="frontmatter" value={serializedFrontmatter} />
            <input type="hidden" name="body" value={markdown} />
            <button type="submit" className="atelier-btn-publish">
              Publish to live
            </button>
          </form>

          <button
            type="button"
            className="atelier-icon-btn"
            data-active={inspectorOpen}
            onClick={() => {
              setInspectorOpen((open) => {
                const next = !open;
                localStorage.setItem('studio:inspector', next ? 'open' : 'closed');
                return next;
              });
            }}
            title="Toggle Inspector Drawer"
            aria-label="Toggle Inspector Drawer"
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
              <rect x="1.5" y="2.5" width="13" height="11" rx="2" stroke="currentColor" strokeWidth="1.3" />
              <line x1="10.5" y1="2.5" x2="10.5" y2="13.5" stroke="currentColor" strokeWidth="1.3" />
            </svg>
          </button>
        </div>
      </div>

      {demoOpen ? (
        <form
          className="demo-composer"
          onSubmit={(event) => {
            event.preventDefault();
            if (demoKind === 'artifact') return;
            const block = demoKind === 'bucket'
              ? formatBucket()
              : demoKind === 'compare'
                ? formatCompare(demoTitle, demoBefore, demoAfter)
                : formatWalk(demoTitle, demoSteps);
            insertSnippet(block);
            setDemoOpen(false);
          }}
        >
          <div className="demo-composer-head">
            <strong>Interactive demo</strong>
            <span>Drops a live block into the manuscript. Readers can step through it on the article.</span>
          </div>
          <div className="workbench-Segmented" role="group" aria-label="Demo kind">
            <button type="button" data-active={demoKind === 'walk'} onClick={() => setDemoKind('walk')}>Walkthrough</button>
            <button type="button" data-active={demoKind === 'compare'} onClick={() => setDemoKind('compare')}>Before / after</button>
            <button type="button" data-active={demoKind === 'bucket'} onClick={() => setDemoKind('bucket')}>Bucket</button>
            <button type="button" data-active={demoKind === 'artifact'} onClick={() => setDemoKind('artifact')}>Artifact</button>
          </div>
          {demoKind === 'artifact' ? (
            <ArtifactComposer
              artifacts={catalog}
              onSaved={(artifact) => setCatalog((current) => [artifact, ...current.filter((item) => item.id !== artifact.id)])}
              onInsert={(fence) => {
                insertSnippet(fence);
                setDemoOpen(false);
              }}
            />
          ) : null}
          {demoKind === 'walk' || demoKind === 'compare' ? (
            <label className="inspector-field">
              <span>Title</span>
              <input value={demoTitle} onChange={(event) => setDemoTitle(event.target.value)} />
            </label>
          ) : null}
          {demoKind === 'bucket' ? (
            <p>The built-in bucket walk: forward misses the shifted entry, backward visits both.</p>
          ) : null}
          {demoKind === 'walk' ? (
            <div className="demo-step-list">
              {demoSteps.map((step, index) => (
                <label key={index} className="inspector-field">
                  <span>Step {index + 1}</span>
                  <input
                    value={step}
                    onChange={(event) => setDemoSteps((current) => current.map((item, itemIndex) => itemIndex === index ? event.target.value : item))}
                  />
                </label>
              ))}
              <button type="button" className="atelier-btn-ghost" onClick={() => setDemoSteps((current) => [...current, ''])}>Add step</button>
            </div>
          ) : null}
          {demoKind === 'compare' ? (
            <div className="demo-step-list">
              <label className="inspector-field">
                <span>Before</span>
                <textarea rows={2} value={demoBefore} onChange={(event) => setDemoBefore(event.target.value)} />
              </label>
              <label className="inspector-field">
                <span>After</span>
                <textarea rows={2} value={demoAfter} onChange={(event) => setDemoAfter(event.target.value)} />
              </label>
            </div>
          ) : null}
          {demoKind === 'artifact' ? (
            <div className="desk-card-actions">
              <button type="button" className="atelier-btn-ghost" onClick={() => setDemoOpen(false)}>Close</button>
            </div>
          ) : (
            <div className="desk-card-actions">
              <button type="submit" className="atelier-btn-primary">Insert demo</button>
              <button type="button" className="atelier-btn-ghost" onClick={() => setDemoOpen(false)}>Close</button>
            </div>
          )}
        </form>
      ) : null}

      {/* Main Writing Stage + Inspector */}
      <div className="workbench-main">
        <div className="workbench-panes">
          {/* Left / Center Writing Sheet */}
          {viewMode !== 'preview' ? (
            <div className="manuscript-sheet-wrap">
              <div className="manuscript-sheet">
                {/* Inline Manuscript Header */}
                <div className="manuscript-meta-strip">
                  <span className="manuscript-template-pill">{fields.template}</span>
                  <span>/blog/{slug}</span>
                  <span>·</span>
                  <span>{fields.publishedAt}</span>
                  {fields.draft ? (
                    <span className="manuscript-draft-tag">Draft mode</span>
                  ) : (
                    <span className="manuscript-live-tag">Public</span>
                  )}
                </div>

                <textarea
                  className="manuscript-title-input"
                  rows={2}
                  value={fields.title}
                  placeholder="Give this piece an unforgettable title…"
                  onChange={(event) => update({title: event.target.value})}
                />

                <textarea
                  className="manuscript-deck-input"
                  rows={2}
                  value={fields.description}
                  placeholder="Write a sharp one-sentence thesis or deck (80–170 chars for search & social cards)…"
                  onChange={(event) => update({description: event.target.value})}
                />

                <div className="manuscript-topics-row">
                  {fields.topics.map((topic) => (
                    <span key={topic} className="manuscript-topic-chip">
                      #{topic}
                      <button type="button" onClick={() => removeTopic(topic)} aria-label={`Remove ${topic}`}>
                        ×
                      </button>
                    </span>
                  ))}
                  <input
                    className="manuscript-topic-add"
                    value={topicDraft}
                    placeholder="+ topic (Enter)"
                    onChange={(e) => setTopicDraft(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addTopic(topicDraft);
                      }
                    }}
                    onBlur={() => {
                      if (topicDraft.trim()) addTopic(topicDraft);
                    }}
                  />
                </div>

                <hr className="manuscript-rule" />

                {/* Focus Spotlight Box when active */}
                {focusSpot && activeParagraph ? (
                  <div className="manuscript-focus-spotlight" aria-live="polite">
                    <span className="focus-label">ACTIVE PARAGRAPH FOCUS</span>
                    <p>{activeParagraph}</p>
                  </div>
                ) : null}

                {/* Primary Prose Textarea */}
                <textarea
                  ref={textareaRef}
                  className="manuscript-body-textarea"
                  value={markdown}
                  placeholder="Begin writing. Paste or drop images anywhere, press Ctrl+B for bold, or add ## Heading {#id} sections…"
                  onChange={(event) => {
                    setMarkdown(event.target.value);
                    setDirty(true);
                    setStatus('Editing');
                    handleCaretActivity();
                  }}
                  onKeyUp={handleCaretActivity}
                  onClick={handleCaretActivity}
                  onKeyDown={handleTextareaKeyDown}
                  onPaste={(event) => {
                    const file = [...event.clipboardData.files].find((item) => item.type.startsWith('image/'));
                    if (!file) return;
                    event.preventDefault();
                    void upload(file);
                  }}
                  onDrop={(event) => {
                    const file = [...event.dataTransfer.files].find((item) => item.type.startsWith('image/'));
                    if (!file) return;
                    event.preventDefault();
                    void upload(file);
                  }}
                />
              </div>
            </div>
          ) : null}

          {/* Right / Full Live Proof Preview */}
          {viewMode === 'split' ? (
            <div className="manuscript-proof-pane">
              <div className="proof-pane-header">
                <span className="eyebrow">LIVE ARTICLE PROOF · {fields.template.toUpperCase()}</span>
                <span>{ previewPost.sections.length } anchored sections</span>
              </div>
              <div className="proof-pane-content">
                <header className="proof-article-intro">
                  <div className="eyebrow">
                    {fields.topics.join(' · ')} / {fields.publishedAt}
                  </div>
                  <h1>
                    {fields.title || 'Untitled'}
                    <span style={fields.accent ? {color: fields.accent} : undefined}>.</span>
                  </h1>
                  <p>{fields.description}</p>
                </header>
                <article className="prose">
                  <MarkdownView markdown={markdown} title={fields.title} artifacts={catalog} />
                </article>
              </div>
            </div>
          ) : null}

          {viewMode === 'preview' ? (
            <div className="manuscript-full-preview">
              <PostTemplateView post={previewPost}>
                <MarkdownView markdown={markdown} title={fields.title} artifacts={catalog} />
              </PostTemplateView>
            </div>
          ) : null}
        </div>

        {/* Collapsible Right Inspector Drawer */}
        {inspectorOpen ? (
          <aside className="workbench-inspector" aria-label="Document inspector">
            <div className="inspector-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'meta'}
                onClick={() => setInspectorTab('meta')}
              >
                Metadata
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'outline'}
                onClick={() => setInspectorTab('outline')}
              >
                Outline ({headings.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'seo'}
                onClick={() => setInspectorTab('seo')}
              >
                SEO
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'craft'}
                onClick={() => setInspectorTab('craft')}
              >
                Feel
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={inspectorTab === 'magic'}
                onClick={() => setInspectorTab('magic')}
              >
                Magic
              </button>
            </div>

            <div className="inspector-body">
              {inspectorTab === 'meta' ? (
                <div className="inspector-panel">
                  <label className="inspector-field">
                    <span>Template architecture</span>
                    <select
                      value={fields.template}
                      onChange={(event) => {
                        if (isTemplate(event.target.value)) update({template: event.target.value});
                      }}
                    >
                      {POST_TEMPLATES.map((template) => (
                        <option key={template} value={template}>
                          {template}
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="inspector-field">
                    <span>Index & RSS Excerpt</span>
                    <textarea
                      rows={3}
                      value={fields.excerpt}
                      placeholder="Short hook shown on /blog and RSS feed…"
                      onChange={(event) => update({excerpt: event.target.value})}
                    />
                  </label>

                  <div className="inspector-row-2">
                    <label className="inspector-field">
                      <span>Published date</span>
                      <input
                        type="date"
                        value={fields.publishedAt}
                        onChange={(event) => update({publishedAt: event.target.value})}
                      />
                    </label>
                    <label className="inspector-field">
                      <span>Updated date</span>
                      <input
                        type="date"
                        value={fields.updatedAt}
                        onChange={(event) => update({updatedAt: event.target.value})}
                      />
                    </label>
                  </div>

                  <label className="inspector-field">
                    <span>Signature Accent (#rrggbb)</span>
                    <div className="inspector-color-row">
                      <input
                        type="color"
                        value={fields.accent && /^#[0-9a-fA-F]{6}$/.test(fields.accent) ? fields.accent : '#3155d9'}
                        onChange={(event) => updateAccent(event.target.value)}
                      />
                      <input
                        type="text"
                        value={fields.accent ?? ''}
                        placeholder="#3155d9 (optional)"
                        onChange={(event) => updateAccent(event.target.value)}
                      />
                      {fields.accent ? (
                        <button type="button" className="atelier-btn-ghost" onClick={() => updateAccent('')}>
                          Reset
                        </button>
                      ) : null}
                    </div>
                  </label>

                  <div className="inspector-group-box">
                    <span className="eyebrow">HOMEPAGE FEATURED DIFF (OPTIONAL)</span>
                    <label className="inspector-field">
                      <span>Removed line (-)</span>
                      <input
                        value={fields.homeDiff?.removed ?? ''}
                        placeholder="- map.remove(key);"
                        onChange={(e) => updateHomeDiff('removed', e.target.value)}
                      />
                    </label>
                    <label className="inspector-field">
                      <span>Added line (+)</span>
                      <input
                        value={fields.homeDiff?.added ?? ''}
                        placeholder="+ pool.release(entry);"
                        onChange={(e) => updateHomeDiff('added', e.target.value)}
                      />
                    </label>
                  </div>

                  <label className="inspector-checkbox">
                    <input
                      type="checkbox"
                      checked={fields.draft}
                      onChange={(event) => update({draft: event.target.checked})}
                    />
                    <div>
                      <strong>Keep hidden as file draft</strong>
                      <small>Note: Clicking “Publish to live” automatically flips this to public.</small>
                    </div>
                  </label>

                  <div className="inspector-danger-zone">
                    <span className="eyebrow">MANUSCRIPT ACTIONS</span>
                    {isPublishedAlready || duplicates.blocked ? (
                      <form action="/api/studio/unpublish" method="post" onSubmit={() => setDirty(false)}>
                        <input type="hidden" name="id" value={id} />
                        <input type="hidden" name="frontmatter" value={serializedFrontmatter} />
                        <input type="hidden" name="body" value={markdown} />
                        <button type="submit" className="atelier-btn-secondary inspector-full-btn">
                          Unpublish from live site
                        </button>
                      </form>
                    ) : null}
                    <form action={`/api/studio/drafts/${id}`} method="post" onSubmit={() => setDirty(false)}>
                      <input type="hidden" name="_action" value="delete" />
                      <button type="submit" className="atelier-btn-danger inspector-full-btn">
                        Discard uncommitted D1 draft
                      </button>
                    </form>
                  </div>
                </div>
              ) : null}

              {inspectorTab === 'outline' ? (
                <div className="inspector-panel">
                  <div className="inspector-outline-head">
                    <span className="eyebrow">DOCUMENT MAP</span>
                    <button type="button" className="atelier-btn-ghost" onClick={insertHeadingWithId}>
                      + Add H2
                    </button>
                  </div>
                  {headings.length === 0 ? (
                    <p className="inspector-empty">
                      No <code>## Heading {'{#id}'}</code> sections yet. Add H2 headings to build your article table of contents.
                    </p>
                  ) : (
                    <ul className="inspector-outline-list">
                      {headings.map((h, i) => (
                        <li key={`${h.id}-${i}`} data-level={h.level}>
                          <button type="button" onClick={() => jumpToLine(h.line)}>
                            <span className="outline-title">{h.title}</span>
                            <code>#{h.id}</code>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              ) : null}

              {inspectorTab === 'seo' ? (
                <div className="inspector-panel">
                  <span className="eyebrow">SEARCH & SYNDICATION</span>
                  <div className="search-preview">
                    <p>abdessattar.dev › blog › {slug}</p>
                    <strong>{fields.title || 'Untitled note'}</strong>
                    <span>{fields.description || 'No description set yet.'}</span>
                  </div>

                  <ul className="inspector-seo-list">
                    {notes.map((note) => (
                      <li key={note.text} data-level={note.level}>
                        <span className="seo-indicator">{note.level === 'ok' ? '✓' : '!'}</span>
                        <span>{note.text}</span>
                      </li>
                    ))}
                  </ul>

                  {duplicates.blocked ? (
                    <p className="inspector-notice">
                      This slug is already live on the blog. Publishing will update the existing article in place.
                    </p>
                  ) : null}
                  {duplicates.warnings.map((warning) => (
                    <p className="studio-alert" key={warning}>
                      {warning}
                    </p>
                  ))}
                </div>
              ) : null}

              {inspectorTab === 'magic' ? (
                <div className="inspector-panel">
                  <span className="eyebrow">ARTICLE SKIN</span>
                  <p className="inspector-empty">This publishes with the note. The public page wears it, including the preview.</p>
                  <div className="skin-grid">
                    {POST_SKINS.map((skin) => (
                      <button
                        key={skin}
                        type="button"
                        className="skin-swatch"
                        data-skin={skin}
                        data-active={(fields.skin ?? 'plain') === skin}
                        onClick={() => setSkin(skin)}
                      >
                        <span />
                        <strong>{skin === 'field-notes' ? 'Field notes' : skin}</strong>
                      </button>
                    ))}
                  </div>
                  <span className="eyebrow">EDGE STICKERS</span>
                  <p className="inspector-empty">They sit on the article edge. The tilt is stable for this slug, so it does not jump between visits.</p>
                  <div className="sticker-grid">
                    {ARTICLE_STICKERS.map((sticker) => (
                      <button
                        key={sticker}
                        type="button"
                        className="sticker-pick"
                        data-active={fields.stickers?.includes(sticker) ?? false}
                        onClick={() => toggleSticker(sticker)}
                      >
                        {sticker}
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {inspectorTab === 'craft' ? (
                <div className="inspector-panel">
                  <span className="eyebrow">TYPOGRAPHY & COMFORT</span>

                  <div className="craft-control-group">
                    <span>Typeface voice</span>
                    <div className="workbench-Segmented">
                      <button
                        type="button"
                        data-active={paperFont === 'serif'}
                        onClick={() => {
                          setPaperFont('serif');
                          localStorage.setItem('studio:font', 'serif');
                        }}
                      >
                        Serif
                      </button>
                      <button
                        type="button"
                        data-active={paperFont === 'sans'}
                        onClick={() => {
                          setPaperFont('sans');
                          localStorage.setItem('studio:font', 'sans');
                        }}
                      >
                        Sans
                      </button>
                      <button
                        type="button"
                        data-active={paperFont === 'mono'}
                        onClick={() => {
                          setPaperFont('mono');
                          localStorage.setItem('studio:font', 'mono');
                        }}
                      >
                        Mono
                      </button>
                    </div>
                  </div>

                  <div className="craft-control-group">
                    <span>Column measure</span>
                    <div className="workbench-Segmented">
                      <button
                        type="button"
                        data-active={paperWidth === 'narrow'}
                        onClick={() => {
                          setPaperWidth('narrow');
                          localStorage.setItem('studio:width', 'narrow');
                        }}
                      >
                        60ch
                      </button>
                      <button
                        type="button"
                        data-active={paperWidth === 'medium'}
                        onClick={() => {
                          setPaperWidth('medium');
                          localStorage.setItem('studio:width', 'medium');
                        }}
                      >
                        68ch
                      </button>
                      <button
                        type="button"
                        data-active={paperWidth === 'wide'}
                        onClick={() => {
                          setPaperWidth('wide');
                          localStorage.setItem('studio:width', 'wide');
                        }}
                      >
                        78ch
                      </button>
                    </div>
                  </div>

                  <div className="craft-control-group">
                    <span>Font scale</span>
                    <div className="workbench-Segmented">
                      <button
                        type="button"
                        data-active={paperSize === 'compact'}
                        onClick={() => setPaperSize('compact')}
                      >
                        Compact
                      </button>
                      <button
                        type="button"
                        data-active={paperSize === 'cozy'}
                        onClick={() => setPaperSize('cozy')}
                      >
                        Cozy
                      </button>
                      <button
                        type="button"
                        data-active={paperSize === 'roomy'}
                        onClick={() => setPaperSize('roomy')}
                      >
                        Spacious
                      </button>
                    </div>
                  </div>

                  <label className="inspector-checkbox">
                    <input
                      type="checkbox"
                      checked={typewriter}
                      onChange={(e) => setTypewriter(e.target.checked)}
                    />
                    <div>
                      <strong>Typewriter scrolling</strong>
                      <small>Keeps your active line vertically centered as you write.</small>
                    </div>
                  </label>

                  <label className="inspector-checkbox">
                    <input
                      type="checkbox"
                      checked={focusSpot}
                      onChange={(e) => setFocusSpot(e.target.checked)}
                    />
                    <div>
                      <strong>Paragraph Focus Spotlight</strong>
                      <small>Highlights your current paragraph in a calm focal card above the sheet.</small>
                    </div>
                  </label>

                  <label className="inspector-field">
                    <span>Session word target</span>
                    <input
                      type="number"
                      min={100}
                      step={100}
                      value={wordGoal}
                      onChange={(e) => {
                        const val = Number.parseInt(e.target.value, 10) || 1000;
                        setWordGoal(val);
                        localStorage.setItem('studio:goal', String(val));
                      }}
                    />
                  </label>
                </div>
              ) : null}
            </div>
          </aside>
        ) : null}
      </div>

      {/* Bottom Telemetry & Cadence Bar */}
      <footer className="workbench-telemetry">
        <div className="telemetry-left">
          <span>
            <strong>{stats.words.toLocaleString('en-US')}</strong> words
          </span>
          <span>·</span>
          <span>{stats.chars.toLocaleString('en-US')} chars</span>
          <span>·</span>
          <span>{stats.paragraphs} ¶</span>
          {stats.codeBlocks > 0 ? (
            <>
              <span>·</span>
              <span>{stats.codeBlocks} code {stats.codeBlocks === 1 ? 'block' : 'blocks'}</span>
            </>
          ) : null}
          <span>·</span>
          <span>~{stats.readMins} min read</span>
          <span>·</span>
          <span title="Reading time up to your cursor position (iA Writer style)">
            Cursor time {stats.cursorMins}m {stats.cursorSecs}s (Ln {cursorMetrics.line}, Col {cursorMetrics.col})
          </span>
        </div>

        <div className="telemetry-right">
          <div className="telemetry-goal" title={`${stats.words} / ${wordGoal} word target (${goalProgress}%)`}>
            <span>Target {goalProgress}%</span>
            <div className="telemetry-goal-track">
              <div className="telemetry-goal-fill" style={{width: `${goalProgress}%`}} />
            </div>
          </div>
          <button
            type="button"
            className="telemetry-mode-pill"
            data-active={typewriter}
            onClick={() => setTypewriter((t) => !t)}
          >
            Typewriter {typewriter ? 'ON' : 'OFF'}
          </button>
          <button
            type="button"
            className="telemetry-mode-pill"
            data-active={focusSpot}
            onClick={() => setFocusSpot((f) => !f)}
          >
            Focus {focusSpot ? 'ON' : 'OFF'}
          </button>
        </div>
      </footer>
    </div>
  );
}
