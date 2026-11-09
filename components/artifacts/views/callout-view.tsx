'use client';

import type {ArtifactDocument} from '../../../lib/artifacts/schema';

export default function CalloutView({artifact}: {artifact: ArtifactDocument}) {
  const view = artifact.view;
  if (view.type !== 'callout') return null;
  return (
    <div className="note">
      <p>{view.text}</p>
    </div>
  );
}
