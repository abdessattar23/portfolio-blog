'use client';

import {useState} from 'react';
import {parseCompare, parseWalk} from '../lib/content/demos';

export function ArticleDemo({name, body}: {name: string; body: string}) {
  if (name === 'walk') return <WalkDemo body={body} />;
  if (name === 'compare') return <CompareDemo body={body} />;
  return <p>Unknown demo: {name}</p>;
}

function WalkDemo({body}: {body: string}) {
  const demo = parseWalk(body);
  const steps = demo.steps.length > 0 ? demo.steps : ['Add a step in the studio demo tool.'];
  const [index, setIndex] = useState(0);
  const current = Math.min(index, steps.length - 1);
  const text = steps[current] ?? '';

  return (
    <div className="demo demo-walk">
      <div className="demo-head">
        <strong>{demo.title}</strong>
        <span>INTERACTIVE</span>
      </div>
      <div className="demo-rail" role="tablist" aria-label={demo.title}>
        {steps.map((step, stepIndex) => (
          <button
            key={`${stepIndex}-${step}`}
            type="button"
            role="tab"
            aria-selected={stepIndex === current}
            onClick={() => setIndex(stepIndex)}
          >
            {stepIndex + 1}
          </button>
        ))}
      </div>
      <p className="demo-stage" aria-live="polite">{text}</p>
      <div className="demo-controls">
        <span>Step {current + 1} of {steps.length}</span>
        <div className="demo-nav">
          <button type="button" onClick={() => setIndex((value) => Math.max(0, value - 1))} disabled={current === 0}>
            Back
          </button>
          <button type="button" onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))} disabled={current === steps.length - 1}>
            Next
          </button>
        </div>
      </div>
    </div>
  );
}

function CompareDemo({body}: {body: string}) {
  const demo = parseCompare(body);
  const [showAfter, setShowAfter] = useState(false);

  return (
    <div className="demo demo-compare">
      <div className="demo-head">
        <strong>{demo.title}</strong>
        <span>COMPARE</span>
      </div>
      <div className="toggle" role="group" aria-label={demo.title}>
        <button type="button" aria-pressed={!showAfter} onClick={() => setShowAfter(false)}>Before</button>
        <button type="button" aria-pressed={showAfter} onClick={() => setShowAfter(true)}>After</button>
      </div>
      <div className="demo-pair">
        <article data-dim={showAfter ? 'true' : 'false'}>
          <small>Before</small>
          <p>{demo.before || 'Describe the earlier state.'}</p>
        </article>
        <article data-dim={showAfter ? 'false' : 'true'}>
          <small>After</small>
          <p>{demo.after || 'Describe what changed.'}</p>
        </article>
      </div>
    </div>
  );
}
