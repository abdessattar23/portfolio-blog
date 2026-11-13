export const ANALYTICS_TIME_ZONE = 'Africa/Casablanca';
export const DEFAULT_UMAMI_BASE_URL = 'https://umami.wetalentify.com';

export const ANALYTICS_RANGES = ['today', '24h', '7d', '30d', '90d', 'custom'] as const;
export type AnalyticsRange = (typeof ANALYTICS_RANGES)[number];

export type AnalyticsQuery = {
  range: AnalyticsRange;
  start?: string;
  end?: string;
  fresh?: boolean;
};

export type MetricDelta = {
  value: number;
  previous: number | null;
  change: number | null;
};

export type TrafficPoint = {
  at: string;
  label: string;
  pageviews: number;
  visits: number;
};

export type RankedRow = {
  label: string;
  path?: string;
  pageviews: number | null;
  visitors: number | null;
  count: number;
  share: number;
};

export type VitalNumbers = {p50: number; p75: number; p95: number};

export type AnalyticsBehavior = {
  eventCount: number | null;
  eventNames: RankedRow[];
  performance: Record<'lcp' | 'inp' | 'cls' | 'fcp' | 'ttfb', VitalNumbers> | null;
  performanceNote: string;
  readingAverageSeconds: number | null;
  readingMedianSeconds: number | null;
  readingTotalSeconds: number | null;
  readingNote: string;
  errorsNote: string;
  journeys: string[];
  os: RankedRow[];
  channels: RankedRow[];
  landing: RankedRow[];
  exits: RankedRow[];
  campaigns: RankedRow[];
  links: {
    replays: string;
    heatmaps: string;
    events: string;
    funnels: string;
    journeys: string;
    performance: string;
  };
  replaySampleRate: number | null;
  heatmapSampleRate: number | null;
};

export type ArticleRow = RankedRow & {
  slug: string;
  title: string;
  draftId: string | null;
  readingAverageSeconds: number | null;
  readingMedianSeconds: number | null;
};

export type AnalyticsReady = {
  status: 'ready';
  range: AnalyticsRange;
  startAt: number;
  endAt: number;
  unit: 'hour' | 'day' | 'month';
  generatedAt: string;
  umamiUrl: string;
  visitors: MetricDelta;
  pageviews: MetricDelta;
  visits: MetricDelta;
  bounceRate: MetricDelta;
  duration: MetricDelta;
  active: number | null;
  series: TrafficPoint[];
  articles: ArticleRow[];
  pages: RankedRow[];
  referrers: RankedRow[];
  countries: RankedRow[];
  devices: RankedRow[];
  browsers: RankedRow[];
  empty: boolean;
  behavior: AnalyticsBehavior;
};

export type AnalyticsReport =
  | AnalyticsReady
  | {status: 'unconfigured'; missing: string[]; message: string; umamiUrl: string}
  | {status: 'error'; message: string; umamiUrl: string};

export type ContentRef = {
  slug: string;
  title: string;
  draftId?: string;
};

const DAY = 86_400_000;

export function isAnalyticsRange(value: string): value is AnalyticsRange {
  return (ANALYTICS_RANGES as readonly string[]).includes(value);
}

export function publicUmamiUrl(baseUrl: string, websiteId?: string): string {
  const base = baseUrl.replace(/\/+$/, '');
  if (websiteId && /^[0-9a-f-]{36}$/i.test(websiteId)) return `${base}/websites/${websiteId}`;
  return base;
}

export function readAnalyticsConfig(env: {
  UMAMI_BASE_URL?: string;
  UMAMI_WEBSITE_ID?: string;
  UMAMI_API_KEY?: string;
}): {baseUrl: string; apiKey: string; websiteId: string} | {missing: string[]} {
  const missing: string[] = [];
  const apiKey = env.UMAMI_API_KEY?.trim() ?? '';
  const websiteId = env.UMAMI_WEBSITE_ID?.trim() ?? '';
  const baseUrl = (env.UMAMI_BASE_URL?.trim() || DEFAULT_UMAMI_BASE_URL).replace(/\/+$/, '').replace(/\/api$/, '');
  if (!apiKey) missing.push('UMAMI_API_KEY');
  if (!websiteId) missing.push('UMAMI_WEBSITE_ID');
  else if (!/^[0-9a-f-]{36}$/i.test(websiteId)) missing.push('UMAMI_WEBSITE_ID');
  try {
    const url = new URL(baseUrl);
    if (url.protocol !== 'https:') missing.push('UMAMI_BASE_URL');
  } catch {
    missing.push('UMAMI_BASE_URL');
  }
  if (missing.length > 0) return {missing: [...new Set(missing)]};
  return {baseUrl, apiKey, websiteId};
}

