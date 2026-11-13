import {isRefusal, requireOwnerApi} from '../../../../lib/studio/auth';
import {DEFAULT_UMAMI_BASE_URL, parseAnalyticsQuery} from '../../../../lib/studio/analytics-model';
import {loadAnalytics} from '../../../../lib/studio/umami';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const owner = await requireOwnerApi(request);
  if (isRefusal(owner)) return owner;
  const parsed = parseAnalyticsQuery(new URL(request.url).searchParams);
  if ('error' in parsed) {
    return Response.json(
      {status: 'error', message: parsed.error, umamiUrl: DEFAULT_UMAMI_BASE_URL},
      {status: 400, headers: {'Cache-Control': 'no-store'}},
    );
  }
  const report = await loadAnalytics(parsed);
  return Response.json(report, {headers: {'Cache-Control': 'no-store'}});
}
