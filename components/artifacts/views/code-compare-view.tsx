'use client';

import {useState} from 'react';
import type {ArtifactDocument} from '../../../lib/artifacts/schema';

export default function CodeCompareView({artifact}: {artifact: ArtifactDocument}) {
  const view = artifact.view;
  const [showAfter, setShowAfter] = useState(false);
  if (view.type !== 'code-compare') return null;

  return (
    <>
      <div className="toggle" role="group" aria-label={artifact.title}>
        <button type="button" aria-pressed={!showAfter} onClick={() => setShowAfter(false)}>{view.beforeLabel}</button>
        <button type="button" aria-pressed={showAfter} onClick={() => setShowAfter(true)}>{view.afterLabel}</button>
      </div>
      <div className="demo-pair">
        <article data-dim={showAfter ? 'true' : 'false'}>
          <small>{view.beforeLabel}</small>
          <pre><code>{view.before}</code></pre>
        </article>
        <article data-dim={showAfter ? 'false' : 'true'}>
          <small>{view.afterLabel}</small>
          <pre><code>{view.after}</code></pre>
        </article>
      </div>
    </>
  );
}