export function parseAnalyticsQuery(params: {get(name: string): string | null}): AnalyticsQuery | {error: string} {
  const raw = params.get('range') ?? '7d';
  const range = isAnalyticsRange(raw) ? raw : null;
  if (!range) return {error: 'Choose one of the listed time ranges.'};
  if (range !== 'custom') return {range, fresh: params.get('fresh') === '1'};
  const start = params.get('start') ?? '';
  const end = params.get('end') ?? '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(start) || !/^\d{4}-\d{2}-\d{2}$/.test(end)) {
    return {error: 'A custom range needs a start and end date.'};
  }
  if (start > end) return {error: 'The custom range ends before it starts.'};
  return {range, start, end, fresh: params.get('fresh') === '1'};
}

export function analyticsWindow(query: AnalyticsQuery, now = Date.now()): {startAt: number; endAt: number; unit: 'hour' | 'day' | 'month'} {
  const endAt = query.range === 'custom' && query.end ? endOfDay(query.end) : now;
  const startAt = query.range === 'today'
    ? startOfDay(now)
    : query.range === '24h'
      ? now - DAY
      : query.range === '7d'
        ? now - 7 * DAY
        : query.range === '30d'
          ? now - 30 * DAY
          : query.range === '90d'
            ? now - 90 * DAY
            : query.start
              ? startOfNamedDay(query.start)
              : now - 7 * DAY;
  const span = Math.max(0, endAt - startAt);
  const unit = span <= 2 * DAY ? 'hour' : span <= 120 * DAY ? 'day' : 'month';
  return {startAt, endAt, unit};
}

export function normalizeStats(payload: unknown): {
  visitors: MetricDelta;
  pageviews: MetricDelta;
  visits: MetricDelta;
  bounceRate: MetricDelta;
  duration: MetricDelta;
} | null {
  if (!isRecord(payload)) return null;
  const comparisonRecord = field(payload, 'comparison');
  const comparison = isRecord(comparisonRecord) ? comparisonRecord : {};
  const pageviews = readCount(field(payload, 'pageviews'), field(comparison, 'pageviews'));
  const visitors = readCount(field(payload, 'visitors'), field(comparison, 'visitors'));
  const visits = readCount(field(payload, 'visits'), field(comparison, 'visits'));
  const bounces = readCount(field(payload, 'bounces'), field(comparison, 'bounces'));
  const totaltime = readCount(field(payload, 'totaltime'), field(comparison, 'totaltime'));
  if (!pageviews || !visitors || !visits || !bounces || !totaltime) return null;
  return {
    pageviews: delta(pageviews.value, pageviews.previous),
    visitors: delta(visitors.value, visitors.previous),
    visits: delta(visits.value, visits.previous),
    bounceRate: rateDelta(bounces.value, visits.value, bounces.previous, visits.previous),
    duration: rateDelta(totaltime.value, visits.value, totaltime.previous, visits.previous),
  };
}

export function normalizeSeries(payload: unknown, unit: 'hour' | 'day' | 'month'): TrafficPoint[] {
  if (!isRecord(payload)) return [];
  const pageviews = points(field(payload, 'pageviews'));
  const visits = points(field(payload, 'sessions') ?? field(payload, 'visits') ?? field(payload, 'visitors'));
  const keys = [...new Set([...pageviews.keys(), ...visits.keys()])].sort();
  return keys.map((at) => ({
    at,
    label: formatPoint(at, unit),
    pageviews: pageviews.get(at) ?? 0,
    visits: visits.get(at) ?? 0,
  }));
}

