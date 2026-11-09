'use client';

import {useState} from 'react';
import type {ArtifactDocument} from '../../../lib/artifacts/schema';

export default function FramesView({artifact}: {artifact: ArtifactDocument}) {
  const view = artifact.view;
  const [index, setIndex] = useState(0);
  if (view.type !== 'frames') return null;
  const frames = view.frames;
  const current = Math.min(index, frames.length - 1);
  const frame = frames[current];
  if (!frame) return null;

  function move(next: number) {
    setIndex(Math.min(frames.length - 1, Math.max(0, next)));
  }

  return (
    <div
      onKeyDown={(event) => {
        if (event.key === 'ArrowRight') move(current + 1);
        if (event.key === 'ArrowLeft') move(current - 1);
      }}
    >
      <div className="demo-rail" role="tablist" aria-label={artifact.title}>
        {frames.map((item, step) => (
          <button key={`${step}-${item.title}`} type="button" role="tab" aria-selected={step === current} onClick={() => move(step)}>
            {step + 1}
          </button>
        ))}
      </div>
      <p className="artifact-readout" aria-live="polite"><strong>{frame.title}. </strong>{frame.text}</p>
      <div className="demo-controls">
        <span>Step {current + 1} of {frames.length}</span>
        <div className="demo-nav">
          <button type="button" onClick={() => move(current - 1)} disabled={current === 0}>Back</button>
          <button type="button" onClick={() => move(current + 1)} disabled={current === frames.length - 1}>Next</button>
        </div>
      </div>
    </div>
  );
}
