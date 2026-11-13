'use client';

import {useState} from 'react';
import {ANALYTICS_RANGES, type AnalyticsRange, type AnalyticsReport, type ArticleRow, type RankedRow, type TrafficPoint} from '../../../lib/studio/analytics-model';

const RANGE_LABELS: Record<AnalyticsRange, string> = {
  today: 'Today',
  '24h': 'Last 24 hours',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  '90d': 'Last 90 days',
  custom: 'Custom range',
};

const SECTIONS = ['overview', 'content', 'events', 'sessions', 'audience', 'performance'] as const;
type AnalyticsSection = (typeof SECTIONS)[number];
const SECTION_LABELS: Record<AnalyticsSection, string> = {
  overview: 'Overview',
  content: 'Content',
  events: 'Events',
  sessions: 'Sessions & replays',
  audience: 'Audience',
  performance: 'Performance',
};

export function AnalyticsDashboard({initial}: {initial: AnalyticsReport}) {
  const [report, setReport] = useState(initial);
  const [range, setRange] = useState<AnalyticsRange>(initial.status === 'ready' ? initial.range : '7d');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [section, setSection] = useState<AnalyticsSection>('overview');
  async function load(next: {range: AnalyticsRange; start?: string; end?: string; fresh?: boolean}) {
    if (next.range === 'custom' && (!next.start || !next.end)) {
      setNotice('Choose both dates, then apply the range.');
      return;
    }
    setLoading(true);
    setNotice('');
    const params = new URLSearchParams({range: next.range});
    if (next.start) params.set('start', next.start);
    if (next.end) params.set('end', next.end);
    if (next.fresh) params.set('fresh', '1');
    try {
      const response = await fetch(`/api/studio/analytics?${params.toString()}`, {cache: 'no-store'});
      if (response.status === 401) {
        window.location.assign('/api/auth/login?return=/studio/analytics');
        return;
      }
      if (!response.ok && response.status !== 400) {
        setReport({status: 'error', message: 'The studio could not read analytics.', umamiUrl: report.umamiUrl});
        return;
      }
      const body = await response.json() as AnalyticsReport;
      if (!body || typeof body !== 'object' || !('status' in body)) {
        setReport({status: 'error', message: 'The studio could not read analytics.', umamiUrl: report.umamiUrl});
        return;
      }
      setReport(body);
    } catch {
      setReport({status: 'error', message: 'The analytics request did not reach the studio.', umamiUrl: report.umamiUrl});
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="analytics-page">
      <header className="analytics-header">
        <div>
          <p className="eyebrow">ATELIER · READERSHIP</p>
          <h1>Analytics<span>.</span></h1>
          <p>Understand how people discover and read your work.</p>
        </div>
        <div className="analytics-header-actions">
          <a className="atelier-btn-primary" href={report.umamiUrl} target="_blank" rel="noreferrer">
            Open full analytics ↗
          </a>
          <p>For heatmaps, session replays, visitor journeys, and detailed reports, open Umami.</p>
        </div>
      </header>

      <form
        className="analytics-controls"
        onSubmit={(event) => {
          event.preventDefault();
          void load({range, start, end, fresh: true});
        }}
      >
        <label>
          <span>Time range</span>
          <select
            value={range}
            onChange={(event) => {
              const next = event.target.value as AnalyticsRange;
              setRange(next);
              if (next !== 'custom') void load({range: next});
            }}
          >
            {ANALYTICS_RANGES.map((item) => <option key={item} value={item}>{RANGE_LABELS[item]}</option>)}
          </select>
        </label>
        {range === 'custom' ? (
          <>
            <label>
              <span>Start</span>
              <input type="date" value={start} required onChange={(event) => setStart(event.target.value)} />
            </label>
            <label>
              <span>End</span>
              <input type="date" value={end} required onChange={(event) => setEnd(event.target.value)} />
            </label>
            <button type="submit" className="atelier-btn-secondary">Apply</button>
          </>
        ) : (
          <button type="submit" className="atelier-btn-secondary">Refresh</button>
        )}
      </form>
      {notice ? <p className="studio-alert">{notice}</p> : null}
      {report.status === 'ready' ? (
        <div className="analytics-tabs" role="tablist" aria-label="Analytics sections">
          {SECTIONS.map((item) => (
            <button key={item} type="button" role="tab" aria-selected={section === item} onClick={() => setSection(item)}>
              {SECTION_LABELS[item]}
            </button>
          ))}
        </div>
      ) : null}

      {loading ? <AnalyticsSkeleton /> : <AnalyticsBody report={report} section={section} />}
    </div>
  );
}

function AnalyticsBody({report, section}: {report: AnalyticsReport; section: AnalyticsSection}) {
  if (report.status === 'unconfigured') {
    return (
      <section className="analytics-panel">
        <h2>Umami is not configured</h2>
        <p>{report.message}</p>
        <ul>
          {report.missing.map((name) => <li key={name}><code>{name}</code></li>)}
        </ul>
        <p>Set them as Worker secrets. Local development reads them from <code>.env</code>. The API key stays on the server.</p>
      </section>
    );
  }
  if (report.status === 'error') {
    return (
      <section className="analytics-panel">
        <h2>Analytics could not load</h2>
        <p>{report.message}</p>
      </section>
    );
  }

  return (
    <>
      {section === 'overview' ? <Overview report={report} /> : null}
      {section === 'content' ? <Content report={report} /> : null}
      {section === 'events' ? <Events report={report} /> : null}
      {section === 'sessions' ? <Sessions report={report} /> : null}
      {section === 'audience' ? <Audience report={report} /> : null}
      {section === 'performance' ? <Performance report={report} /> : null}
    </>
  );
}

function Overview({report}: {report: Extract<AnalyticsReport, {status: 'ready'}>}) {
  return (
    <>
      <section className="analytics-kpis" aria-label="Overview">
        <Kpi label="Unique visitors" metric={report.visitors} format="count" />
        <Kpi label="Total pageviews" metric={report.pageviews} format="count" />
        <Kpi label="Visits" metric={report.visits} format="count" />
        <Kpi label="Bounce rate" metric={report.bounceRate} format="percent" />
        <Kpi label="Average visit duration" metric={report.duration} format="duration" />
        <article>
          <span>Currently active</span>
          <strong>{report.active === null ? '—' : formatCount(report.active)}</strong>
          <small>Last few minutes</small>
        </article>
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-head">
          <h2>Traffic</h2>
          <p>{report.unit === 'hour' ? 'Hourly' : report.unit === 'month' ? 'Monthly' : 'Daily'} · Africa/Casablanca</p>
        </div>
        {report.series.length === 0 ? <p className="analytics-empty">No traffic in this range.</p> : <TrafficChart points={report.series} />}
      </section>

      <section className="analytics-panel">
        <div className="analytics-panel-head">
          <h2>Top articles</h2>
          <p>Share of all pageviews</p>
        </div>
        {report.articles.length === 0 ? <p className="analytics-empty">No published article paths in this range.</p> : (
          <div className="analytics-table-wrap">
            <table className="analytics-table">
              <thead>
                <tr>
                  <th>Article</th>
                  <th>Pageviews</th>
                  <th>Visitors</th>
                  <th>Share</th>
                </tr>
              </thead>
              <tbody>
                {report.articles.map((article) => <ArticleLine key={article.path ?? article.slug} article={article} />)}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <div className="analytics-split">
        <Ranked title="Top pages" rows={report.pages} />
        <Ranked title="Sources" rows={report.referrers} />
      </div>
      <div className="analytics-split analytics-split-3">
        <Ranked title="Countries" rows={report.countries} />
        <Ranked title="Devices" rows={report.devices} />
        <Ranked title="Browsers" rows={report.browsers} />
      </div>
    </>
  );
}

function Content({report}: {report: Extract<AnalyticsReport, {status: 'ready'}>}) {
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-head">
        <h2>Article performance</h2>
        <p>
          {report.behavior.readingAverageSeconds === null
            ? report.behavior.readingNote
            : `Completed views only: average ${formatDuration(report.behavior.readingAverageSeconds)}, median ${formatDuration(report.behavior.readingMedianSeconds ?? 0)}, total engaged ${formatDuration(report.behavior.readingTotalSeconds ?? 0)}. ${report.behavior.readingNote}`}
        </p>
      </div>
      {report.articles.length === 0 ? <p className="analytics-empty">No published article paths in this range.</p> : (
        <div className="analytics-table-wrap">
          <table className="analytics-table">
            <thead>
              <tr>
                <th>Article</th>
                <th>Views</th>
                <th>Visitors</th>
                <th>Share</th>
                <th>Completed reading, average</th>
                <th>Completed reading, median</th>
              </tr>
            </thead>
            <tbody>
              {report.articles.map((article) => <ArticleLine key={article.slug} article={article} showReading />)}
            </tbody>
          </table>
          <p className="analytics-empty">These reading times include only views whose exit summary arrived. Open views and lost exit events are excluded. Estimated reading time from word count is separate and is not shown as a measurement.</p>
        </div>
      )}
    </section>
  );
}

function Events({report}: {report: Extract<AnalyticsReport, {status: 'ready'}>}) {
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-head">
        <h2>Custom events</h2>
        <a href={report.behavior.links.events} target="_blank" rel="noreferrer">Open events ↗</a>
      </div>
      <p>{report.behavior.eventCount === null ? 'Event totals are unavailable.' : `${formatCount(report.behavior.eventCount)} custom events in this range.`}</p>
      <Ranked title="By name" rows={report.behavior.eventNames} />
      <p className="analytics-empty">GitHub, LinkedIn, article reading, scroll, and outbound clicks appear here after the public site is deployed with the tracker. Search is not tracked because the public site has no search box.</p>
    </section>
  );
}

function Sessions({report}: {report: Extract<AnalyticsReport, {status: 'ready'}>}) {
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-head">
        <h2>Sessions</h2>
        <a href={report.behavior.links.replays} target="_blank" rel="noreferrer">Open replays ↗</a>
      </div>
      <p>Umami visit duration is the overview average. It is not active reading time. Replay sampling is {report.behavior.replaySampleRate === null ? 'unknown' : `${Math.round(report.behavior.replaySampleRate * 100)}%`}. Heatmap sampling is {report.behavior.heatmapSampleRate === null ? 'unknown' : `${Math.round(report.behavior.heatmapSampleRate * 100)}%`}.</p>
      <div className="analytics-split">
        <Ranked title="Landing pages" rows={report.behavior.landing} />
        <Ranked title="Exit pages" rows={report.behavior.exits} />
      </div>
      <h3>Journeys</h3>
      {report.behavior.journeys.length === 0 ? <p className="analytics-empty">No journey paths in this range. Detailed funnels stay in Umami until saved reports have traffic.</p> : (
        <ul>{report.behavior.journeys.map((path) => <li key={path}>{path}</li>)}</ul>
      )}
      <p><a href={report.behavior.links.funnels} target="_blank" rel="noreferrer">Funnels ↗</a> · <a href={report.behavior.links.journeys} target="_blank" rel="noreferrer">Journeys ↗</a> · <a href={report.behavior.links.heatmaps} target="_blank" rel="noreferrer">Heatmaps ↗</a></p>
    </section>
  );
}

