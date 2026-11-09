'use client';

import {useEffect, useState} from 'react';
import {POST_TEMPLATES, type HomeDiff, type PostTemplate} from '../../../../lib/content/schema';
import {findDuplicates} from '../../../../lib/content/duplicates';
import {MarkdownView} from '../../../../lib/content/render';
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
};

function isTemplate(value: string): value is PostTemplate {
  return (POST_TEMPLATES as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function readFields(raw: string, fallbackSlug: string): Fields {
  const parsed: unknown = JSON.parse(raw);
  if (!isRecord(parsed)) throw new Error('Draft fields are unreadable.');
  const template = typeof parsed.template === 'string' && isTemplate(parsed.template) ? parsed.template : 'deep-dive';
  const topics = Array.isArray(parsed.topics) ? parsed.topics.filter((topic): topic is string => typeof topic === 'string') : [];
  const accent = typeof parsed.accent === 'string' && parsed.accent.trim() !== '' ? parsed.accent.trim() : undefined;
  const homeDiff =
    isRecord(parsed.homeDiff) &&
    typeof parsed.homeDiff.removed === 'string' &&
    typeof parsed.homeDiff.added === 'string'
      ? {removed: parsed.homeDiff.removed, added: parsed.homeDiff.added}
      : undefined;
  return {
    slug: typeof parsed.slug === 'string' && parsed.slug.trim() !== '' ? parsed.slug.trim() : fallbackSlug,
    title: typeof parsed.title === 'string' ? parsed.title : '',
    description: typeof parsed.description === 'string' ? parsed.description : '',
    excerpt: typeof parsed.excerpt === 'string' ? parsed.excerpt : '',
    publishedAt: typeof parsed.publishedAt === 'string' ? parsed.publishedAt : '',
    updatedAt: typeof parsed.updatedAt === 'string' ? parsed.updatedAt : '',
    topics,
    template,
    draft: parsed.draft !== false,
    ...(accent !== undefined ? {accent} : {}),
    ...(homeDiff !== undefined ? {homeDiff} : {}),
  };
}

export function PostEditor({
  id,
  slug,
  frontmatter,
  body,
  existing,
}: {
  id: string;
  slug: string;
  frontmatter: string;
  body: string;
  existing: {slug: string; title: string; description: string}[];
}) {
  const initial = readFields(frontmatter, slug);
  const [fields, setFields] = useState(initial);
  const [markdown, setMarkdown] = useState(body);
  const [status, setStatus] = useState('Draft');
  const [dirty, setDirty] = useState(false);

  const serializedFrontmatter = JSON.stringify({...fields, slug});

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => {
      void fetch(`/api/studio/drafts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, frontmatter: serializedFrontmatter, body: markdown}),
      }).then((response) => setStatus(response.ok ? 'Saved' : 'Could not save'));
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, serializedFrontmatter, markdown, id, slug]);

  function update(next: Partial<Fields>) {
    setFields((current) => ({...current, ...next, slug}));
    setDirty(true);
    setStatus('Editing');
  }

  function updateAccent(value: string) {
    setFields((current) => {
      const next: Fields = {
        slug,
        title: current.title,
        description: current.description,
        excerpt: current.excerpt,
        publishedAt: current.publishedAt,
        updatedAt: current.updatedAt,
        topics: current.topics,
        template: current.template,
        draft: current.draft,
        ...(value.trim() !== '' ? {accent: value.trim()} : {}),
        ...(current.homeDiff !== undefined ? {homeDiff: current.homeDiff} : {}),
      };
      return next;
    });
    setDirty(true);
    setStatus('Editing');
  }

  async function upload(file: File) {
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
      setMarkdown((current) => `${current}\n\n![${file.name}](${payload.url})\n`);
      setDirty(true);
    }
  }

  const notes = seoHealth({title: fields.title, description: fields.description, topics: fields.topics, body: markdown});
  const duplicates = findDuplicates({slug, title: fields.title, description: fields.description}, existing);

  return (
    <div className="studio-editor">
      <div className="studio-write">
        <label>Title <input value={fields.title} onChange={(event) => update({title: event.target.value})} /></label>
        <label>Description <textarea value={fields.description} onChange={(event) => update({description: event.target.value})} /></label>
        <label>Excerpt <textarea value={fields.excerpt} onChange={(event) => update({excerpt: event.target.value})} /></label>
        <label>Topics <input value={fields.topics.join(', ')} onChange={(event) => update({topics: event.target.value.split(',').map((topic) => topic.trim()).filter(Boolean)})} /></label>
        <label>Template
          <select value={fields.template} onChange={(event) => { if (isTemplate(event.target.value)) update({template: event.target.value}); }}>
            {POST_TEMPLATES.map((template) => <option key={template} value={template}>{template}</option>)}
          </select>
        </label>
        <label>Accent <input value={fields.accent ?? ''} placeholder="#3155d9" onChange={(event) => updateAccent(event.target.value)} /></label>
        <label className="studio-check"><input type="checkbox" checked={fields.draft} onChange={(event) => update({draft: event.target.checked})} /> Keep as draft</label>
        <label>Article
          <textarea
            className="studio-markdown"
            value={markdown}
            onChange={(event) => { setMarkdown(event.target.value); setDirty(true); setStatus('Editing'); }}
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
        </label>
        <p className="studio-status">{status}</p>
        <div className="studio-actions">
          <form action="/api/studio/publish" method="post" onSubmit={() => setDirty(false)}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="frontmatter" value={serializedFrontmatter} />
            <input type="hidden" name="body" value={markdown} />
            <button type="submit">Publish</button>
          </form>
          <form action="/api/studio/unpublish" method="post" onSubmit={() => setDirty(false)}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="frontmatter" value={serializedFrontmatter} />
            <input type="hidden" name="body" value={markdown} />
            <button type="submit">Unpublish</button>
          </form>
          <form action={`/api/studio/drafts/${id}`} method="post" onSubmit={() => setDirty(false)}>
            <input type="hidden" name="_action" value="delete" />
            <button type="submit">Discard draft</button>
          </form>
        </div>
      </div>
      <aside className="studio-side">
        <h2>Search</h2>
        <ul>{notes.map((note) => <li key={note.text} data-level={note.level}>{note.text}</li>)}</ul>
        {duplicates.blocked ? <p className="studio-alert">A post with this slug is already published. Publishing updates it.</p> : null}
        {duplicates.warnings.map((warning) => <p className="studio-alert" key={warning}>{warning}</p>)}
        <div className="search-preview">
          <p>abdessattar.dev › blog › {slug}</p>
          <strong>{fields.title || 'Untitled'}</strong>
          <span>{fields.description}</span>
        </div>
        <h2>Preview</h2>
        <article className="prose"><MarkdownView markdown={markdown} /></article>
      </aside>
    </div>
  );
}
