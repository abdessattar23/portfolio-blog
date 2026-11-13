'use client';

import {useEffect} from 'react';
import {installHistoryGuard, privateDocumentUrl} from '../lib/analytics/document-boundary';
import {isPrivatePath} from '../lib/analytics/privacy';

type AppRouter = {
  push: (href: string, options?: unknown) => void;
  replace: (href: string, options?: unknown) => void;
  __documentBoundary?: boolean;
};

function appRouter(): AppRouter | null {
  const candidate = (window as Window & {next?: {router?: AppRouter}}).next?.router;
  if (!candidate || typeof candidate.push !== 'function' || typeof candidate.replace !== 'function') return null;
  return candidate;
}

function hardenRouter() {
  const router = appRouter();
  if (!router || router.__documentBoundary) return;
  const push = router.push.bind(router);
  const replace = router.replace.bind(router);
  router.push = (href, options) => {
    const destination = typeof href === 'string' ? privateDocumentUrl(window.location.href, href) : null;
    if (destination) {
      window.location.assign(destination);
      return;
    }
    push(href, options);
  };
  router.replace = (href, options) => {
    const destination = typeof href === 'string' ? privateDocumentUrl(window.location.href, href) : null;
    if (destination) {
      window.location.replace(destination);
      return;
    }
    replace(href, options);
  };
  router.__documentBoundary = true;
}

export function DocumentBoundary() {
  useEffect(() => {
    hardenRouter();
    installHistoryGuard();

    function onClick(event: MouseEvent) {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      const link = target.closest('a[href]');
      if (!(link instanceof HTMLAnchorElement)) return;
      if (link.target && link.target !== '_self') return;
      if (link.hasAttribute('download')) return;
      const destination = privateDocumentUrl(window.location.href, link.href);
      if (!destination) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(destination);
    }

    function onSubmit(event: SubmitEvent) {
      const form = event.target;
      if (!(form instanceof HTMLFormElement)) return;
      if ((form.method || 'get').toLowerCase() !== 'get') return;
      const destination = privateDocumentUrl(window.location.href, form.action);
      if (!destination) return;
      event.preventDefault();
      event.stopPropagation();
      window.location.assign(destination);
    }

    function onPopState(event: PopStateEvent) {
      if (!isPrivatePath(window.location.pathname)) return;
      if (!document.getElementById('umami-script') && !document.getElementById('umami-recorder')) return;
      event.stopImmediatePropagation();
      window.location.replace(window.location.href);
    }

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener('popstate', onPopState, true);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener('popstate', onPopState, true);
    };
  }, []);

  return null;
}
