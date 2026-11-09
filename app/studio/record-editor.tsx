'use client';

import {useEffect, useState} from 'react';

export function RecordEditor({id, slug, frontmatter, fields}: {id: string; slug: string; frontmatter: string; fields: string[]}) {
  const [values, setValues] = useState<Record<string, string>>(() => read(frontmatter));
  const [status, setStatus] = useState('Draft');
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => {
      const payload: Record<string, string | number | string[]> = {...values};
      const number = values['number'];
      const names = values['alternateNames'];
      const topics = values['knowsAbout'];
      if (typeof number === 'string') payload['number'] = Number(number);
      if (typeof names === 'string') payload['alternateNames'] = names.split('\n').map((item) => item.trim()).filter(Boolean);
      if (typeof topics === 'string') payload['knowsAbout'] = topics.split('\n').map((item) => item.trim()).filter(Boolean);
      void fetch(`/api/studio/drafts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, frontmatter: JSON.stringify(payload), body: ''}),
      }).then((response) => setStatus(response.ok ? 'Saved' : 'Could not save'));
    }, 800);
    return () => clearTimeout(timer);
  }, [dirty, values, id, slug]);

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
      <form action="/api/studio/publish" method="post"><input type="hidden" name="id" value={id} /><button type="submit">Publish</button></form>
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
