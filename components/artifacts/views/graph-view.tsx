'use client';

import {useId} from 'react';
import type {ArtifactDocument} from '../../../lib/artifacts/schema';

const COLUMN = 176;
const ROW = 84;

export default function GraphView({artifact}: {artifact: ArtifactDocument}) {
  const view = artifact.view;
  const markerId = `arrow-${useId().replace(/:/g, '')}`;
  if (view.type !== 'architecture' && view.type !== 'flowchart') return null;
  const lanes = [...new Set(view.nodes.map((node) => node.lane ?? 'main'))];
  const used = new Map<string, number>();
  const placed = view.nodes.map((node) => {
    const lane = node.lane ?? 'main';
    const column = used.get(lane) ?? 0;
    used.set(lane, column + 1);
    return {node, column, row: Math.max(0, lanes.indexOf(lane))};
  });
  const columns = Math.max(1, ...placed.map((item) => item.column + 1));
  const width = 28 + columns * COLUMN;
  const height = 28 + Math.max(1, lanes.length) * ROW;
  const at = new Map(placed.map((item) => [item.node.id, item]));
  const radius = view.type === 'flowchart' ? 16 : 4;

  return (
    <div className="artifact-scroll">
      <svg className="artifact-graph" viewBox={`0 0 ${width} ${height}`} role="img" aria-label={artifact.summary}>
        <defs>
          <marker id={markerId} markerWidth="8" markerHeight="8" refX="8" refY="4" orient="auto">
            <path d="M0,0 L8,4 L0,8 Z" fill="currentColor" />
          </marker>
        </defs>
        {view.edges.map((edge, index) => {
          const from = at.get(edge.from);
          const to = at.get(edge.to);
          if (!from || !to) return null;
          const x1 = 24 + from.column * COLUMN + 148;
          const y1 = 20 + from.row * ROW + 22;
          const x2 = 24 + to.column * COLUMN;
          const y2 = 20 + to.row * ROW + 22;
          return (
            <g key={`${edge.from}-${edge.to}-${index}`}>
              <line x1={x1} y1={y1} x2={x2 - 8} y2={y2} stroke="currentColor" markerEnd={`url(#${markerId})`} />
              {edge.label ? <text x={(x1 + x2) / 2} y={(y1 + y2) / 2 - 8} textAnchor="middle">{edge.label}</text> : null}
            </g>
          );
        })}
        {placed.map(({node, column, row}) => (
          <g key={node.id} transform={`translate(${24 + column * COLUMN} ${20 + row * ROW})`}>
            <rect width="148" height="44" rx={radius} className="artifact-node" />
            <text x="74" y="27" textAnchor="middle">{node.label}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}
