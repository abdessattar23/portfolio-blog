export const ARTIFACT_VERSION = 1;

const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const VIEW_TYPES = [
  'carrier-pool',
  'architecture',
  'flowchart',
  'sequence',
  'frames',
  'code-compare',
  'callout',
  'svg-scene',
] as const;

export type ArtifactViewType = (typeof VIEW_TYPES)[number];
export type ArtifactClassification = 'conceptual' | 'measured';

export type Param = {
  id: string;
  label: string;
  min: number;
  max: number;
  step: number;
  default: number;
};

export type GraphNode = {
  id: string;
  label: string;
  lane?: string;
};

export type GraphEdge = {
  from: string;
  to: string;
  label?: string;
};

export type SequenceMessage = {
  from: string;
  to: string;
  label: string;
};

export type ArtifactFrame = {
  title: string;
  text: string;
};

export type SvgShape =
  | {type: 'rect'; x: number; y: number; width: number; height: number; label?: string}
  | {type: 'line'; x1: number; y1: number; x2: number; y2: number}
  | {type: 'circle'; cx: number; cy: number; r: number; label?: string}
  | {type: 'text'; x: number; y: number; text: string};

export type ArtifactView =
  | {type: 'carrier-pool'; requests: Param; platformThreads: Param; connections: Param}
  | {type: 'architecture'; nodes: GraphNode[]; edges: GraphEdge[]}
  | {type: 'flowchart'; nodes: GraphNode[]; edges: GraphEdge[]}
  | {type: 'sequence'; participants: string[]; messages: SequenceMessage[]}
  | {type: 'frames'; frames: ArtifactFrame[]}
  | {type: 'code-compare'; before: string; after: string; beforeLabel: string; afterLabel: string}
  | {type: 'callout'; text: string}
  | {type: 'svg-scene'; width: number; height: number; shapes: SvgShape[]};

export type ArtifactDocument = {
  version: 1;
  id: string;
  title: string;
  summary: string;
  classification: ArtifactClassification;
  view: ArtifactView;
};

export type ArtifactParse =
  | {ok: true; artifact: ArtifactDocument}
  | {ok: false; title: string; summary: string; errors: string[]};

const TITLE_LIMIT = 140;
const SUMMARY_LIMIT = 500;
const LABEL_LIMIT = 48;
const CODE_LIMIT = 2000;
const CALLOUT_LIMIT = 800;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail(title: string, summary: string, errors: string[]): ArtifactParse {
  return {
    ok: false,
    title: title.trim() || 'Artifact',
    summary: summary.trim() || 'This figure could not be read.',
    errors: errors.slice(0, 12),
  };
}

function hasMarkup(value: string): boolean {
  return /[<>]/.test(value) || /javascript:/i.test(value) || /[\u0000-\u001f]/.test(value);
}

function hasScript(value: string): boolean {
  return /<\s*\/?\s*script/i.test(value) || /javascript:/i.test(value) || /\bon[a-z]+\s*=/i.test(value);
}

function readPlain(value: unknown, label: string, max: number, errors: string[]): string | null {
  if (typeof value !== 'string') {
    errors.push(`${label} must be text.`);
    return null;
  }
  const text = value.trim();
  if (text === '' || text.length > max) {
    errors.push(`${label} must be 1–${max} characters.`);
    return null;
  }
  if (hasMarkup(text)) {
    errors.push(`${label} cannot contain markup.`);
    return null;
  }
  return text;
}

function readCode(value: unknown, label: string, errors: string[]): string | null {
  if (typeof value !== 'string') {
    errors.push(`${label} must be text.`);
    return null;
  }
  const text = value.trim();
  if (text === '' || text.length > CODE_LIMIT) {
    errors.push(`${label} must be 1–${CODE_LIMIT} characters.`);
    return null;
  }
  if (hasScript(text)) {
    errors.push(`${label} cannot contain script.`);
    return null;
  }
  return text;
}

function readNumber(value: unknown, label: string, errors: string[]): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    errors.push(`${label} must be a finite number.`);
    return null;
  }
  return value;
}

function unknownFields(record: Record<string, unknown>, allowed: readonly string[], label: string, errors: string[]) {
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) errors.push(`${label} has an unknown field ${key}.`);
  }
}

