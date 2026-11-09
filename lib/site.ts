export const NAME_VARIANTS = [
  'Mohammed Elyagoubi',
  'Mohamed Elyagoubi',
  'Mohammed El Yagoubi',
  'Mohamed El Yagoubi',
  'Mohammed El-Yagoubi',
  'Mohamed El-Yagoubi',
  'Mohammed Abdessattar Elyagoubi',
  'Mohammed Abdessetar Elyagoubi',
  'Mohamed Abdessattar Elyagoubi',
  'Mohamed Abdessetar Elyagoubi',
  'Mohammed Abdessattar El Yagoubi',
  'Mohammed Abdessetar El Yagoubi',
  'Mohamed Abdessattar El Yagoubi',
  'Mohamed Abdessetar El Yagoubi',
  'Mohammed Abdessattar El-Yagoubi',
  'Mohammed Abdessetar El-Yagoubi',
  'Mohamed Abdessattar El-Yagoubi',
  'Mohamed Abdessetar El-Yagoubi',
  'Abdessattar Elyagoubi',
  'Abdessetar Elyagoubi',
  'abdessattar23',
] as const;

export const KNOWS_ABOUT = [
  'Java',
  'OpenTelemetry',
  'OpenTelemetry Java SDK',
  'Observability',
  'Backend Engineering',
  'Concurrency',
  'JVM Internals',
  'Distributed Tracing',
  'Metrics Collection',
  'Open Source Software',
] as const;

export const SITE = {
  name: 'Mohammed Elyagoubi',
  fullName: 'Mohammed Abdessetar Elyagoubi',
  handle: 'abdessattar23',
  alternateNames: NAME_VARIANTS,
  knowsAbout: KNOWS_ABOUT,
  role: 'Java backend engineer · Rabat, Morocco',
  jobTitle: 'Java Backend Engineer',
  employer: 'Orange / Sofrecom',
  location: 'Rabat, Morocco',
  bio: 'Java backend engineer at Orange/Sofrecom in Rabat, Morocco. Contributor to the OpenTelemetry Java SDK, writing about concurrency, collection behavior, sampler configuration, and bugs hiding between abstractions.',
  url: 'https://abdessattar.dev',
  github: 'https://github.com/abdessattar23',
  linkedin: 'https://linkedin.com/in/abdessattar23',
  rss: '/feed.xml',
  llms: '/llms.txt',
  llmsFull: '/llms-full.txt',
  speaking: [
    {
      status: 'Delivered' as const,
      event: 'Devoxx Morocco 2026',
      location: 'Casablanca, Morocco',
      title: 'The Future of Open Source Has New Faces',
      summary:
        'AI can lower the barrier to entering open source. Earning trust still requires understanding the work and taking responsibility for a contribution.',
      detail:
        'A talk on entering open source and contributing beyond the amount of code written.',
    },
    {
      status: 'Proposal' as const,
      event: 'OCX 2027',
      location: 'TBD',
      title: 'When Observability Breaks: Four Bugs I Fixed in OpenTelemetry Java',
      summary: 'Submitted to OCX 2027. Acceptance is not confirmed.',
    },
  ],
} as const;

export function formatUtcDate(isoDate: string, month: 'short' | 'long' = 'short') {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString('en-GB', {
    day: '2-digit',
    month,
    year: 'numeric',
    timeZone: 'UTC',
  });
}
