'use client';

import {lazy, Suspense, useId} from 'react';
import type {ArtifactDocument} from '../../lib/artifacts/schema';
import CarrierPoolView from './views/carrier-pool';

const GraphView = lazy(() => import('./views/graph-view'));
const SequenceView = lazy(() => import('./views/sequence-view'));
const FramesView = lazy(() => import('./views/frames-view'));
const CodeCompareView = lazy(() => import('./views/code-compare-view'));
const CalloutView = lazy(() => import('./views/callout-view'));
const SvgSceneView = lazy(() => import('./views/svg-scene-view'));

function classificationLabel(artifact: ArtifactDocument): string {
  if (artifact.view.type === 'carrier-pool') return 'Conceptual simulation, not a measurement';
  if (artifact.classification === 'measured') return 'Measured figure';
  return 'Conceptual figure, not a measurement';
}

function View({artifact}: {artifact: ArtifactDocument}) {
  if (artifact.view.type === 'carrier-pool') return <CarrierPoolView artifact={artifact} />;
  return (
    <Suspense fallback={<p className="artifact-summary">{artifact.summary}</p>}>
      {artifact.view.type === 'architecture' || artifact.view.type === 'flowchart' ? <GraphView artifact={artifact} /> : null}
      {artifact.view.type === 'sequence' ? <SequenceView artifact={artifact} /> : null}
      {artifact.view.type === 'frames' ? <FramesView artifact={artifact} /> : null}
      {artifact.view.type === 'code-compare' ? <CodeCompareView artifact={artifact} /> : null}
      {artifact.view.type === 'callout' ? <CalloutView artifact={artifact} /> : null}
      {artifact.view.type === 'svg-scene' ? <SvgSceneView artifact={artifact} /> : null}
    </Suspense>
  );
}

export function ArtifactFigure({id, artifacts = []}: {id: string; artifacts?: readonly ArtifactDocument[]}) {
  const titleId = useId();
  const artifact = artifacts.find((item) => item.id === id);
  if (!artifact) {
    return (
      <figure className="artifact">
        <p className="artifact-kicker">Figure</p>
        <h3>This figure is not available</h3>
        <p className="artifact-summary">No saved artifact matches this reference.</p>
      </figure>
    );
  }

  const resetKey = artifact.view.type === 'carrier-pool'
    ? `${artifact.id}:${artifact.view.requests.default}:${artifact.view.platformThreads.default}:${artifact.view.connections.default}`
    : artifact.id;

  return (
    <figure className="artifact" aria-labelledby={titleId}>
      <p className="artifact-kicker">{classificationLabel(artifact)}</p>
      <h3 id={titleId}>{artifact.title}</h3>
      <p className="artifact-summary">{artifact.summary}</p>
      <View key={resetKey} artifact={artifact} />
    </figure>
  );
}
