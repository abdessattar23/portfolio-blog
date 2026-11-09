'use client';

import {useId} from 'react';
import type {ArtifactDocument} from '../../../lib/artifacts/schema';

export default function SequenceView({artifact}: {artifact: ArtifactDocument}) {
  const view = artifact.view;
  const markerId = `arrow-${useId().replace(/:/g, '')}`;
  if (view.type !== 'sequence') return null;
  const gap = 150;
  const width = 40 + view.participants.length * gap;
  const height = 78 + Math.max(1, view.messages.length) * 42;
  const xOf = new Map(view.participants.map((name, index) => [name, 70 + index * gap]));

  return (
    <div className="artifact-scroll">
      <svg className="artifact-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={artifact.summary}>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
          </marker>
        </defs>
        {view.participants.map((name) => {
          const x = xOf.get(name) ?? 0;
          return (
            <g key={name}>
              <text x={x} y="18" textAnchor="middle">{name}</text>
              <line x1={x} y1="28" x2={x} y2={height - 16} stroke="currentColor" strokeDasharray="3 4" />
            </g>
          );
        })}
        {view.messages.map((message, index) => {
          const y = 58 + index * 42;
          const x1 = xOf.get(message.from) ?? 0;
          const x2 = xOf.get(message.to) ?? 0;
          const forward = x2 >= x1;
          return (
            <g key={`${message.from}-${message.to}-${index}`}>
              <line
                x1={x1}
                y1={y}
                x2={forward ? x2 - 8 : x2 + 8}
                y2={y}
                stroke="currentColor"
                markerEnd={`url(#${markerId})`}
              />
              <text x={(x1 + x2) / 2} y={y - 8} textAnchor="middle">{message.label}</text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