function Audience({report}: {report: Extract<AnalyticsReport, {status: 'ready'}>}) {
  return (
    <>
      <div className="analytics-split">
        <Ranked title="Countries" rows={report.countries} />
        <Ranked title="Channels" rows={report.behavior.channels} />
      </div>
      <div className="analytics-split analytics-split-3">
        <Ranked title="Devices" rows={report.devices} />
        <Ranked title="Browsers" rows={report.browsers} />
        <Ranked title="Systems" rows={report.behavior.os} />
      </div>
      <Ranked title="Campaigns" rows={report.behavior.campaigns} />
    </>
  );
}

function Performance({report}: {report: Extract<AnalyticsReport, {status: 'ready'}>}) {
  const vitals = report.behavior.performance;
  return (
    <section className="analytics-panel">
      <div className="analytics-panel-head">
        <h2>Real-user performance</h2>
        <a href={report.behavior.links.performance} target="_blank" rel="noreferrer">Open performance ↗</a>
      </div>
      <p>{report.behavior.performanceNote}</p>
      {vitals ? (
        <div className="analytics-kpis">
          {(Object.keys(vitals) as (keyof typeof vitals)[]).map((name) => (
            <article key={name}>
              <span>{name.toUpperCase()}</span>
              <strong>{formatVital(name, vitals[name].p75)}</strong>
              <small>p75 · {vitalRating(name, vitals[name].p75)}</small>
            </article>
          ))}
        </div>
      ) : <p className="analytics-empty">No performance payload.</p>}
      <p>{report.behavior.errorsNote}</p>
    </section>
  );
}