export function normalizeActive(payload: unknown): number | null {
  if (typeof payload === 'number' && Number.isFinite(payload)) return payload;
  if (!isRecord(payload)) return null;
  const visitors = field(payload, 'visitors');
  if (typeof visitors === 'number') return visitors;
  const active = field(payload, 'x');
  if (typeof active === 'number') return active;
  return null;
}

export function normalizeRanked(payload: unknown, kind: 'activity' | 'audience'): RankedRow[] {
  const data = isRecord(payload) ? field(payload, 'data') : undefined;
  const rows = Array.isArray(payload) ? payload : Array.isArray(data) ? data : [];
  const ranked = rows.flatMap((item) => {
    if (!isRecord(item)) return [];
    const name = field(item, 'name');
    const pageviews = field(item, 'pageviews');
    if (typeof name === 'string' && typeof pageviews === 'number') {
      const visitors = field(item, 'visitors');
      const visitorCount = typeof visitors === 'number' ? visitors : null;
      const count = kind === 'audience' ? (visitorCount ?? pageviews) : pageviews;
      return [{label: name, pageviews, visitors: visitorCount, count, share: 0}];
    }
    const rawLabel = field(item, 'x');
    const count = field(item, 'y');
    const label = typeof rawLabel === 'string' ? rawLabel : rawLabel === null ? '' : null;
    if (label === null || typeof count !== 'number') return [];
    return [{
      label,
      pageviews: kind === 'activity' ? count : null,
      visitors: kind === 'audience' ? count : null,
      count,
      share: 0,
    }];
  });
  const total = ranked.reduce((sum, row) => sum + row.count, 0);
  return ranked.map((row) => ({...row, share: total > 0 ? row.count / total : 0}));
}

export function pagePath(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return '/';
  try {
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) {
      return normalizePath(new URL(trimmed).pathname);
    }
  } catch {
    return trimmed;
  }
  return normalizePath(trimmed.split('?')[0] ?? trimmed);
}

export function articlesFromPages(rows: RankedRow[], posts: ContentRef[], totalPageviews: number): ArticleRow[] {
  const bySlug = new Map(posts.map((post) => [post.slug, post]));
  const articles: ArticleRow[] = [];
  for (const row of rows) {
    const path = pagePath(row.label);
    const slug = /^\/blog\/([a-z0-9-]+)$/.exec(path)?.[1];
    const post = slug ? bySlug.get(slug) : undefined;
    if (!slug || !post) continue;
    const pageviews = row.pageviews ?? row.count;
    articles.push({
      ...row,
      label: post.title,
      path,
      slug,
      title: post.title,
      pageviews,
      share: totalPageviews > 0 ? pageviews / totalPageviews : 0,
      draftId: post.draftId ?? null,
      readingAverageSeconds: null,
      readingMedianSeconds: null,
    });
  }
  return articles.sort((left, right) => (right.pageviews ?? 0) - (left.pageviews ?? 0));
}

export function labelRanked(rows: RankedRow[], kind: 'page' | 'referrer' | 'country' | 'device' | 'browser'): RankedRow[] {
  const countries = new Intl.DisplayNames(['en'], {type: 'region'});
  return rows.map((row) => {
    if (kind === 'page') {
      const path = pagePath(row.label);
      return {...row, label: path, path};
    }
    if (kind === 'referrer') {
      return {...row, label: row.label ? row.label : 'Direct'};
    }
    if (kind === 'country') {
      return {...row, label: countryName(countries, row.label)};
    }
    return {...row, label: titleCase(row.label || 'Unknown')};
  });
}

export function percentChange(current: number, previous: number | null): number | null {
  if (previous === null) return null;
  if (previous === 0) return current === 0 ? 0 : null;
  return ((current - previous) / previous) * 100;
}

function delta(value: number, previous: number | null): MetricDelta {
  return {value, previous, change: percentChange(value, previous)};
}

