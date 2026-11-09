'use client';

import {useMemo, useState} from 'react';
import {ArtifactFigure} from '../../components/artifacts/artifact-figure';
import {carrierPoolTemplate} from '../../lib/artifacts/carrier-pool';
import {artifactFence} from '../../lib/artifacts/format';
import {parseArtifact, type ArtifactDocument, type Param} from '../../lib/artifacts/schema';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function replaceParam(artifact: ArtifactDocument, key: 'requests' | 'platformThreads' | 'connections', param: Param): ArtifactDocument {
  if (artifact.view.type !== 'carrier-pool') return artifact;
  return {...artifact, view: {...artifact.view, [key]: param}};
}

function fit(param: Param, patch: Partial<Pick<Param, 'label' | 'min' | 'max' | 'default'>>): Param {
  const next = {...param, ...patch};
  if (!(next.max > next.min)) next.max = next.min + next.step;
  if (next.default < next.min) next.default = next.min;
  if (next.default > next.max) next.default = next.max;
  return next;
}

export function ArtifactComposer({
  artifacts,
  onSaved,
  onInsert,
}: {
  artifacts: readonly ArtifactDocument[];
  onSaved: (artifact: ArtifactDocument) => void;
  onInsert: (fence: string) => void;
}) {
  const [selected, setSelected] = useState(artifacts[0]?.id ?? '');
  const [creating, setCreating] = useState(artifacts.length === 0);
  const [draft, setDraft] = useState<ArtifactDocument>(() => artifacts[0] ?? carrierPoolTemplate('new-simulation'));
  const [error, setError] = useState('');
  const [note, setNote] = useState('');
  const [saving, setSaving] = useState(false);
  const previewArtifacts = useMemo(
    () => [draft, ...artifacts.filter((artifact) => artifact.id !== draft.id)],
    [artifacts, draft],
  );

  function choose(id: string) {
    setCreating(false);
    setError('');
    setNote('');
    setSelected(id);
    const found = artifacts.find((artifact) => artifact.id === id);
    if (found) setDraft(found);
  }

  function startNew() {
    setCreating(true);
    setSelected('');
    setError('');
    setNote('');
    setDraft(carrierPoolTemplate('new-simulation'));
  }

  async function save(insert: boolean) {
    const parsed = parseArtifact(draft);
    if (!parsed.ok) {
      setError(parsed.errors.join(' '));
      return;
    }
    setSaving(true);
    setError('');
    const response = await fetch('/api/studio/artifacts', {
      method: 'PUT',
      headers: {'content-type': 'application/json'},
      body: JSON.stringify({document: parsed.artifact, create: creating}),
    });
    const payload: unknown = await response.json().catch(() => null);
    setSaving(false);
    if (!response.ok) {
      const errors = isRecord(payload) && Array.isArray(payload['errors']) ? payload['errors'].filter((item): item is string => typeof item === 'string') : [];
      setError(errors.join(' ') || 'The figure could not be saved.');
      return;
    }
    const saved = isRecord(payload) ? parseArtifact(payload['artifact']) : parsed;
    const artifact = saved.ok ? saved.artifact : parsed.artifact;
    onSaved(artifact);
    setDraft(artifact);
    setCreating(false);
    setSelected(artifact.id);
    setNote('Saved in the studio. Publishing the note is still a separate step.');
    if (insert) onInsert(artifactFence(artifact.id));
  }

  const carrier = draft.view.type === 'carrier-pool' ? draft.view : null;

  return (
    <div className="demo-step-list">
      <label className="inspector-field">
        <span>Saved figures</span>
        <select value={creating ? '' : selected} onChange={(event) => (event.target.value === '' ? startNew() : choose(event.target.value))}>
          <option value="">New simulation</option>
          {artifacts.map((artifact) => (
            <option key={artifact.id} value={artifact.id}>{artifact.title}</option>
          ))}
        </select>
      </label>
      {carrier ? (
        <>
          <label className="inspector-field">
            <span>Id</span>
            <input
              value={draft.id}
              disabled={!creating}
              onChange={(event) => setDraft({...draft, id: event.target.value.trim().toLowerCase()})}
            />
          </label>
          <label className="inspector-field">
            <span>Title</span>
            <input value={draft.title} onChange={(event) => setDraft({...draft, title: event.target.value})} />
          </label>
          <label className="inspector-field">
            <span>Summary</span>
            <textarea rows={3} value={draft.summary} onChange={(event) => setDraft({...draft, summary: event.target.value})} />
          </label>
          {(['requests', 'platformThreads', 'connections'] as const).map((key) => {
            const param = carrier[key];
            return (
              <div key={key} className="demo-step-list">
                <label className="inspector-field">
                  <span>{param.label}</span>
                  <input value={param.label} onChange={(event) => setDraft(replaceParam(draft, key, fit(param, {label: event.target.value})))} />
                </label>
                <div className="artifact-param-row">
                  <label className="inspector-field">
                    <span>Min</span>
                    <input type="number" value={param.min} onChange={(event) => setDraft(replaceParam(draft, key, fit(param, {min: Number(event.target.value)})))} />
                  </label>
                  <label className="inspector-field">
                    <span>Max</span>
                    <input type="number" value={param.max} onChange={(event) => setDraft(replaceParam(draft, key, fit(param, {max: Number(event.target.value)})))} />
                  </label>
                  <label className="inspector-field">
                    <span>Default</span>
                    <input type="number" value={param.default} onChange={(event) => setDraft(replaceParam(draft, key, fit(param, {default: Number(event.target.value)})))} />
                  </label>
                </div>
              </div>
            );
          })}
        </>
      ) : (
        <p>This {draft.view.type} figure can be previewed and inserted. Create or change its JSON with the studio MCP tools.</p>
      )}
      <ArtifactFigure id={draft.id} artifacts={previewArtifacts} />
      {error ? <p>{error}</p> : null}
      {note ? <p>{note}</p> : null}
      <div className="desk-card-actions">
        {carrier ? (
          <button type="button" className="atelier-btn-primary" disabled={saving} onClick={() => void save(false)}>
            {saving ? 'Saving…' : 'Save figure'}
          </button>
        ) : null}
        <button type="button" className="atelier-btn-ghost" disabled={saving} onClick={() => void (carrier ? save(true) : onInsert(artifactFence(draft.id)))}>
          Insert into note
        </button>
      </div>
    </div>
  );
}
