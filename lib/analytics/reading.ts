export const READING_IDLE_MS = 75_000;
export const READING_CHECKPOINTS = [15, 30, 60, 120, 180] as const;

export type ReadingClock = {
  accumulatedMs: number;
  runningSince: number | null;
  lastActivity: number;
  flushedMs: number;
  sentCheckpoints: number[];
  endSent: boolean;
  scrollSent: number[];
};

export function createReadingClock(now: number): ReadingClock {
  return {
    accumulatedMs: 0,
    runningSince: null,
    lastActivity: now,
    flushedMs: 0,
    sentCheckpoints: [],
    endSent: false,
    scrollSent: [],
  };
}

export function markActivity(clock: ReadingClock, now: number): ReadingClock {
  return {...clock, lastActivity: now};
}

export function engagedMs(clock: ReadingClock, now: number, engaged: boolean): number {
  if (!engaged || clock.runningSince === null) return clock.accumulatedMs;
  return clock.accumulatedMs + Math.max(0, now - clock.runningSince);
}

export function isReadingEngaged(clock: ReadingClock, now: number, visible: boolean, focused: boolean): boolean {
  return visible && focused && now - clock.lastActivity < READING_IDLE_MS;
}

export function readingEmissions(clock: ReadingClock, now: number, visible: boolean, focused: boolean): {
  clock: ReadingClock;
  checkpoints: number[];
  deltaSeconds: number;
} {
  const advanced = settle(clock, now, visible, focused);
  const total = engagedMs(advanced, now, isReadingEngaged(advanced, now, visible, focused));
  const totalSeconds = Math.floor(total / 1000);
  const due = dueCheckpoints(advanced.sentCheckpoints, totalSeconds);
  const flushedSeconds = Math.floor(advanced.flushedMs / 1000);
  const deltaSeconds = Math.max(0, totalSeconds - flushedSeconds);
  return {
    clock: {
      ...advanced,
      sentCheckpoints: [...advanced.sentCheckpoints, ...due],
      flushedMs: deltaSeconds > 0 ? totalSeconds * 1000 : advanced.flushedMs,
    },
    checkpoints: due,
    deltaSeconds,
  };
}

function settle(clock: ReadingClock, now: number, visible: boolean, focused: boolean): ReadingClock {
  if (isReadingEngaged(clock, now, visible, focused)) {
    return clock.runningSince === null ? {...clock, runningSince: now} : clock;
  }
  if (clock.runningSince === null) return clock;
  const cap = Math.min(now, clock.lastActivity + READING_IDLE_MS);
  return {...clock, accumulatedMs: clock.accumulatedMs + Math.max(0, cap - clock.runningSince), runningSince: null};
}

function dueCheckpoints(sent: readonly number[], totalSeconds: number): number[] {
  const base = READING_CHECKPOINTS.filter((seconds) => totalSeconds >= seconds && !sent.includes(seconds));
  const laterCount = totalSeconds >= 180 ? Math.floor((totalSeconds - 180) / 120) : 0;
  const later = Array.from({length: laterCount}, (_, index) => 180 + (index + 1) * 120).filter((seconds) => !sent.includes(seconds));
  return [...base, ...later];
}

export function completedEngagedSeconds(clock: ReadingClock, now: number, visible: boolean, focused: boolean): number {
  const settled = settle(clock, now, visible, focused);
  const total = engagedMs(settled, now, isReadingEngaged(settled, now, visible, focused));
  return Math.floor(total / 1000);
}

export function nextScrollMilestones(sent: readonly number[], percent: number): number[] {
  return [25, 50, 75, 90, 100].filter((milestone) => percent >= milestone && !sent.includes(milestone));
}
