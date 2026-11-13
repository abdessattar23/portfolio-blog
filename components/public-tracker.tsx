'use client';

import {useEffect} from 'react';
import {usePathname} from 'next/navigation';
import {classifyClick, trackEvent} from '../lib/analytics/events';
import {installHistoryGuard} from '../lib/analytics/document-boundary';
import {isPrivatePath, isProductionHost, UMAMI_COLLECTOR_HOST, UMAMI_WEBSITE_ID} from '../lib/analytics/privacy';

export function PublicTracker() {
  const pathname = usePathname();

  useEffect(() => {
    if (!isProductionHost(window.location.hostname) || isPrivatePath(pathname)) return;
    window.umamiBeforeSend = (_type, payload) => {
      const url = typeof payload['url'] === 'string' ? payload['url'] : window.location.pathname;
      if (isPrivatePath(url)) return false;
      return payload;
    };
    mountScript('umami-script', `${UMAMI_COLLECTOR_HOST}/script.js`, {
      'website-id': UMAMI_WEBSITE_ID,
      domains: 'abdessattar.dev',
      'do-not-track': 'true',
      'exclude-search': 'true',
      performance: 'true',
      'before-send': 'umamiBeforeSend',
    });
    mountScript('umami-recorder', `${UMAMI_COLLECTOR_HOST}/recorder.js`, {
      'website-id': UMAMI_WEBSITE_ID,
    }, installHistoryGuard);
  }, [pathname]);

  useEffect(() => {
    if (!isProductionHost(window.location.hostname) || isPrivatePath(pathname)) return;
    function onClick(event: MouseEvent) {
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a');
      if (!link) return;
      const href = link.getAttribute('href');
      if (!href) return;
      const classified = classifyClick({
        href,
        pagePath: window.location.pathname,
        inNav: Boolean(link.closest('nav, header, footer')),
        inArticle: Boolean(link.closest('[data-article-body], .article-layout')),
      });
      if (!classified) return;
      trackEvent(classified.name, {
        pagePath: window.location.pathname,
        pageType: pageType(window.location.pathname),
        target: classified.target,
        location: link.closest('nav') ? 'navigation' : link.closest('footer') ? 'footer' : 'page',
        ...(articleSlug(window.location.pathname) ? {articleSlug: articleSlug(window.location.pathname)} : {}),
      });
    }
    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [pathname]);

  return null;
}

function mountScript(id: string, src: string, data: Record<string, string>, onLoad?: () => void) {
  const existing = document.getElementById(id);
  if (existing) {
    onLoad?.();
    return;
  }
  const script = document.createElement('script');
  script.id = id;
  script.defer = true;
  script.src = src;
  if (onLoad) script.addEventListener('load', onLoad);
  for (const [key, value] of Object.entries(data)) script.dataset[toCamel(key)] = value;
  document.head.appendChild(script);
}

function toCamel(value: string): string {
  return value.replace(/-([a-z])/g, (_match, letter: string) => letter.toUpperCase());
}

function pageType(path: string): string {
  if (path === '/') return 'home';
  if (path === '/blog') return 'blog';
  if (path.startsWith('/blog/')) return 'article';
  if (path.startsWith('/work')) return 'work';
  if (path.startsWith('/speaking')) return 'speaking';
  if (path.startsWith('/about')) return 'about';
  return 'page';
}

function articleSlug(path: string): string | undefined {
  return /^\/blog\/([a-z0-9-]+)$/.exec(path)?.[1];
}
