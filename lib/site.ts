import {siteSettings} from './content/load';

export const SITE = {
  ...siteSettings,
  rss: '/feed.xml',
  llms: '/llms.txt',
  llmsFull: '/llms-full.txt',
} as const;

export function formatUtcDate(isoDate: string, month: 'short' | 'long' = 'short') {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month,
    year: 'numeric',
    timeZone: 'UTC',
  });
}
