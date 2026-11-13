import {livePosts} from './published';
import {listDrafts} from './drafts';
import {studioEnv} from './db';
import type {AnalyticsBehavior, AnalyticsQuery, AnalyticsReport, ContentRef, VitalNumbers} from './analytics-model';
import {
  ANALYTICS_TIME_ZONE,
  articlesFromPages,
  analyticsWindow,
  labelRanked,
  normalizeActive,
  normalizeNumericStats,
  normalizeRanked,
  normalizeSeries,
  normalizeStats,
  publicUmamiUrl,
  readAnalyticsConfig,
} from './analytics-model';

const CACHE_MS = 60_000;
const cache = new Map<string, {at: number; payload: UmamiSnapshot}>();

type UmamiSnapshot = {
  stats: unknown;
  series: unknown;
  active: unknown;
  pages: unknown;
  referrers: unknown;
  countries: unknown;
  devices: unknown;
  browsers: unknown;
  startAt: number;
  endAt: number;
  unit: 'hour' | 'day' | 'month';
  range: AnalyticsQuery['range'];
  websiteId: string;
  baseUrl: string;
};

export async function loadAnalytics(query: AnalyticsQuery): Promise<AnalyticsReport> {
  const config = readAnalyticsConfig(studioEnv());
  const baseUrl = 'baseUrl' in config ? config.baseUrl : 'https://umami.wetalentify.com';
  if ('missing' in config) {
    return {
      status: 'unconfigured',
      missing: config.missing,
      umamiUrl: baseUrl,
      message: 'Add the Umami variables to the server environment, then refresh.',
    };
  }
  try {
    const snapshot = await loadSnapshot(config, query);
    const window = {startAt: snapshot.startAt, endAt: snapshot.endAt};
    const [catalog, behavior] = await Promise.all([contentCatalog(), loadBehavior(config, window)]);
    const report = present(snapshot, catalog, behavior);
    if (report.status !== 'ready') return report;
    return attachReading(config, window, report);
  } catch (error) {
    const status = error instanceof UmamiHttpError ? error.status : 0;
    return {
      status: 'error',
      umamiUrl: publicUmamiUrl(config.baseUrl, config.websiteId),
      message: status === 401
        ? 'Umami rejected the API key.'
        : status === 404
          ? 'Umami could not find that website id.'
          : error instanceof Error && error.name === 'TimeoutError'
            ? 'Umami took too long to respond.'
            : 'Umami is unavailable right now.',
    };
  }
}

async function loadSnapshot(
  config: {baseUrl: string; apiKey: string; websiteId: string},
  query: AnalyticsQuery,
): Promise<UmamiSnapshot> {
  const window = analyticsWindow(query);
  const key = `${config.websiteId}:${window.startAt}:${window.endAt}:${window.unit}`;
  const cached = cache.get(key);
  if (!query.fresh && cached && Date.now() - cached.at < CACHE_MS) return cached.payload;
  const shared = {
    startAt: window.startAt,
    endAt: window.endAt,
    timezone: ANALYTICS_TIME_ZONE,
  };
  const [stats, series, active, pages, referrers, countries, devices, browsers] = await Promise.all([
    umamiGet(config, `/api/websites/${config.websiteId}/stats`, {...shared, compare: 'prev'}),
    umamiGet(config, `/api/websites/${config.websiteId}/pageviews`, {...shared, unit: window.unit, compare: 'prev'}),
    umamiGet(config, `/api/websites/${config.websiteId}/active`, {}),
    metric(config, shared, 'path'),
    metric(config, shared, 'referrer'),
    metric(config, shared, 'country'),
    metric(config, shared, 'device'),
    metric(config, shared, 'browser'),
  ]);
  const payload: UmamiSnapshot = {
    stats,
    series,
    active,
    pages,
    referrers,
    countries,
    devices,
    browsers,
    startAt: window.startAt,
    endAt: window.endAt,
    unit: window.unit,
    range: query.range,
    websiteId: config.websiteId,
    baseUrl: config.baseUrl,
  };
  cache.set(key, {at: Date.now(), payload});
  return payload;
}

async function metric(
  config: {baseUrl: string; apiKey: string; websiteId: string},
  shared: {startAt: number; endAt: number; timezone: string},
  type: string,
): Promise<unknown> {
  try {
    return await umamiGet(config, `/api/websites/${config.websiteId}/metrics/expanded`, {...shared, type, limit: 12});
  } catch (error) {
    if (!(error instanceof UmamiHttpError) || error.status !== 404) throw error;
    return umamiGet(config, `/api/websites/${config.websiteId}/metrics`, {...shared, type, limit: 12});
  }
}

