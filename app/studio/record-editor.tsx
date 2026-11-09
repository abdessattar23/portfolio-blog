'use client';

import {useCallback, useEffect, useState} from 'react';

const FIELD_META: Record<string, {label: string; hint?: string; multiline?: boolean; rows?: number}> = {
  title: {label: 'Title', hint: 'Headline shown on the casebook or speaking index'},
  shortTitle: {label: 'Short title', hint: 'Compact title used in navigation and sidebars'},
  number: {label: 'Pull Request / Issue #', hint: 'Numeric identifier (e.g. 6412)'},
  topic: {label: 'Subsystem / Topic', hint: 'e.g. Memory & Allocation, Exporter Batching'},
  summary: {label: 'Executive summary', hint: 'Concise 1–2 sentence overview', multiline: true, rows: 3},
  problem: {label: 'The problem & failure mode', hint: 'What broke or allocated under load?', multiline: true, rows: 4},
  change: {label: 'The architectural change', hint: 'How the fix works and why this design won', multiline: true, rows: 4},
  verification: {label: 'Verification & benchmarks', hint: 'JMH benchmarks, unit tests, production evidence', multiline: true, rows: 3},
  boundary: {label: 'Scope boundary & trade-offs', hint: 'Where this optimization stops or what it trades off', multiline: true, rows: 3},
  noteSlug: {label: 'Linked blog note slug (optional)', hint: 'Slug of the companion deep-dive post'},
  status: {label: 'Status', hint: 'Delivered or Proposal'},
  event: {label: 'Conference / Event', hint: 'Event name and year'},
  detail: {label: 'Session detail & abstract', hint: 'Extended narrative or takeaways', multiline: true, rows: 4},
  name: {label: 'Short display name', hint: 'Used in page titles and headers'},
  fullName: {label: 'Full legal / professional name', hint: 'Used in structured data and footer'},
  handle: {label: 'Wordmark handle', hint: 'Top-left site signature'},
  role: {label: 'Primary role line', hint: 'Displayed in footer and metadata'},
  jobTitle: {label: 'Schema.org Job Title', hint: 'Used in Person JSON-LD graph'},
  employer: {label: 'Current employer', hint: 'Public line. Example: Sofrecom (Orange Group)'},
  location: {label: 'Location', hint: 'City and country, or the stage format'},
  bio: {label: 'Author biography', hint: 'Primary site description and intro bio', multiline: true, rows: 4},
  url: {label: 'Canonical HTTPS URL', hint: 'Must begin with https://'},
  github: {label: 'GitHub profile URL'},
  linkedin: {label: 'LinkedIn profile URL'},
  alternateNames: {label: 'Name variants (one per line)', hint: 'Feeds search identity graph', multiline: true, rows: 4},
  knowsAbout: {label: 'Core expertise topics (one per line)', hint: 'Feeds JSON-LD knowsAbout array', multiline: true, rows: 5},
};

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

export function RecordEditor({
  id,
  slug,
  frontmatter,
  fields,
  eyebrow = 'RECORD',
  heading = 'Edit record',
  subtitle,
}: {
  id: string;
  slug: string;
  frontmatter: string;
  fields: string[];
  eyebrow?: string;
  heading?: string;
  subtitle?: string;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => read(frontmatter));
  const [status, setStatus] = useState<'Draft' | 'Editing' | 'Saving…' | 'Saved' | 'Could not save'>('Draft');
  const [dirty, setDirty] = useState(false);

  const serializedFrontmatter = buildPayload(slug, values);

  const saveNow = useCallback(async () => {
    setStatus('Saving…');
    try {
      const response = await fetch(`/api/studio/drafts/${id}`, {
        method: 'PUT',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify({slug, frontmatter: serializedFrontmatter, body: ''}),
      });
      setStatus(response.ok ? 'Saved' : 'Could not save');
      if (response.ok) setDirty(false);
    } catch {
      setStatus('Could not save');
    }
  }, [id, slug, serializedFrontmatter]);

  useEffect(() => {
    if (!dirty) return undefined;
    const timer = setTimeout(() => {
      void saveNow();
    }, 750);
    return () => clearTimeout(timer);
  }, [dirty, saveNow]);

  return (
    <div className="atelier-record-stage">
      {/* Top Action Ribbon */}
      <div className="workbench-ribbon">
        <div className="workbench-ribbon-left">
          <a href="/studio" className="atelier-subtle-link">
            ← Writing Desk
          </a>
          <span className="workbench-divider" />
          <span className="eyebrow">{eyebrow} · {slug}</span>
        </div>

        <div className="workbench-ribbon-right">
          <button
            type="button"
            className="workbench-save-pill"
            data-state={status === 'Saved' ? 'saved' : status === 'Could not save' ? 'error' : 'dirty'}
            onClick={() => void saveNow()}
          >
            <span className="save-dot" />
            <span>{status}</span>
          </button>

          <form action="/api/studio/publish" method="post" onSubmit={() => setDirty(false)}>
            <input type="hidden" name="id" value={id} />
            <input type="hidden" name="frontmatter" value={serializedFrontmatter} />
            <input type="hidden" name="body" value="" />
            <button type="submit" className="atelier-btn-publish">
              Publish changes
            </button>
          </form>

          <form action={`/api/studio/drafts/${id}`} method="post" onSubmit={() => setDirty(false)}>
            <input type="hidden" name="_action" value="delete" />
            <button type="submit" className="atelier-btn-ghost">
              Discard
            </button>
          </form>
        </div>
      </div>

      {/* Record Sheet */}
      <div className="record-sheet-wrap">
        <div className="record-sheet">
          <header className="record-sheet-header">
            <div className="eyebrow">{eyebrow}</div>
            <h1>
              {values['title'] || values['fullName'] || heading}
              <span>.</span>
            </h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </header>

          <div className="record-fields-grid">
            {fields.map((field) => {
              const meta = FIELD_META[field] ?? {
                label: field,
                multiline:
                  field === 'summary' ||
                  field === 'problem' ||
                  field === 'change' ||
                  field === 'verification' ||
                  field === 'boundary' ||
                  field === 'bio' ||
                  field === 'detail' ||
                  field === 'alternateNames' ||
                  field === 'knowsAbout',
              };
              return (
                <label key={field} className="record-field" data-wide={meta.multiline ? 'true' : 'false'}>
                  <div className="record-field-head">
                    <strong>{meta.label}</strong>
                    <code>{field}</code>
                  </div>
                  {meta.hint ? <small>{meta.hint}</small> : null}
                  {field === 'status' ? (
                    <select
                      value={values[field] ?? 'Proposal'}
                      onChange={(event) => {
                        setValues((current) => ({...current, [field]: event.target.value}));
                        setDirty(true);
                        setStatus('Editing');
                      }}
                    >
                      <option value="Delivered">Delivered</option>
                      <option value="Proposal">Proposal</option>
                    </select>
                  ) : meta.multiline ? (
                    <textarea
                      rows={meta.rows ?? 4}
                      value={values[field] ?? ''}
                      onChange={(event) => {
                        setValues((current) => ({...current, [field]: event.target.value}));
                        setDirty(true);
                        setStatus('Editing');
                      }}
                    />
                  ) : (
                    <input
                      value={values[field] ?? ''}
                      onChange={(event) => {
                        setValues((current) => ({...current, [field]: event.target.value}));
                        setDirty(true);
                        setStatus('Editing');
                      }}
                    />
                  )}
                </label>
              );
            })}
          </div>
        </div>
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