function ArticleLine({article, showReading = false}: {article: ArticleRow; showReading?: boolean}) {
  return (
    <tr>
      <td>
        {article.draftId ? (
          <a href={`/studio/posts/${article.draftId}`}>{article.title}</a>
        ) : (
          <form action="/api/studio/drafts" method="post">
            <input type="hidden" name="kind" value="post" />
            <input type="hidden" name="slug" value={article.slug} />
            <button type="submit">{article.title}</button>
          </form>
        )}
        <small>{article.path}</small>
        <a href={`/blog/${article.slug}`} target="_blank" rel="noreferrer">View published ↗</a>
      </td>
      <td>{formatCount(article.pageviews ?? 0)}</td>
      <td>{article.visitors === null ? '—' : formatCount(article.visitors)}</td>
      <td>
        <span className="analytics-share" title={`${Math.round(article.share * 100)}% of pageviews`}>
          <span style={{width: `${article.share * 100}%`}} />
        </span>
        {Math.round(article.share * 100)}%
      </td>
      {showReading ? <td>{formatReading(article.readingAverageSeconds)}</td> : null}
      {showReading ? <td>{formatReading(article.readingMedianSeconds)}</td> : null}
    </tr>
  );
}

function Kpi({label, metric, format}: {label: string; metric: {value: number; change: number | null}; format: 'count' | 'percent' | 'duration'}) {
  const text = format === 'count'
    ? formatCount(metric.value)
    : format === 'percent'
      ? `${Math.round(metric.value * 100)}%`
      : formatDuration(metric.value);
  return (
    <article>
      <span>{label}</span>
      <strong>{text}</strong>
      <Delta value={metric.change} />
    </article>
  );
}