function readParam(value: unknown, id: string, errors: string[]): Param | null {
  if (!isRecord(value)) {
    errors.push(`${id} must be a number control.`);
    return null;
  }
  unknownFields(value, ['id', 'label', 'min', 'max', 'step', 'default'], id, errors);
  if (value['id'] !== undefined && value['id'] !== id) errors.push(`${id} does not match its control name.`);
  const label = readPlain(value['label'], `${id} label`, LABEL_LIMIT, errors);
  const min = readNumber(value['min'], `${id} min`, errors);
  const max = readNumber(value['max'], `${id} max`, errors);
  const step = readNumber(value['step'], `${id} step`, errors);
  const fallback = readNumber(value['default'], `${id} default`, errors);
  if (label === null || min === null || max === null || step === null || fallback === null) return null;
  if (!(max > min) || !(step > 0) || (max - min) / step > 48) {
    errors.push(`${id} needs a small range and a positive step.`);
    return null;
  }
  if (fallback < min || fallback > max) {
    errors.push(`${id} default must sit inside the range.`);
    return null;
  }
  const steps = (fallback - min) / step;
  if (Math.abs(steps - Math.round(steps)) > 1e-6) {
    errors.push(`${id} default must land on a step.`);
    return null;
  }
  return {id, label, min, max, step, default: fallback};
}

export function clampParam(param: Param, value: number): number {
  if (!Number.isFinite(value)) return param.default;
  const steps = Math.round((value - param.min) / param.step);
  const snapped = param.min + steps * param.step;
  const clamped = Math.min(param.max, Math.max(param.min, snapped));
  const places = param.step < 1 ? 4 : 0;
  return Number(clamped.toFixed(places));
}

function readGraph(value: Record<string, unknown>, errors: string[]): {nodes: GraphNode[]; edges: GraphEdge[]} | null {
  unknownFields(value, ['type', 'nodes', 'edges'], 'graph', errors);
  if (!Array.isArray(value['nodes']) || value['nodes'].length < 1 || value['nodes'].length > 12) {
    errors.push('A graph needs 1–12 nodes.');
    return null;
  }
  if (!Array.isArray(value['edges']) || value['edges'].length > 16) {
    errors.push('A graph needs 0–16 edges.');
    return null;
  }
  const nodes: GraphNode[] = [];
  const ids = new Set<string>();
  for (const item of value['nodes']) {
    if (!isRecord(item)) {
      errors.push('Each node must be an object.');
      continue;
    }
    unknownFields(item, ['id', 'label', 'lane'], 'node', errors);
    const id = readPlain(item['id'], 'node id', 32, errors);
    const label = readPlain(item['label'], 'node label', 32, errors);
    if (id === null || !ID_PATTERN.test(id)) errors.push('Node ids use lowercase letters, numbers, and hyphens.');
    if (id === null || label === null) continue;
    if (ids.has(id)) errors.push(`Duplicate node ${id}.`);
    ids.add(id);
    const node: GraphNode = {id, label};
    if (item['lane'] !== undefined) {
      const lane = readPlain(item['lane'], 'lane', 24, errors);
      if (lane !== null) node.lane = lane;
    }
    nodes.push(node);
  }
  const edges: GraphEdge[] = [];
  for (const item of value['edges']) {
    if (!isRecord(item)) {
      errors.push('Each edge must be an object.');
      continue;
    }
    unknownFields(item, ['from', 'to', 'label'], 'edge', errors);
    const from = readPlain(item['from'], 'edge from', 32, errors);
    const to = readPlain(item['to'], 'edge to', 32, errors);
    if (from === null || to === null) continue;
    if (!ids.has(from) || !ids.has(to)) errors.push('Edges must connect known nodes.');
    const edge: GraphEdge = {from, to};
    if (item['label'] !== undefined) {
      const label = readPlain(item['label'], 'edge label', 32, errors);
      if (label !== null) edge.label = label;
    }
    edges.push(edge);
  }
  return {nodes, edges};
}

