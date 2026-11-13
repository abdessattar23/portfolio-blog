import {DEFAULT_UMAMI_BASE_URL, parseAnalyticsQuery} from '../../../lib/studio/analytics-model';
import {loadAnalytics} from '../../../lib/studio/umami';
import {AnalyticsDashboard} from './dashboard';

export const dynamic = 'force-dynamic';

export default async function AnalyticsPage({searchParams}: {searchParams: Promise<Record<string, string | string[] | undefined>>}) {
  const params = await searchParams;
  const parsed = parseAnalyticsQuery({
    get(name: string) {
      const value = params[name];
      return Array.isArray(value) ? value[0] ?? null : value ?? null;
    },
  });
  const report = 'error' in parsed
    ? {status: 'error' as const, message: parsed.error, umamiUrl: DEFAULT_UMAMI_BASE_URL}
    : await loadAnalytics(parsed);
  return <AnalyticsDashboard initial={report} />;
}
