'use client';

import {useEffect, useState} from 'react';

function buildPayload(slug: string, values: Record<string, string>): string {
  const payload: Record<string, string | number | string[]> = {...values, slug};
  const number = values['number'];
  const names = values['alternateNames'];
  const topics = values['knowsAbout'];
  if (typeof number === 'string') {
    const parsedNumber = Number.parseInt(number.trim(), 10);
    if (Number.isInteger(parsedNumber)) payload['number'] = parsedNumber;
    else delete payload['number'];
  }
  if (typeof names === 'string') payload['alternateNames'] = names.split('\n').map((item) => item.trim()).filter(Boolean);
  if (typeof topics === 'string') payload['knowsAbout'] = topics.split('\n').map((item) => item.trim()).filter(Boolean);
  return JSON.stringify(payload);
}

export function RecordEditor({id, slug, frontmatter, fields}: {id: string; slug: string; frontmatter: string; fields: string[]}) {
  const [values, setValues] = useState<Record<string, string>>(() => read(frontmatter));
  const [status, setStatus] = useState('Draft');
  const [dirty, setDirty] = useState(false);

  const serializedFrontmatter = buildPayload(slug, values);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => {
      void fetch(`/api/studio/drafts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, frontmatter: serializedFrontmatter, body: ''}),
      }).then((response) => setStatus(response.ok ? 'Saved' : 'Could not save'));
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, serializedFrontmatter, id, slug]);

  return (
    <div className="studio-write">
      {fields.map((field) => (
        <label key={field}>{field}
          {field === 'summary' || field === 'problem' || field === 'change' || field === 'verification' || field === 'boundary' || field === 'bio' || field === 'detail' || field === 'alternateNames' || field === 'knowsAbout' ? (
            <textarea value={values[field] ?? ''} onChange={(event) => { setValues((current) => ({...current, [field]: event.target.value})); setDirty(true); }} />
          ) : (
            <input value={values[field] ?? ''} onChange={(event) => { setValues((current) => ({...current, [field]: event.target.value})); setDirty(true); }} />
          )}
        </label>
      ))}
      <p className="studio-status">{status}</p>
      <div className="studio-actions">
        <form action="/api/studio/publish" method="post" onSubmit={() => setDirty(false)}>
          <input type="hidden" name="id" value={id} />
          <input type="hidden" name="frontmatter" value={serializedFrontmatter} />
          <input type="hidden" name="body" value="" />
          <button type="submit">Publish</button>
        </form>
        <form action={`/api/studio/drafts/${id}`} method="post" onSubmit={() => setDirty(false)}>
          <input type="hidden" name="_action" value="delete" />
          <button type="submit">Discard draft</button>
        </form>
      </div>
    </div>
  );
}

function read(raw: string): Record<string, string> {
  const parsed: unknown = JSON.parse(raw);
  if (typeof parsed !== 'object' || parsed === null) return {};
  const values: Record<string, string> = {};
  for (const [key, value] of Object.entries(parsed)) {
    if (typeof value === 'string' || typeof value === 'number') values[key] = String(value);
    if (Array.isArray(value)) values[key] = value.filter((item): item is string => typeof item === 'string').join('\n');
  }
  return values;
}
