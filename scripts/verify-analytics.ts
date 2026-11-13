import {classifyClick, sanitizeProperties} from '../lib/analytics/events';
import {privateDocumentUrl} from '../lib/analytics/document-boundary';
import {isPrivatePath, isProductionHost, shouldTrackPage} from '../lib/analytics/privacy';
import {createReadingClock, markActivity, nextScrollMilestones, readingEmissions} from '../lib/analytics/reading';
import {
  analyticsWindow,
  articlesFromPages,
  normalizeActive,
  normalizeNumericStats,
  normalizeRanked,
  normalizeSeries,
  normalizeStats,
  parseAnalyticsQuery,
  publicUmamiUrl,
  readAnalyticsConfig,
} from '../lib/studio/analytics-model';

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

const missing = readAnalyticsConfig({});
assert('missing' in missing && missing.missing.includes('UMAMI_API_KEY') && missing.missing.includes('UMAMI_WEBSITE_ID'), 'Missing Umami secrets should be reported by name.');
const http = readAnalyticsConfig({UMAMI_API_KEY: 'secret', UMAMI_WEBSITE_ID: '11111111-1111-4111-8111-111111111111', UMAMI_BASE_URL: 'http://umami.example'});
assert('missing' in http && http.missing.includes('UMAMI_BASE_URL'), 'The Umami base URL must be https.');

const current = normalizeStats({
  pageviews: 100,
  visitors: 40,
  visits: 50,
  bounces: 25,
  totaltime: 5000,
  comparison: {pageviews: 50, visitors: 20, visits: 25, bounces: 5, totaltime: 1000},
});
assert(current?.pageviews.change === 100, 'Current Umami stats should compare with the previous period.');
assert(current?.bounceRate.value === 0.5, 'Bounce rate is bounces divided by visits.');
assert(current?.duration.value === 100, 'Average duration is total time divided by visits.');

const legacy = normalizeStats({
  pageviews: {value: 10, prev: 0},
  visitors: {value: 4, prev: 4},
  visits: {value: 8, prev: 8},
  bounces: {value: 2, prev: 2},
  totaltime: {value: 80, prev: 80},
});
assert(legacy?.pageviews.change === null, 'A zero previous value should not invent a percentage.');
assert(legacy?.visitors.change === 0, 'Legacy value/prev stats should still compare.');

const series = normalizeSeries({
  pageviews: [{x: '2026-11-10 00:00:00', y: 3}],
  sessions: [{x: '2026-11-10 00:00:00', y: 2}],
}, 'day');
assert(series.length === 1 && series[0]?.pageviews === 3 && series[0]?.visits === 2, 'Pageview series should keep sessions as visits.');
assert(normalizeActive({visitors: 4}) === 4, 'Active visitors should come from the visitors field.');

const articles = articlesFromPages(
  [{label: 'https://abdessattar.dev/blog/pooled-hashmap/', pageviews: 8, visitors: 5, count: 8, share: 1}, {label: '/about', pageviews: 4, visitors: 2, count: 4, share: 0}],
  [{slug: 'pooled-hashmap', title: 'Why walking a bucket backwards can keep a metric alive'}],
  12,
);
assert(articles.length === 1 && articles[0]?.title.startsWith('Why walking') && articles[0]?.share === 8 / 12, 'Only known article paths should become articles.');
assert(!JSON.stringify(articles).includes('UMAMI_API_KEY'), 'Resolved articles should not carry credentials.');

const bad = parseAnalyticsQuery({get: (name) => name === 'range' ? 'custom' : null});
assert('error' in bad, 'A custom range without dates should fail.');
const week = analyticsWindow({range: '7d'}, Date.UTC(2026, 10, 10, 12));
assert(week.endAt - week.startAt === 7 * 86_400_000 && week.unit === 'day', 'Seven days should use daily buckets.');
const day = analyticsWindow({range: '24h'}, Date.UTC(2026, 10, 10, 12));
assert(day.unit === 'hour', 'A 24-hour range should use hourly buckets.');
assert(publicUmamiUrl('https://umami.wetalentify.com/', '11111111-1111-4111-8111-111111111111') === 'https://umami.wetalentify.com/websites/11111111-1111-4111-8111-111111111111', 'A known website id should open its Umami page.');
assert(publicUmamiUrl('https://umami.wetalentify.com', 'not-an-id') === 'https://umami.wetalentify.com', 'An unverified website id should stay on the Umami root.');

