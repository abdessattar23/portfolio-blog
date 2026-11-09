'use client';

import {useState} from 'react';

function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export function NewTalkForm({
  compact = false,
  onCancel,
  submitLabel = 'New talk →',
}: {
  compact?: boolean;
  onCancel?: () => void;
  submitLabel?: string;
}) {
  const [title, setTitle] = useState('');
  const [slug, setSlug] = useState('');
  const [slugEdited, setSlugEdited] = useState(false);
  const visibleSlug = slugEdited ? slug : slugify(title);

  return (
    <form className={compact ? 'desk-talk-form' : 'atelier-modal-form'} action="/api/studio/drafts" method="post">
      <input type="hidden" name="kind" value="talk" />
      <input type="hidden" name="slug" value={visibleSlug} />
      <input type="hidden" name="title" value={title} />
      <label className="desk-slug-field">
        <span>Title</span>
        <input
          required
          value={title}
          placeholder="How the JVM actually schedules a thread"
          autoFocus={!compact}
          onChange={(event) => setTitle(event.target.value)}
        />
      </label>
      <label className="desk-slug-field">
        <span>Slug, only if you want a different URL</span>
        <div className="atelier-slug-input">
          <span>/speaking/</span>
          <input
            value={visibleSlug}
            placeholder="filled from the title"
            pattern="[a-z0-9-]*"
            onChange={(event) => {
              const next = event.target.value.toLowerCase().replace(/[^a-z0-9-]+/g, '-').replace(/^-+/, '');
              if (!next) {
                setSlugEdited(false);
                setSlug('');
                return;
              }
              setSlugEdited(true);
              setSlug(next);
            }}
          />
        </div>
      </label>
      <div className={onCancel ? 'atelier-modal-actions' : 'desk-new-form-actions'}>
        {onCancel ? (
          <button type="button" className="atelier-btn-ghost" onClick={onCancel}>
            Cancel
          </button>
        ) : null}
        <button type="submit" className="atelier-btn-primary">{submitLabel}</button>
      </div>
    </form>
  );
}