async function umamiGet(
  config: {baseUrl: string; apiKey: string},
  path: string,
  params: Record<string, string | number>,
): Promise<unknown> {
  const url = new URL(path, `${config.baseUrl}/`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const response = await fetch(url, {
    headers: {Accept: 'application/json', Authorization: `Bearer ${config.apiKey}`},
    cache: 'no-store',
    signal: AbortSignal.timeout(12_000),
  });
  if (!response.ok) throw new UmamiHttpError(response.status);
  return response.json() as Promise<unknown>;
}

async function contentCatalog(): Promise<ContentRef[]> {
  try {
    const [posts, drafts] = await Promise.all([livePosts(), listDrafts()]);
    return posts.filter((post) => !post.draft).map((post) => {
      const draftId = drafts.find((draft) => draft.kind === 'post' && draft.slug === post.slug)?.id;
      return {
        slug: post.slug,
        title: post.title,
        ...(draftId ? {draftId} : {}),
      };
    });
  } catch {
    return [];
  }
}

function present(snapshot: UmamiSnapshot, posts: ContentRef[], behavior: AnalyticsBehavior): AnalyticsReport {
  const stats = normalizeStats(snapshot.stats);
  if (!stats) {
    return {status: 'error', message: 'Umami returned statistics in an unexpected shape.', umamiUrl: publicUmamiUrl(snapshot.baseUrl, snapshot.websiteId)};
  }
  const pages = labelRanked(normalizeRanked(snapshot.pages, 'activity'), 'page');
  const articles = articlesFromPages(pages, posts, stats.pageviews.value);
  const series = normalizeSeries(snapshot.series, snapshot.unit);
  return {
    status: 'ready',
    range: snapshot.range,
    startAt: snapshot.startAt,
    endAt: snapshot.endAt,
    unit: snapshot.unit,
    generatedAt: new Date().toISOString(),
    umamiUrl: publicUmamiUrl(snapshot.baseUrl, snapshot.websiteId),
    ...stats,
    active: normalizeActive(snapshot.active),
    series,
    articles,
    pages: pages.slice(0, 8),
    referrers: labelRanked(normalizeRanked(snapshot.referrers, 'activity'), 'referrer').slice(0, 6),
    countries: labelRanked(normalizeRanked(snapshot.countries, 'audience'), 'country').slice(0, 6),
    devices: labelRanked(normalizeRanked(snapshot.devices, 'audience'), 'device').slice(0, 6),
    browsers: labelRanked(normalizeRanked(snapshot.browsers, 'audience'), 'browser').slice(0, 6),
    empty: stats.pageviews.value === 0 && stats.visits.value === 0,
    behavior,
  };
}

async function loadBehavior(
  config: {baseUrl: string; apiKey: string; websiteId: string},
  window: {startAt: number; endAt: number},
): Promise<AnalyticsBehavior> {
  const shared = {startAt: window.startAt, endAt: window.endAt, timezone: ANALYTICS_TIME_ZONE};
  const root = publicUmamiUrl(config.baseUrl, config.websiteId);
  const [events, names, performance, journeys, os, channels, landing, exits, campaigns, website] = await Promise.all([
    optionalGet(config, `/api/websites/${config.websiteId}/events/stats`, shared),
    optionalGet(config, `/api/websites/${config.websiteId}/metrics`, {...shared, type: 'event', limit: 20}),
    optionalGet(config, `/api/websites/${config.websiteId}/performance/stats`, shared),
    optionalGet(config, `/api/websites/${config.websiteId}/journeys`, {...shared, steps: 3}),
    optionalGet(config, `/api/websites/${config.websiteId}/metrics`, {...shared, type: 'os', limit: 6}),
    optionalGet(config, `/api/websites/${config.websiteId}/metrics`, {...shared, type: 'channel', limit: 6}),
    optionalGet(config, `/api/websites/${config.websiteId}/metrics`, {...shared, type: 'entry', limit: 6}),
    optionalGet(config, `/api/websites/${config.websiteId}/metrics`, {...shared, type: 'exit', limit: 6}),
    optionalGet(config, `/api/websites/${config.websiteId}/metrics`, {...shared, type: 'utmCampaign', limit: 6}),
    optionalGet(config, `/api/websites/${config.websiteId}`, {}),
  ]);
  const eventRecord = isRecord(events) && isRecord(events['data']) ? events['data'] : null;
  const replay = isRecord(website) && isRecord(website['replayConfig']) ? website['replayConfig'] : null;
  return {
    eventCount: eventRecord && typeof eventRecord['events'] === 'number' ? eventRecord['events'] : null,
    eventNames: normalizeRanked(names, 'activity').slice(0, 12),
    performance: readVitals(performance),
    performanceNote: readVitals(performance)
      ? 'Real-user p50, p75, and p95 from Umami. A zero means no measurements in this range, not a perfect score.'
      : 'Performance statistics were not returned for this range.',
    readingAverageSeconds: null,
    readingMedianSeconds: null,
    readingTotalSeconds: null,
    readingNote: 'Completed article views have not reported an exit yet. Average and median stay blank instead of using checkpoint lengths.',
    errorsNote: 'JavaScript error tracking is not in the installed tracker script, and the errors API is absent.',
    journeys: readJourneys(journeys),
    os: labelRanked(normalizeRanked(os, 'audience'), 'device').slice(0, 6),
    channels: labelRanked(normalizeRanked(channels, 'activity'), 'referrer').slice(0, 6),
    landing: labelRanked(normalizeRanked(landing, 'activity'), 'page').slice(0, 6),
    exits: labelRanked(normalizeRanked(exits, 'activity'), 'page').slice(0, 6),
    campaigns: labelRanked(normalizeRanked(campaigns, 'activity'), 'referrer').slice(0, 6),
    links: {
      replays: `${root}/replays`,
      heatmaps: `${root}/heatmaps`,
      events: `${root}/events`,
      funnels: `${root}/funnels`,
      journeys: `${root}/journeys`,
      performance: `${root}/performance`,
    },
    replaySampleRate: replay && typeof replay['sampleRate'] === 'number' ? replay['sampleRate'] : null,
    heatmapSampleRate: replay && typeof replay['heatmapSampleRate'] === 'number' ? replay['heatmapSampleRate'] : null,
    readingAverageSeconds: null,
    readingMedianSeconds: null,
    readingTotalSeconds: null,
  };
}

async function attachReading(
  config: {baseUrl: string; apiKey: string; websiteId: string},
  window: {startAt: number; endAt: number},
  report: Extract<AnalyticsReport, {status: 'ready'}>,
): Promise<AnalyticsReport> {
  const overall = await numericStats(config, window, 'engagedSeconds');
  const articles = await Promise.all(report.articles.map(async (article) => {
    const stats = article.path ? await numericStats(config, window, 'engagedSeconds', article.path) : null;
    return {
      ...article,
      readingAverageSeconds: stats?.average ?? null,
      readingMedianSeconds: stats?.median ?? null,
    };
  }));
  return {
    ...report,
    articles,
    behavior: {
      ...report.behavior,
      readingAverageSeconds: overall?.average ?? null,
      readingMedianSeconds: overall?.median ?? null,
      readingTotalSeconds: overall?.total ?? null,
      readingNote: overall
        ? 'Average and median are calculated from one completed-view total per article view. Checkpoint events are not included. Views that never reported an exit are excluded.'
        : 'No completed article views reported an exit in this range. Checkpoint lengths are not averaged.',
    },
  };
}

async function numericStats(
  config: {baseUrl: string; apiKey: string; websiteId: string},
  window: {startAt: number; endAt: number},
  propertyName: string,
  path?: string,
): Promise<{total: number; average: number; median: number} | null> {
  const payload = await optionalGet(config, `/api/websites/${config.websiteId}/event-data-pivot/numeric-stats`, {
    startAt: window.startAt,
    endAt: window.endAt,
    eventName: 'article_reading_summary',
    propertyName,
    ...(path ? {path} : {}),
  });
  return normalizeNumericStats(payload);
}

async function optionalGet(
  config: {baseUrl: string; apiKey: string},
  path: string,
  params: Record<string, string | number>,
): Promise<unknown> {
  try {
    return await umamiGet(config, path, params);
  } catch {
    return null;
  }
}

function readVitals(payload: unknown): AnalyticsBehavior['performance'] {
  if (!isRecord(payload)) return null;
  const keys = ['lcp', 'inp', 'cls', 'fcp', 'ttfb'] as const;
  const vitals = {} as Record<(typeof keys)[number], VitalNumbers>;
  for (const key of keys) {
    const value = payload[key];
    if (!isRecord(value) || typeof value['p50'] !== 'number' || typeof value['p75'] !== 'number' || typeof value['p95'] !== 'number') return null;
    vitals[key] = {p50: value['p50'], p75: value['p75'], p95: value['p95']};
  }
  return vitals;
}

function readJourneys(payload: unknown): string[] {
  if (!Array.isArray(payload)) return [];
  return payload.slice(0, 6).flatMap((item) => {
    if (!isRecord(item)) return [];
    if (typeof item['path'] === 'string') return [item['path']];
    if (Array.isArray(item['items'])) return [item['items'].map((step) => String(step)).join(' → ')];
    return [];
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

class UmamiHttpError extends Error {
  status: number;
  constructor(status: number) {
    super('Umami request failed');
    this.name = 'UmamiHttpError';
    this.status = status;
  }
}
