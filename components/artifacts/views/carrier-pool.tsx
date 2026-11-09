'use client';

import {useId, useState} from 'react';
import {readCarrierPool} from '../../../lib/artifacts/carrier-pool';
import {clampParam, type ArtifactDocument, type Param} from '../../../lib/artifacts/schema';

function Cells({count, active, activeState, idleState}: {count: number; active: number; activeState: string; idleState: string}) {
  return (
    <div className="artifact-cells" aria-hidden="true">
      {Array.from({length: count}, (_, index) => {
        const state = index < active ? activeState : idleState;
        const quiet = state === 'waiting' || state === 'idle' || state === 'free';
        return (
          <svg key={index} width="28" height="22" viewBox="0 0 28 22">
            <rect className="artifact-cell" data-state={state} x="0.5" y="0.5" width="27" height="21" rx="5" />
            {quiet ? <line x1="8" y1="11" x2="20" y2="11" stroke="currentColor" /> : <rect x="10" y="7" width="8" height="8" rx="2" fill="currentColor" />}
          </svg>
        );
      })}
    </div>
  );
}

function Slider({param, value, onChange, scope}: {param: Param; value: number; onChange: (next: number) => void; scope: string}) {
  const current = clampParam(param, value);
  const inputId = `${scope}-${param.id}`;
  return (
    <label htmlFor={inputId}>
      <span>{param.label}</span>
      <input
        id={inputId}
        type="range"
        min={param.min}
        max={param.max}
        step={param.step}
        value={current}
        aria-valuetext={`${current} ${param.label}`}
        onChange={(event) => onChange(clampParam(param, Number(event.target.value)))}
      />
      <strong>{current}</strong>
    </label>
  );
}

export default function CarrierPoolView({artifact}: {artifact: ArtifactDocument}) {
  const view = artifact.view;
  const scope = useId();
  const [requests, setRequests] = useState(view.type === 'carrier-pool' ? view.requests.default : 1);
  const [platformThreads, setPlatformThreads] = useState(view.type === 'carrier-pool' ? view.platformThreads.default : 1);
  const [connections, setConnections] = useState(view.type === 'carrier-pool' ? view.connections.default : 1);
  if (view.type !== 'carrier-pool') return null;
  const reading = readCarrierPool(
    clampParam(view.requests, requests),
    clampParam(view.platformThreads, platformThreads),
    clampParam(view.connections, connections),
  );

  return (
    <>
      <div className="artifact-rows">
        <div className="artifact-row">
          <div className="artifact-row-label">
            <strong>Platform threads</strong>
            <span>{reading.mounted} mounted, {reading.idleThreads} idle</span>
          </div>
          <div role="img" aria-label={`Platform threads, ${reading.mounted} mounted, ${reading.idleThreads} idle`}>
            <Cells count={reading.platformThreads} active={reading.mounted} activeState="mounted" idleState="idle" />
          </div>
        </div>
        <div className="artifact-row">
          <div className="artifact-row-label">
            <strong>Virtual threads</strong>
            <span>{reading.running} running, {reading.waiting} waiting</span>
          </div>
          <div role="img" aria-label={`Virtual threads, ${reading.running} running, ${reading.waiting} waiting`}>
            <Cells count={reading.requests} active={reading.running} activeState="running" idleState="waiting" />
          </div>
        </div>
        <div className="artifact-row">
          <div className="artifact-row-label">
            <strong>Database connections</strong>
            <span>{reading.running} busy, {reading.idleConnections} free</span>
          </div>
          <div role="img" aria-label={`Database connections, ${reading.running} busy, ${reading.idleConnections} free`}>
            <Cells count={reading.connections} active={reading.running} activeState="busy" idleState="free" />
          </div>
        </div>
      </div>
      <p className="artifact-readout" aria-live="polite">{reading.text}</p>
      <div className="artifact-controls">
        <Slider param={view.requests} value={requests} onChange={setRequests} scope={scope} />
        <Slider param={view.platformThreads} value={platformThreads} onChange={setPlatformThreads} scope={scope} />
        <Slider param={view.connections} value={connections} onChange={setConnections} scope={scope} />
      </div>
    </>
  );
}
