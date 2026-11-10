import type {SiteSettings} from './content/schema';

const STANDARD_ICONS = [
  {url: '/favicon.ico', sizes: '16x16 32x32 48x48 96x96', type: 'image/x-icon'},
  {url: '/favicon-96.png', sizes: '96x96', type: 'image/png'},
  {url: '/favicon.svg', sizes: 'any', type: 'image/svg+xml'},
] as const;

export type SiteIcon = {url: string; sizes?: string; type?: string};

function iconMime(url: string): string | undefined {
  const path = url.split('?')[0]?.toLowerCase() ?? '';
  if (path.endsWith('.svg')) return 'image/svg+xml';
  if (path.endsWith('.png')) return 'image/png';
  if (path.endsWith('.ico')) return 'image/x-icon';
  if (path.endsWith('.gif')) return 'image/gif';
  if (path.endsWith('.jpg') || path.endsWith('.jpeg')) return 'image/jpeg';
  if (path.endsWith('.webp')) return 'image/webp';
  return undefined;
}

export function siteIcons(favicon?: string): {icon: SiteIcon[]} {
  const icons: SiteIcon[] = STANDARD_ICONS.map((icon) => ({...icon}));
  if (favicon && !icons.some((icon) => icon.url === favicon)) {
    const type = iconMime(favicon);
    icons.unshift(type === undefined ? {url: favicon} : {url: favicon, type});
  }
  return {icon: icons};
}

export function homeDocumentTitle(site: Pick<SiteSettings, 'websiteName'>): string {
  return `${site.websiteName} | Java, JVM & observability`;
}

export function bareDocumentTitle(title: string, site: Pick<SiteSettings, 'websiteName'>): string {
  const suffix = ` | ${site.websiteName}`;
  const trimmed = title.trim();
  if (!trimmed.endsWith(suffix)) return trimmed;
  const bare = trimmed.slice(0, -suffix.length).trim();
  return bare || trimmed;
}

export function withSiteTitle(title: string, site: Pick<SiteSettings, 'websiteName'>): string {
  const suffix = ` | ${site.websiteName}`;
  const trimmed = bareDocumentTitle(title, site);
  if (!trimmed || trimmed === site.websiteName) return homeDocumentTitle(site);
  return trimmed.endsWith(suffix) ? trimmed : `${trimmed}${suffix}`;
}