function readView(value: unknown, classification: ArtifactClassification, errors: string[]): ArtifactView | null {
  if (!isRecord(value)) {
    errors.push('view must be an object.');
    return null;
  }
  const type = value['type'];
  if (typeof type !== 'string' || !VIEW_TYPES.includes(type as ArtifactViewType)) {
    errors.push('Unknown view type.');
    return null;
  }
  if (type === 'carrier-pool') {
    unknownFields(value, ['type', 'requests', 'platformThreads', 'connections'], 'carrier-pool', errors);
    if (classification !== 'conceptual') errors.push('The carrier-pool view is a conceptual simulation and cannot be marked measured.');
    const requests = readParam(value['requests'], 'requests', errors);
    const platformThreads = readParam(value['platformThreads'], 'platformThreads', errors);
    const connections = readParam(value['connections'], 'connections', errors);
    if (!requests || !platformThreads || !connections) return null;
    return {type, requests, platformThreads, connections};
  }
  if (type === 'architecture' || type === 'flowchart') {
    const graph = readGraph(value, errors);
    if (!graph) return null;
    return {type, nodes: graph.nodes, edges: graph.edges};
  }
  if (type === 'sequence') {
    unknownFields(value, ['type', 'participants', 'messages'], 'sequence', errors);
    if (!Array.isArray(value['participants']) || value['participants'].length < 2 || value['participants'].length > 8) {
      errors.push('A sequence needs 2–8 participants.');
      return null;
    }
    if (!Array.isArray(value['messages']) || value['messages'].length > 12) {
      errors.push('A sequence needs 0–12 messages.');
      return null;
    }
    const participants: string[] = [];
    for (const item of value['participants']) {
      const name = readPlain(item, 'participant', 32, errors);
      if (name === null) continue;
      if (participants.includes(name)) errors.push(`Duplicate participant ${name}.`);
      participants.push(name);
    }
    const messages: SequenceMessage[] = [];
    for (const item of value['messages']) {
      if (!isRecord(item)) {
        errors.push('Each message must be an object.');
        continue;
      }
      unknownFields(item, ['from', 'to', 'label'], 'message', errors);
      const from = readPlain(item['from'], 'message from', 32, errors);
      const to = readPlain(item['to'], 'message to', 32, errors);
      const label = readPlain(item['label'], 'message label', 48, errors);
      if (from === null || to === null || label === null) continue;
      if (!participants.includes(from) || !participants.includes(to)) errors.push('Messages must use known participants.');
      messages.push({from, to, label});
    }
    if (participants.length < 2) return null;
    return {type, participants, messages};
  }
  if (type === 'frames') {
    unknownFields(value, ['type', 'frames'], 'frames', errors);
    if (!Array.isArray(value['frames']) || value['frames'].length < 1 || value['frames'].length > 8) {
      errors.push('Frames need 1–8 steps.');
      return null;
    }
    const frames: ArtifactFrame[] = [];
    for (const item of value['frames']) {
      if (!isRecord(item)) {
        errors.push('Each frame must be an object.');
        continue;
      }
      unknownFields(item, ['title', 'text'], 'frame', errors);
      const title = readPlain(item['title'], 'frame title', LABEL_LIMIT, errors);
      const text = readPlain(item['text'], 'frame text', 280, errors);
      if (title === null || text === null) continue;
      frames.push({title, text});
    }
    if (frames.length === 0) return null;
    return {type, frames};
  }
  if (type === 'code-compare') {
    unknownFields(value, ['type', 'before', 'after', 'beforeLabel', 'afterLabel'], 'code-compare', errors);
    const before = readCode(value['before'], 'before', errors);
    const after = readCode(value['after'], 'after', errors);
    if (before === null || after === null) return null;
    let beforeLabel = 'Before';
    let afterLabel = 'After';
    if (value['beforeLabel'] !== undefined) {
      const label = readPlain(value['beforeLabel'], 'before label', LABEL_LIMIT, errors);
      if (label === null) return null;
      beforeLabel = label;
    }
    if (value['afterLabel'] !== undefined) {
      const label = readPlain(value['afterLabel'], 'after label', LABEL_LIMIT, errors);
      if (label === null) return null;
      afterLabel = label;
    }
    return {type, before, after, beforeLabel, afterLabel};
  }
  if (type === 'callout') {
    unknownFields(value, ['type', 'text'], 'callout', errors);
    const text = readPlain(value['text'], 'callout', CALLOUT_LIMIT, errors);
    if (text === null) return null;
    return {type, text};
  }
  unknownFields(value, ['type', 'width', 'height', 'shapes'], 'svg-scene', errors);
  const width = readNumber(value['width'], 'width', errors);
  const height = readNumber(value['height'], 'height', errors);
  if (width === null || height === null || width < 32 || width > 800 || height < 32 || height > 480) {
    errors.push('An SVG scene must be between 32×32 and 800×480.');
    return null;
  }
  if (!Array.isArray(value['shapes']) || value['shapes'].length < 1 || value['shapes'].length > 24) {
    errors.push('An SVG scene needs 1–24 shapes.');
    return null;
  }
  const shapes: SvgShape[] = [];
  for (const item of value['shapes']) {
    const shape = readShape(item, errors);
    if (shape) shapes.push(shape);
  }
  if (shapes.length === 0) return null;
  return {type: 'svg-scene', width, height, shapes};
}