function rateDelta(numerator: number, denominator: number, previousNumerator: number | null, previousDenominator: number | null): MetricDelta {
  const value = denominator > 0 ? numerator / denominator : 0;
  const previous = previousDenominator && previousDenominator > 0 && previousNumerator !== null
    ? previousNumerator / previousDenominator
    : previousDenominator === 0
      ? 0
      : null;
  return delta(value, previous);
}

function readCount(value: unknown, comparison: unknown): {value: number; previous: number | null} | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return {value, previous: typeof comparison === 'number' && Number.isFinite(comparison) ? comparison : null};
  }
  const current = isRecord(value) ? field(value, 'value') : undefined;
  const previousValue = isRecord(value) ? field(value, 'prev') : undefined;
  if (typeof current !== 'number' || !Number.isFinite(current)) return null;
  const previous = typeof previousValue === 'number' && Number.isFinite(previousValue) ? previousValue : null;
  return {value: current, previous};
}

function points(value: unknown): Map<string, number> {
  const map = new Map<string, number>();
  if (!Array.isArray(value)) return map;
  for (const item of value) {
    const y = isRecord(item) ? field(item, 'y') : undefined;
    const x = isRecord(item) ? field(item, 'x') : undefined;
    if (!isRecord(item) || typeof y !== 'number' || !Number.isFinite(y)) continue;
    const at = typeof x === 'string' ? x : typeof x === 'number' ? new Date(x).toISOString() : '';
    if (at) map.set(at, y);
  }
  return map;
}

function formatPoint(value: string, unit: 'hour' | 'day' | 'month'): string {
  const date = new Date(value.includes('T') ? value : value.replace(' ', 'T') + 'Z');
  if (Number.isNaN(date.getTime())) return value;
  if (unit === 'hour') {
    return new Intl.DateTimeFormat('en-GB', {hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: ANALYTICS_TIME_ZONE}).format(date);
  }
  if (unit === 'month') {
    return new Intl.DateTimeFormat('en-GB', {month: 'short', year: 'numeric', timeZone: ANALYTICS_TIME_ZONE}).format(date);
  }
  return new Intl.DateTimeFormat('en-GB', {day: '2-digit', month: 'short', timeZone: ANALYTICS_TIME_ZONE}).format(date);
}

function startOfDay(now: number): number {
  const day = new Intl.DateTimeFormat('en-CA', {
    timeZone: ANALYTICS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date(now));
  return startOfNamedDay(day);
}

function startOfNamedDay(day: string): number {
  return zonedStamp(`${day}T00:00:00`, ANALYTICS_TIME_ZONE);
}

function endOfDay(day: string): number {
  return startOfNamedDay(day) + DAY - 1;
}

function zonedStamp(local: string, timeZone: string): number {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(local);
  if (!match) return Date.now();
  const utc = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]), Number(match[4]), Number(match[5]), Number(match[6]));
  return utc - timeZoneOffset(utc, timeZone);
}

function timeZoneOffset(ms: number, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(ms));
  const read = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? '0');
  const hour = read('hour') % 24;
  const asUtc = Date.UTC(read('year'), read('month') - 1, read('day'), hour, read('minute'), read('second'));
  return asUtc - ms;
}

function countryName(names: Intl.DisplayNames, code: string): string {
  if (!/^[A-Za-z]{2}$/.test(code)) return code || 'Unknown';
  try {
    return names.of(code.toUpperCase()) ?? code.toUpperCase();
  } catch {
    return code.toUpperCase();
  }
}

function titleCase(value: string): string {
  return value.replace(/[_-]+/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizePath(path: string): string {
  if (!path.startsWith('/')) return `/${path}`;
  return path.length > 1 ? path.replace(/\/+$/, '') : path;
}

export function normalizeNumericStats(payload: unknown): {total: number; average: number; median: number} | null {
  if (!isRecord(payload)) return null;
  const total = numberValue(field(payload, 'total'));
  const average = numberValue(field(payload, 'average'));
  const median = numberValue(field(payload, 'median'));
  if (total === null || average === null || median === null || total <= 0) return null;
  return {total, average, median};
}

function numberValue(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '' && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function field(record: Record<string, unknown>, key: string): unknown {
  return record[key];
}