const ranked = normalizeRanked([{x: '', y: 3}, {x: 'news.ycombinator.com', y: 1}], 'activity');
assert(normalizeNumericStats({total: '0', average: '0', median: 0, max: '0', min: '0'}) === null, 'An empty numeric-stats payload is not an average of zero seconds.');
assert(normalizeNumericStats({total: '90', average: '45', median: 45, max: '60', min: '30'})?.average === 45, 'Numeric stats accept the string values this Umami build returns.');

assert(!shouldTrackPage('localhost', '/'), 'Localhost is not tracked.');
assert(!shouldTrackPage('abdessattar.dev', '/studio/analytics'), 'Studio is not tracked.');
assert(shouldTrackPage('abdessattar.dev', '/blog/pooled-hashmap'), 'Public articles are tracked.');
assert(isPrivatePath('/api/studio/analytics') && isProductionHost('abdessattar.dev'), 'Private APIs stay private on the production host.');
assert(privateDocumentUrl('https://abdessattar.dev/blog/pooled-hashmap', '/studio') === 'https://abdessattar.dev/studio', 'A public page enters Studio as its own document.');
assert(privateDocumentUrl('https://abdessattar.dev/blog/pooled-hashmap', '/api/auth/login?return=/studio') === 'https://abdessattar.dev/api/auth/login?return=/studio', 'Authentication leaves the public document.');
assert(privateDocumentUrl('https://abdessattar.dev/blog/pooled-hashmap', '/oauth/authorize') === 'https://abdessattar.dev/oauth/authorize', 'OAuth leaves the public document.');
assert(privateDocumentUrl('https://abdessattar.dev/blog/pooled-hashmap', '/blog/other-article') === null, 'Article-to-article navigation stays inside the public app.');
assert(privateDocumentUrl('https://abdessattar.dev/studio/analytics', '/studio') === null, 'Studio routes stay in the Studio document.');
assert(privateDocumentUrl('https://abdessattar.dev/blog/pooled-hashmap', 'https://github.com/abdessattar23') === null, 'External links are left to the browser.');
assert(classifyClick({href: 'https://github.com/abdessattar23', pagePath: '/', inNav: false, inArticle: false})?.name === 'github_click', 'GitHub clicks have their own event.');
assert(classifyClick({href: '/studio', pagePath: '/', inNav: true, inArticle: false}) === null, 'Studio links are not tracked.');
assert(classifyClick({href: '#mechanism', pagePath: '/blog/pooled-hashmap', inNav: false, inArticle: true})?.name === 'article_toc_click', 'Article headings are table-of-contents clicks.');
const clean = sanitizeProperties({'Bad Key': 'secret', pagePath: 'x'.repeat(200), count: 1.23456});
assert(!('Bad Key' in clean) && typeof clean['pagePath'] === 'string' && clean['pagePath'].length <= 80 && clean['count'] === 1.235, 'Event properties are limited and unnamed keys are dropped.');

let clock = readingEmissions(markActivity(createReadingClock(0), 0), 0, true, true).clock;
const first = readingEmissions(clock, 20_000, true, true);
assert(first.deltaSeconds === 20 && first.checkpoints.includes(15), 'Twenty visible seconds emit the 15 second checkpoint and one delta.');
const hidden = readingEmissions(first.clock, 20_000, false, true);
const later = readingEmissions(hidden.clock, 80_000, false, true);
assert(hidden.deltaSeconds === 0 && later.deltaSeconds === 0, 'Background time after a flush does not add more engaged time.');
const started = readingEmissions(markActivity(createReadingClock(0), 0), 0, true, true).clock;
const idled = readingEmissions(started, 90_000, true, true);
assert(idled.deltaSeconds === 75, 'Idle time beyond the timeout is excluded.');
assert(nextScrollMilestones([], 50).join(',') === '25,50', 'Scroll milestones fire once up to the current depth.');
assert(nextScrollMilestones([25, 50], 100).join(',') === '75,90,100', 'Earlier scroll milestones are not repeated.');

console.log('Verified Umami response normalization, article matching, date windows, privacy, and reading time.');
