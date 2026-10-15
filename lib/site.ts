export const SITE = {
  name: 'Mohammed Elyagoubi',
  fullName: 'Mohammed Abdessetar Elyagoubi',
  handle: 'abdessattar23',
  role: 'Java backend engineer · Rabat, Morocco',
  url: 'https://abdessattar23.dev',
  github: 'https://github.com/abdessattar23',
  linkedin: 'https://linkedin.com/in/abdessattar23',
  rss: '/feed.xml',
} as const;

export function formatUtcDate(isoDate: string, month: 'short' | 'long' = 'short') {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month,
    year: 'numeric',
    timeZone: 'UTC',
  });
}
