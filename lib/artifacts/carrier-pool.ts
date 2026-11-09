import {parseArtifact, type ArtifactDocument} from './schema';

export type CarrierPoolReading = {
  requests: number;
  platformThreads: number;
  connections: number;
  running: number;
  waiting: number;
  mounted: number;
  idleThreads: number;
  idleConnections: number;
  text: string;
};

function count(value: number, singular: string, plural: string): string {
  return value === 1 ? `1 ${singular}` : `${value} ${plural}`;
}

export function readCarrierPool(requests: number, platformThreads: number, connections: number): CarrierPoolReading {
  const running = Math.min(requests, platformThreads, connections);
  const waiting = requests - running;
  const idleThreads = platformThreads - running;
  const idleConnections = connections - running;
  const holding = running === 0 ? 'No request holds a connection.' : `${count(running, 'request holds', 'requests hold')} a connection.`;
  const queue = waiting === 0 ? 'Nothing is waiting.' : `The other ${count(waiting, 'virtual thread waits', 'virtual threads wait')}.`;
  const mounted = running === 0 ? 'No platform thread is mounted.' : `Only ${count(running, 'platform thread is', 'platform threads are')} mounted.`;
  const limits: string[] = [];
  if (waiting > 0 && idleThreads === 0 && idleConnections === 0) {
    limits.push('The platform threads and the database pool are both full.');
  } else {
    if (idleThreads > 0) {
      limits.push(
        waiting > 0 && idleConnections === 0
          ? `${count(idleThreads, 'platform thread stays', 'platform threads stay')} idle because the database pool has no free connection.`
          : `${count(idleThreads, 'platform thread stays', 'platform threads stay')} idle.`,
      );
    }
    if (idleConnections > 0) {
      limits.push(
        waiting > 0 && idleThreads === 0
          ? `${count(idleConnections, 'connection stays', 'connections stay')} unused because no idle platform thread is mounted.`
          : `${count(idleConnections, 'connection stays', 'connections stay')} unused.`,
      );
    }
  }
  const text = [holding, queue, mounted, ...limits, 'Adding requests does not add database capacity.'].join(' ');
  return {requests, platformThreads, connections, running, waiting, mounted: running, idleThreads, idleConnections, text};
}

export function carrierPoolTemplate(id: string): ArtifactDocument {
  const parsed = parseArtifact({
    version: 1,
    id,
    title: 'New simulation',
    summary: 'A conceptual picture of work waiting on a database pool. It is not a measurement.',
    classification: 'conceptual',
    view: {
      type: 'carrier-pool',
      requests: {label: 'Concurrent requests', min: 1, max: 32, step: 1, default: 8},
      platformThreads: {label: 'Platform threads', min: 1, max: 16, step: 1, default: 4},
      connections: {label: 'Database connections', min: 1, max: 16, step: 1, default: 4},
    },
  });
  if (!parsed.ok) throw new Error(parsed.errors.join(' '));
  return parsed.artifact;
}
