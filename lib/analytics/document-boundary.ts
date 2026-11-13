import {isPrivatePath} from './privacy';

const historyGuard = Symbol.for('abdessattar.documentBoundary');

type GuardedHistoryMethod = History['pushState'] & {[historyGuard]?: true};

/**
 * Full document URL when a public page is about to enter Studio, OAuth, or auth.
 * Public-to-public and Studio-to-Studio navigations return null so the App Router can keep them.
 */
export function privateDocumentUrl(currentHref: string, href: string): string | null {
  let current: URL;
  let target: URL;
  try {
    current = new URL(currentHref);
    target = new URL(href, current);
  } catch {
    return null;
  }
  if (target.origin !== current.origin) return null;
  if (target.pathname === current.pathname && target.search === current.search) return null;
  if (isPrivatePath(current.pathname) || !isPrivatePath(target.pathname)) return null;
  return target.href;
}

function historyDestination(url: string | URL | null | undefined): string | null {
  if (typeof url !== 'string' && !(url instanceof URL)) return null;
  if (String(url) === '') return null;
  return privateDocumentUrl(window.location.href, String(url));
}

/** Keep the guard outside later history wrappers so a private URL cannot stay in this document. */
export function installHistoryGuard(): void {
  const currentPush = history.pushState as GuardedHistoryMethod;
  const currentReplace = history.replaceState as GuardedHistoryMethod;
  if (currentPush[historyGuard] && currentReplace[historyGuard]) return;

  const previousPush = history.pushState.bind(history);
  const previousReplace = history.replaceState.bind(history);
  const push: GuardedHistoryMethod = function (data, unused, url) {
    const destination = historyDestination(url);
    if (destination) {
      window.location.assign(destination);
      return;
    }
    return previousPush(data, unused, url);
  };
  const replace: GuardedHistoryMethod = function (data, unused, url) {
    const destination = historyDestination(url);
    if (destination) {
      window.location.replace(destination);
      return;
    }
    return previousReplace(data, unused, url);
  };
  push[historyGuard] = true;
  replace[historyGuard] = true;
  history.pushState = push;
  history.replaceState = replace;
}
