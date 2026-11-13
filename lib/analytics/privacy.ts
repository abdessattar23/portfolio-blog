export const UMAMI_COLLECTOR_HOST = 'https://umami.wetalentify.com';
export const UMAMI_WEBSITE_ID = 'e9e94d71-6a9b-4d0e-9d7e-a5f4e81e8e1c';
export const PUBLIC_HOSTS = ['abdessattar.dev'] as const;

const PRIVATE_PREFIXES = ['/studio', '/api', '/oauth', '/auth'];

export function isProductionHost(hostname: string): boolean {
  return (PUBLIC_HOSTS as readonly string[]).includes(hostname);
}

export function isPrivatePath(path: string): boolean {
  const pathname = path.startsWith('http') ? safePath(path) : path.split('?')[0] || '/';
  return PRIVATE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function shouldTrackPage(hostname: string, path: string): boolean {
  return isProductionHost(hostname) && !isPrivatePath(path);
}

function safePath(value: string): string {
  try {
    return new URL(value).pathname;
  } catch {
    return '/';
  }
}
