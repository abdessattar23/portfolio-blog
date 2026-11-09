'use client';

import type {ArtifactDocument} from '../../../lib/artifacts/schema';

export default function SvgSceneView({artifact}: {artifact: ArtifactDocument}) {
  const view = artifact.view;
  if (view.type !== 'svg-scene') return null;
  return (
    <svg className="artifact-graph" viewBox={`0 0 ${view.width} ${view.height}`} role="img" aria-label={artifact.summary}>
      {view.shapes.map((shape, index) => {
        if (shape.type === 'rect') {
          return (
            <g key={index}>
              <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} className="artifact-node" />
              {shape.label ? <text x={shape.x + 8} y={shape.y + Math.min(20, shape.height - 6)}>{shape.label}</text> : null}
            </g>
          );
        }
        if (shape.type === 'line') {
          return <line key={index} x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} stroke="currentColor" />;
        }
        if (shape.type === 'circle') {
          return (
            <g key={index}>
              <circle cx={shape.cx} cy={shape.cy} r={shape.r} className="artifact-node" />
              {shape.label ? <text x={shape.cx} y={shape.cy + 4} textAnchor="middle">{shape.label}</text> : null}
            </g>
          );
        }
        return <text key={index} x={shape.x} y={shape.y}>{shape.text}</text>;
      })}
    </svg>
  );
}