function Delta({value}: {value: number | null}) {
  if (value === null) return <small>No prior period</small>;
  const tone = value > 0 ? 'up' : value < 0 ? 'down' : 'flat';
  const rounded = Math.round(value);
  return <small data-tone={tone}>{rounded > 0 ? `+${rounded}` : `${rounded}`}% vs previous</small>;
}

function Ranked({title, rows}: {title: string; rows: RankedRow[]}) {
  const max = Math.max(1, ...rows.map((row) => row.count));
  return (
    <section className="analytics-panel">
      <h2>{title}</h2>
      {rows.length === 0 ? <p className="analytics-empty">No data in this range.</p> : (
        <ul className="analytics-bars">
          {rows.map((row) => (
            <li key={`${title}-${row.label}`}>
              <span>{row.label}</span>
              <span className="analytics-bar" aria-hidden="true"><span style={{width: `${(row.count / max) * 100}%`}} /></span>
              <strong>{formatCount(row.count)}</strong>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function TrafficChart({points}: {points: TrafficPoint[]}) {
  const width = 720;
  const height = 240;
  const pad = {left: 36, right: 12, top: 16, bottom: 32};
  const innerWidth = width - pad.left - pad.right;
  const innerHeight = height - pad.top - pad.bottom;
  const max = Math.max(1, ...points.flatMap((point) => [point.pageviews, point.visits]));
  const xAt = (index: number) => pad.left + (points.length === 1 ? innerWidth / 2 : (index / (points.length - 1)) * innerWidth);
  const yAt = (value: number) => pad.top + innerHeight - (value / max) * innerHeight;
  const line = (key: 'pageviews' | 'visits') => points.map((point, index) => `${index === 0 ? 'M' : 'L'} ${xAt(index).toFixed(1)} ${yAt(point[key]).toFixed(1)}`).join(' ');
  const ticks = [0, Math.round(max / 2), max];
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 2), points.length - 1])];

  return (
    <figure className="analytics-chart">
      <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={chartLabel(points)}>
        {ticks.map((tick) => (
          <g key={tick}>
            <line x1={pad.left} x2={width - pad.right} y1={yAt(tick)} y2={yAt(tick)} />
            <text x={0} y={yAt(tick) + 4}>{formatCount(tick)}</text>
          </g>
        ))}
        <path d={line('pageviews')} data-series="pageviews" />
        <path d={line('visits')} data-series="visits" />
        {points.map((point, index) => (
          <g key={point.at}>
            <circle cx={xAt(index)} cy={yAt(point.pageviews)} r="3" data-series="pageviews">
              <title>{`${point.label}: ${formatCount(point.pageviews)} pageviews, ${formatCount(point.visits)} visits`}</title>
            </circle>
          </g>
        ))}
        {labelIndexes.map((index) => (
          <text key={points[index]?.at ?? index} x={xAt(index)} y={height - 8} textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>
            {points[index]?.label}
          </text>
        ))}
      </svg>
      <figcaption>
        <span data-series="pageviews">Pageviews</span>
        <span data-series="visits">Visits</span>
      </figcaption>
      <table className="analytics-sr">
        <caption>Pageviews and visits over time</caption>
        <thead><tr><th>Time</th><th>Pageviews</th><th>Visits</th></tr></thead>
        <tbody>
          {points.map((point) => (
            <tr key={point.at}><td>{point.label}</td><td>{formatCount(point.pageviews)}</td><td>{formatCount(point.visits)}</td></tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

function AnalyticsSkeleton() {
  return (
    <div className="analytics-skeleton" aria-busy="true" aria-live="polite">
      <span>Loading analytics…</span>
      <div className="analytics-kpis">
        {Array.from({length: 6}, (_, index) => <article key={index} />)}
      </div>
      <div className="analytics-panel" />
    </div>
  );
}

function chartLabel(points: TrafficPoint[]): string {
  const pageviews = points.reduce((sum, point) => sum + point.pageviews, 0);
  const visits = points.reduce((sum, point) => sum + point.visits, 0);
  return `${formatCount(pageviews)} pageviews and ${formatCount(visits)} visits across ${points.length} intervals.`;
}

function formatReading(seconds: number | null): string {
  if (seconds === null) return 'No completed view';
  return formatDuration(seconds);
}

function formatVital(name: string, value: number): string {
  if (name === 'cls') return value.toFixed(3);
  return `${Math.round(value)} ms`;
}

function vitalRating(name: string, value: number): string {
  const bands: Record<string, [number, number]> = {
    lcp: [2500, 4000],
    inp: [200, 500],
    cls: [0.1, 0.25],
    fcp: [1800, 3000],
    ttfb: [800, 1800],
  };
  const band = bands[name];
  if (!band) return 'unrated';
  if (value <= band[0]) return 'good';
  if (value <= band[1]) return 'needs improvement';
  return 'poor';
}

function formatCount(value: number): string {
  return new Intl.NumberFormat('en-GB').format(Math.round(value));
}

function formatDuration(seconds: number): string {
  const whole = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(whole / 60);
  const rest = whole % 60;
  if (minutes <= 0) return `${rest}s`;
  return `${minutes}m ${rest.toString().padStart(2, '0')}s`;
}
