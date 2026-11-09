import type {Metadata} from 'next';
import type {BlogPost} from '../content/posts/types';
import {type Contribution, contributions, prUrl} from './contributions';
import {deliveredTalk} from './content/load';
import {SITE} from './site';

export const SCHEMA_CONTEXT = 'https://schema.org' as const;
export const OTEL_JAVA_REPO_URL =
  'https://github.com/open-telemetry/opentelemetry-java' as const;

export const ENTITY_IDS = {
  person: `${SITE.url}/#person`,
  website: `${SITE.url}/#website`,
  orange: `${SITE.url}/#org-orange`,
  sofrecom: `${SITE.url}/#org-sofrecom`,
} as const;

const OG_IMAGE = {
  url: '/mohammed-figurine.png',
  width: 1024,
  height: 1536,
  alt: `${SITE.fullName} (${SITE.handle}) — Java & OpenTelemetry engineer`,
};

export type PageMetadataInput = {
  title?: string;
  description: string;
  path: `/${string}`;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  keywords?: readonly string[];
  includeIdentityKeywords?: boolean;
  image?: {url: string; width: number; height: number; alt: string};
};

export function buildPageMetadata(input: PageMetadataInput): Metadata {
  const {
    title,
    description,
    path,
    type = 'website',
    publishedTime,
    keywords = [],
    includeIdentityKeywords = false,
    image = OG_IMAGE,
  } = input;

  const fullTitle = title
    ? `${title} | ${SITE.name}`
    : `${SITE.name} (${SITE.handle}) | Java & OpenTelemetry`;
  const canonicalUrl = path === '/' ? SITE.url : `${SITE.url}${path}`;

  const mergedKeywords = Array.from(
    new Set([
      ...SITE.knowsAbout,
      ...(includeIdentityKeywords
        ? [...SITE.alternateNames, 'Orange Maroc', 'Sofrecom', 'Rabat', 'Devoxx Morocco']
        : [SITE.name, SITE.fullName, 'Mohammed Abdessattar Elyagoubi', SITE.handle]),
      ...keywords,
    ]),
  );

  const baseOg = {
    url: canonicalUrl,
    title: fullTitle,
    description,
    siteName: `${SITE.name} (${SITE.handle})`,
    locale: 'en_US',
    images: [image],
  };

  const openGraph: NonNullable<Metadata['openGraph']> =
    type === 'article'
      ? {
          ...baseOg,
          type: 'article',
          authors: [SITE.fullName],
          ...(publishedTime !== undefined
            ? {publishedTime: `${publishedTime}T00:00:00Z`}
            : {}),
        }
      : {
          ...baseOg,
          type,
        };

  return {
    ...(title !== undefined ? {title} : {}),
    description,
    keywords: mergedKeywords,
    authors: [{name: SITE.fullName, url: SITE.url}],
    creator: SITE.fullName,
    publisher: SITE.fullName,
    alternates: {
      canonical: path,
      types: {
        'application/rss+xml': SITE.rss,
      },
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title: fullTitle,
      description,
      creator: `@${SITE.handle}`,
      images: [image.url],
    },
    robots: {
      index: true,
      follow: true,
      googleBot: {
        index: true,
        follow: true,
        'max-snippet': -1,
        'max-image-preview': 'large',
        'max-video-preview': -1,
      },
    },
  };
}

export function buildSiteGraphJsonLd() {
  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'Person',
        '@id': ENTITY_IDS.person,
        name: SITE.fullName,
        givenName: 'Mohammed',
        additionalName: 'Abdessetar',
        familyName: 'Elyagoubi',
        alternateName: SITE.alternateNames,
        identifier: SITE.handle,
        url: SITE.url,
        image: `${SITE.url}/mohammed-figurine.png`,
        jobTitle: SITE.jobTitle,
        description: SITE.bio,
        homeLocation: {
          '@type': 'Place',
          name: SITE.location,
          address: {
            '@type': 'PostalAddress',
            addressLocality: 'Rabat',
            addressCountry: 'MA',
          },
        },
        worksFor: [{'@id': ENTITY_IDS.sofrecom}, {'@id': ENTITY_IDS.orange}],
        knowsAbout: SITE.knowsAbout,
        sameAs: [SITE.github, SITE.linkedin],
      },
      {
        '@type': 'WebSite',
        '@id': ENTITY_IDS.website,
        url: SITE.url,
        name: `${SITE.name} — Java & OpenTelemetry Casebook`,
        alternateName: [
          SITE.fullName,
          'Mohammed Abdessattar Elyagoubi',
          'Mohamed Elyagoubi',
          'Mohammed El Yagoubi',
          SITE.handle,
        ],
        description: SITE.bio,
        inLanguage: 'en',
        author: {'@id': ENTITY_IDS.person},
        publisher: {'@id': ENTITY_IDS.person},
      },
      {
        '@type': 'Organization',
        '@id': ENTITY_IDS.orange,
        name: 'Orange',
        url: 'https://www.orange.com',
      },
      {
        '@type': 'Organization',
        '@id': ENTITY_IDS.sofrecom,
        name: 'Sofrecom',
        url: 'https://www.sofrecom.com',
        parentOrganization: {'@id': ENTITY_IDS.orange},
      },
    ],
  };
}

