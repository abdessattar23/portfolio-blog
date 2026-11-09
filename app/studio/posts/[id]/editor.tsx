'use client';

import {useEffect, useState} from 'react';
import {POST_TEMPLATES, type PostTemplate} from '../../../../lib/content/schema';
import {findDuplicates} from '../../../../lib/content/duplicates';
import {MarkdownView} from '../../../../lib/content/render';
import {seoHealth} from '../../../../lib/studio/seo';

type Fields = {
  title: string;
  description: string;
  excerpt: string;
  publishedAt: string;
  updatedAt: string;
  topics: string[];
  template: PostTemplate;
  draft: boolean;
  accent?: string;
};

function isTemplate(value: string): value is PostTemplate {
  return (POST_TEMPLATES as readonly string[]).includes(value);
}

function readFields(raw: string): Fields {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) throw new Error('Draft fields are unreadable.');
  const record = parsed as Record<string, unknown>;
  const template = typeof record.template === 'string' && isTemplate(record.template) ? record.template : 'deep-dive';
  const topics = Array.isArray(record.topics) ? record.topics.filter((topic): topic is string => typeof topic === 'string') : [];
  const accent = typeof record.accent === 'string' ? record.accent : undefined;
  return {
    title: typeof record.title === 'string' ? record.title : '',
    description: typeof record.description === 'string' ? record.description : '',
    excerpt: typeof record.excerpt === 'string' ? record.excerpt : '',
    publishedAt: typeof record.publishedAt === 'string' ? record.publishedAt : '',
    updatedAt: typeof record.updatedAt === 'string' ? record.updatedAt : '',
    topics,
    template,
    draft: record.draft !== false,
    ...(accent !== undefined ? {accent} : {}),
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
  const initial = readFields(frontmatter);
  const [fields, setFields] = useState(initial);
  const [markdown, setMarkdown] = useState(body);
  const [status, setStatus] = useState('Draft');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => {
      void fetch(`/api/studio/drafts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, frontmatter: JSON.stringify(fields), body: markdown}),
      }).then((response) => setStatus(response.ok ? 'Saved' : 'Could not save'));
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, fields, markdown, id, slug]);

  function update(next: Partial<Fields>) {
    setFields((current) => ({...current, ...next}));
    setDirty(true);
    setStatus('Editing');
  }

  async function upload(file: File) {
    const form = new FormData();
    form.set('file', file);
    form.set('slug', slug);
    const response = await fetch('/api/studio/media', {method: 'POST', body: form});
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
        <label>Accent <input value={fields.accent ?? ''} placeholder="#3155d9" onChange={(event) => update(event.target.value ? {accent: event.target.value} : {})} /></label>
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
          <form action="/api/studio/publish" method="post"><input type="hidden" name="id" value={id} /><button type="submit">Publish</button></form>
          <form action="/api/studio/unpublish" method="post"><input type="hidden" name="id" value={id} /><button type="submit">Unpublish</button></form>
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