function coordinate(value: unknown, label: string, errors: string[]): number | null {
  const number = readNumber(value, label, errors);
  if (number === null) return null;
  if (number < -40 || number > 840) errors.push(`${label} is outside the scene.`);
  return number;
}

function readShape(value: unknown, errors: string[]): SvgShape | null {
  if (!isRecord(value)) {
    errors.push('Each shape must be an object.');
    return null;
  }
  const type = value['type'];
  if (type === 'path' || type === 'image' || type === 'use') {
    errors.push('SVG scenes only allow rect, line, circle, and text.');
    return null;
  }
  if (type === 'rect') {
    unknownFields(value, ['type', 'x', 'y', 'width', 'height', 'label'], 'rect', errors);
    const x = coordinate(value['x'], 'x', errors);
    const y = coordinate(value['y'], 'y', errors);
    const width = readNumber(value['width'], 'width', errors);
    const height = readNumber(value['height'], 'height', errors);
    if (x === null || y === null || width === null || height === null || width <= 0 || height <= 0 || width > 800 || height > 480) return null;
    const shape: SvgShape = {type, x, y, width, height};
    if (value['label'] !== undefined) {
      const label = readPlain(value['label'], 'shape label', 32, errors);
      if (label === null) return null;
      shape.label = label;
    }
    return shape;
  }
  if (type === 'line') {
    unknownFields(value, ['type', 'x1', 'y1', 'x2', 'y2'], 'line', errors);
    const x1 = coordinate(value['x1'], 'x1', errors);
    const y1 = coordinate(value['y1'], 'y1', errors);
    const x2 = coordinate(value['x2'], 'x2', errors);
    const y2 = coordinate(value['y2'], 'y2', errors);
    if (x1 === null || y1 === null || x2 === null || y2 === null) return null;
    return {type, x1, y1, x2, y2};
  }
  if (type === 'circle') {
    unknownFields(value, ['type', 'cx', 'cy', 'r', 'label'], 'circle', errors);
    const cx = coordinate(value['cx'], 'cx', errors);
    const cy = coordinate(value['cy'], 'cy', errors);
    const r = readNumber(value['r'], 'r', errors);
    if (cx === null || cy === null || r === null || r <= 0 || r > 240) return null;
    const shape: SvgShape = {type, cx, cy, r};
    if (value['label'] !== undefined) {
      const label = readPlain(value['label'], 'shape label', 32, errors);
      if (label === null) return null;
      shape.label = label;
    }
    return shape;
  }
  if (type === 'text') {
    unknownFields(value, ['type', 'x', 'y', 'text'], 'text', errors);
    const x = coordinate(value['x'], 'x', errors);
    const y = coordinate(value['y'], 'y', errors);
    const text = readPlain(value['text'], 'svg text', 48, errors);
    if (x === null || y === null || text === null) return null;
    return {type, x, y, text};
  }
  errors.push('SVG scenes only allow rect, line, circle, and text.');
  return null;
}

export function parseArtifact(input: unknown): ArtifactParse {
  const errors: string[] = [];
  if (!isRecord(input)) return fail('Artifact', 'This figure could not be read.', ['Artifact must be a JSON object.']);
  unknownFields(input, ['version', 'id', 'title', 'summary', 'classification', 'view'], 'artifact', errors);
  const titleText = typeof input['title'] === 'string' ? input['title'] : 'Artifact';
  const summaryText = typeof input['summary'] === 'string' ? input['summary'] : 'This figure could not be read.';
  if (input['version'] !== ARTIFACT_VERSION) errors.push('version must be 1.');
  const id = typeof input['id'] === 'string' ? input['id'].trim() : '';
  if (!ID_PATTERN.test(id) || id.length > 64) errors.push('id must be lowercase letters, numbers, and hyphens.');
  const title = readPlain(input['title'], 'title', TITLE_LIMIT, errors);
  const summary = readPlain(input['summary'], 'summary', SUMMARY_LIMIT, errors);
  const classification = input['classification'];
  if (classification !== 'conceptual' && classification !== 'measured') errors.push('classification must be conceptual or measured.');
  const view = readView(input['view'], classification === 'measured' ? 'measured' : 'conceptual', errors);
  if (errors.length > 0 || title === null || summary === null || view === null || (classification !== 'conceptual' && classification !== 'measured')) {
    return fail(titleText, summaryText, errors.length > 0 ? errors : ['Artifact is invalid.']);
  }
  return {ok: true, artifact: {version: 1, id, title, summary, classification, view}};
}

export function isArtifactId(value: string): boolean {
  return ID_PATTERN.test(value) && value.length <= 64;
}
