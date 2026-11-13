import {isPrivatePath, isProductionHost} from './privacy';

export const ANALYTICS_EVENTS = [
  'navigation_click',
  'internal_link_click',
  'outbound_link_click',
  'contact_click',
  'github_click',
  'linkedin_click',
  'email_click',
  'cv_download',
  'project_open',
  'speaking_talk_click',
  'conference_link_click',
  'theme_toggle',
  'article_opened',
  'article_scroll_depth',
  'article_reading_checkpoint',
  'article_reading_summary',
  'article_end_reached',
  'article_toc_click',
  'article_code_copy',
  'article_external_reference_click',
  'article_related_post_click',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];
export type AnalyticsValue = string | number;
export type AnalyticsProperties = Record<string, AnalyticsValue | undefined>;

type UmamiTracker = {
  track: (name: string, data?: Record<string, AnalyticsValue>) => void;
};

declare global {
  interface Window {
    umami?: UmamiTracker;
    umamiBeforeSend?: (type: string, payload: Record<string, unknown>) => Record<string, unknown> | false;
  }
}

const PROPERTY_LIMIT = 80;

export function sanitizeProperties(input: AnalyticsProperties = {}): Record<string, AnalyticsValue> {
  const entries = Object.entries(input).slice(0, 24);
  const data: Record<string, AnalyticsValue> = {};
  for (const [key, value] of entries) {
    if (!/^[a-z][a-zA-Z0-9]{0,40}$/.test(key) || value === undefined) continue;
    if (typeof value === 'number' && Number.isFinite(value)) data[key] = Math.round(value * 1000) / 1000;
    if (typeof value === 'string') data[key] = value.replace(/\s+/g, ' ').trim().slice(0, PROPERTY_LIMIT);
  }
  return data;
}

export function trackEvent(name: AnalyticsEventName, properties?: AnalyticsProperties): void {
  if (typeof window === 'undefined') return;
  if (!isProductionHost(window.location.hostname) || isPrivatePath(window.location.pathname)) return;
  window.umami?.track(name, sanitizeProperties(properties));
}

export function classifyClick(input: {
  href: string;
  pagePath: string;
  inNav: boolean;
  inArticle: boolean;
}): {name: AnalyticsEventName; target: string} | null {
  const href = input.href.trim();
  if (!href || href.startsWith('javascript:')) return null;
  const target = href.slice(0, PROPERTY_LIMIT);
  if (href.startsWith('#') && input.inArticle) return {name: 'article_toc_click', target};
  let url: URL | null = null;
  try {
    url = new URL(href, 'https://abdessattar.dev');
  } catch {
    return null;
  }
  const host = url.hostname.replace(/^www\./, '');
  const path = url.pathname.length > 1 ? url.pathname.replace(/\/+$/, '') : url.pathname;
  if (host === 'github.com') return {name: 'github_click', target};
  if (host.includes('linkedin.com')) return {name: 'linkedin_click', target};
  if (url.protocol === 'mailto:') return {name: 'email_click', target: 'mailto'};
  if (/\.pdf$/i.test(path) || /(?:^|\/)cv(?:\/|$)/i.test(path)) return {name: 'cv_download', target};
  if (host && host !== 'abdessattar.dev') {
    if (input.pagePath.startsWith('/speaking') && /devoxx|conference|sessionize/i.test(host + path)) {
      return {name: 'conference_link_click', target};
    }
    if (input.inArticle) return {name: 'article_external_reference_click', target};
    return {name: 'outbound_link_click', target};
  }
  if (isPrivatePath(path)) return null;
  if (/^\/work\/[a-z0-9-]+$/.test(path)) return {name: 'project_open', target: path};
  if (path === '/speaking' || path.startsWith('/speaking#')) return {name: 'speaking_talk_click', target: path};
  if (input.pagePath.startsWith('/blog/') && /^\/blog\/[a-z0-9-]+$/.test(path) && path !== input.pagePath) {
    return {name: 'article_related_post_click', target: path};
  }
  if (input.inNav) return {name: 'navigation_click', target: path};
  return {name: 'internal_link_click', target: path};
}