export function buildProfilePageJsonLd(path: '/' | '/about' = '/') {
  const pageUrl = path === '/' ? SITE.url : `${SITE.url}${path}`;
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'ProfilePage',
    '@id': `${pageUrl}#profilepage`,
    url: pageUrl,
    name:
      path === '/'
        ? `${SITE.fullName} (${SITE.handle}) — Java & OpenTelemetry`
        : `About ${SITE.fullName} (${SITE.handle})`,
    description: SITE.bio,
    inLanguage: 'en',
    isPartOf: {'@id': ENTITY_IDS.website},
    mainEntity: {'@id': ENTITY_IDS.person},
    about: {'@id': ENTITY_IDS.person},
  };
}

export function buildBlogPostJsonLd(post: BlogPost) {
  const postUrl = `${SITE.url}/blog/${post.slug}`;
  const linkedContribution = contributions.find(
    (c) => c.noteSlug === post.slug || c.slug === post.slug,
  );

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': post.template === 'til' || post.template === 'talk-notes' ? 'BlogPosting' : 'TechArticle',
    '@id': `${postUrl}#article`,
    url: postUrl,
    mainEntityOfPage: postUrl,
    headline: post.title,
    name: post.title,
    description: post.description,
    datePublished: `${post.publishedAt}T00:00:00Z`,
    dateModified: `${post.updatedAt}T00:00:00Z`,
    inLanguage: 'en',
    author: {'@id': ENTITY_IDS.person},
    publisher: {'@id': ENTITY_IDS.person},
    isPartOf: {'@id': ENTITY_IDS.website},
    keywords: [
      ...post.topics,
      'OpenTelemetry Java',
      'Java',
      SITE.fullName,
      SITE.handle,
    ],
    about: [
      {
        '@type': 'SoftwareSourceCode',
        name: 'OpenTelemetry Java SDK',
        codeRepository: OTEL_JAVA_REPO_URL,
        programmingLanguage: 'Java',
      },
      ...(linkedContribution
        ? [
            {
              '@type': 'SoftwareSourceCode',
              name: `OpenTelemetry Java PR #${linkedContribution.number}: ${linkedContribution.shortTitle}`,
              url: prUrl(linkedContribution.number),
              codeRepository: OTEL_JAVA_REPO_URL,
              programmingLanguage: 'Java',
              author: {'@id': ENTITY_IDS.person},
            },
          ]
        : []),
    ],
  };
}

export function buildContributionJsonLd(contribution: Contribution) {
  const caseUrl = `${SITE.url}/work/${contribution.slug}`;
  const pullRequestUrl = prUrl(contribution.number);
  const topics = contribution.topic.split('·').map((t) => t.trim());

  return {
    '@context': SCHEMA_CONTEXT,
    '@graph': [
      {
        '@type': 'TechArticle',
        '@id': `${caseUrl}#article`,
        url: caseUrl,
        mainEntityOfPage: caseUrl,
        headline: `${contribution.title} (OpenTelemetry Java PR #${contribution.number})`,
        name: contribution.title,
        description: contribution.summary,
        inLanguage: 'en',
        author: {'@id': ENTITY_IDS.person},
        publisher: {'@id': ENTITY_IDS.person},
        isPartOf: {'@id': ENTITY_IDS.website},
        keywords: [
          ...topics,
          'OpenTelemetry',
          'OpenTelemetry Java',
          `PR #${contribution.number}`,
          SITE.fullName,
          SITE.handle,
        ],
        mainEntity: {'@id': `${caseUrl}#code`},
        about: {'@id': `${caseUrl}#code`},
      },
      {
        '@type': 'SoftwareSourceCode',
        '@id': `${caseUrl}#code`,
        name: `open-telemetry/opentelemetry-java#${contribution.number} — ${contribution.shortTitle}`,
        description: `${contribution.problem} ${contribution.change}`,
        url: pullRequestUrl,
        sameAs: pullRequestUrl,
        codeRepository: OTEL_JAVA_REPO_URL,
        programmingLanguage: {
          '@type': 'ComputerLanguage',
          name: 'Java',
        },
        author: {'@id': ENTITY_IDS.person},
        creator: {'@id': ENTITY_IDS.person},
      },
    ],
  };
}

export function buildSpeakingEventJsonLd() {
  const speakingUrl = `${SITE.url}/speaking`;
  const devoxxTalk = deliveredTalk();

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'EducationEvent',
    '@id': `${speakingUrl}#devoxx-morocco-2026`,
    name: devoxxTalk.title,
    description: devoxxTalk.detail ? `${devoxxTalk.summary} ${devoxxTalk.detail}` : devoxxTalk.summary,
    url: speakingUrl,
    inLanguage: 'en',
    eventStatus: 'https://schema.org/EventScheduled',
    eventAttendanceMode: 'https://schema.org/OfflineEventAttendanceMode',
    startDate: '2026',
    location: {
      '@type': 'Place',
      name: devoxxTalk.event,
      address: {
        '@type': 'PostalAddress',
        addressLocality: 'Casablanca',
        addressCountry: 'MA',
      },
    },
    organizer: {
      '@type': 'Organization',
      name: 'Devoxx Morocco',
      url: 'https://devoxx.ma',
    },
    performer: {'@id': ENTITY_IDS.person},
  };
}

export function serializeJsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
