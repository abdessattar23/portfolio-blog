'use client';

import {useState} from 'react';

const STEPS = {
  forward: [
    'Start with two entries in the same bucket. A is stale. B is live.',
    'Visit index 0: remove stale A. Live B shifts into index 0.',
    'Increment i to 1. The bucket now has length 1, so iteration ends. B was never visited.',
  ],
  backward: [
    'Start at the last entry, index 1. A is stale. B is live.',
    'Visit live B at index 1. Decrement the index to 0.',
    'Visit stale A at index 0 and remove it. B has already been visited.',
  ],
} as const;

export default function BucketDemo() {
  const [reverse, setReverse] = useState(false);
  const [step, setStep] = useState(0);

  const gone = reverse ? step === 2 : step > 0;
  const visitedB = reverse && step > 0;
  const notes = reverse ? STEPS.backward : STEPS.forward;

  function selectDirection(nextReverse: boolean) {
    setReverse(nextReverse);
    setStep(0);
  }

  return (
    <div className="demo">
      <div className="demo-head">
        <strong>Walk through one bucket</strong>
        <span>SIMPLIFIED EXAMPLE</span>
      </div>
      <div className="toggle" role="group" aria-label="Traversal direction">
        <button type="button" aria-pressed={!reverse} onClick={() => selectDirection(false)}>
          Forward traversal
        </button>
        <button type="button" aria-pressed={reverse} onClick={() => selectDirection(true)}>
          Backward traversal
        </button>
      </div>
      <div className="bucket">
        {!gone && (
          <div className="bucket-cell stale">
            <small>INDEX 0</small>
            <strong>A</strong>
            <span>stale</span>
          </div>
        )}
        <div className={`bucket-cell${visitedB ? ' visited' : ''}`}>
          <small>INDEX {gone ? '0' : '1'}</small>
          <strong>B</strong>
          <span>{visitedB ? 'visited' : 'live'}</span>
        </div>
        {!reverse && step === 2 && <span className="skipped">B skipped</span>}
      </div>
      <p aria-live="polite">{notes[step]}</p>
      <div className="demo-controls">
        <span>Step {step + 1} of 3</span>
        <button type="button" onClick={() => setStep(step === 2 ? 0 : step + 1)}>
          {step === 2 ? 'Reset example' : 'Next step'} →
        </button>
      </div>
    </div>
  );
}
