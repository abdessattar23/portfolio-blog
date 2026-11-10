import type {Metadata} from 'next';
import type {BlogPost} from '../content/posts/types';
import {type Contribution, contributions, prUrl} from './contributions';
import {deliveredTalk} from './content/load';
import {postSearchTitle, type SiteSettings} from './content/schema';
import {bareDocumentTitle, homeDocumentTitle, withSiteTitle} from './search-appearance';
import {buildIdentityGraph} from './site-graph';
import {SITE} from './site';

export {homeDocumentTitle, siteIcons} from './search-appearance';

export const SCHEMA_CONTEXT = 'https://schema.org' as const;
export const OTEL_JAVA_REPO_URL =
  'https://github.com/open-telemetry/opentelemetry-java' as const;

export const ENTITY_IDS = {
  person: `${SITE.url}/#person`,
  website: `${SITE.url}/#website`,
  orange: `${SITE.url}/#org-orange`,
  sofrecom: `${SITE.url}/#org-sofrecom`,
} as const;

export type PageMetadataInput = {
  title?: string;
  description: string;
  path: `/${string}`;
  type?: 'website' | 'article' | 'profile';
  publishedTime?: string;
  keywords?: readonly string[];
  includeIdentityKeywords?: boolean;
  image?: {url: string; width: number; height: number; alt: string};
  site?: SiteSettings;
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
    site = SITE,
  } = input;
  const image = input.image ?? {
    url: '/mohammed-figurine.png',
    width: 1024,
    height: 1536,
    alt: `${site.fullName} (${site.handle}) — observability, Java, and the JVM`,
  };
  const bareTitle = title === undefined ? undefined : bareDocumentTitle(title, site);
  const documentTitle = bareTitle === undefined ? homeDocumentTitle(site) : withSiteTitle(bareTitle, site);
  const canonicalUrl = path === '/' ? site.url : `${site.url}${path}`;

  const mergedKeywords = Array.from(
    new Set([
      ...site.knowsAbout,
      ...(includeIdentityKeywords
        ? [...site.alternateNames, 'Orange Maroc', 'Sofrecom', 'Rabat', 'Devoxx Morocco']
        : [site.name, site.fullName, 'Mohammed Abdessattar Elyagoubi', site.handle]),
      ...keywords,
    ]),
  );

  const baseOg = {
    url: canonicalUrl,
    title: documentTitle,
    description,
    siteName: site.websiteName,
    locale: 'en_US',
    images: [image],
  };

  const openGraph: NonNullable<Metadata['openGraph']> =
    type === 'article'
      ? {
          ...baseOg,
          type: 'article',
          authors: [site.fullName],
          ...(publishedTime !== undefined
            ? {publishedTime: `${publishedTime}T00:00:00Z`}
            : {}),
        }
      : {
          ...baseOg,
          type,
        };

  return {
    ...(bareTitle !== undefined ? {title: bareTitle} : {}),
    description,
    keywords: mergedKeywords,
    authors: [{name: site.fullName, url: site.url}],
    creator: site.fullName,
    publisher: site.fullName,
    alternates: {
      canonical: path,
      types: {
        'application/rss+xml': SITE.rss,
      },
    },
    openGraph,
    twitter: {
      card: 'summary_large_image',
      title: documentTitle,
      description,
      creator: `@${site.handle}`,
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

export function buildSiteGraphJsonLd(site: SiteSettings = SITE) {
  return buildIdentityGraph(site);
}

export function buildProfilePageJsonLd(path: '/' | '/about' = '/', site: SiteSettings = SITE) {
  const pageUrl = path === '/' ? site.url : `${site.url}${path}`;
  const person = `${site.url}/#person`;
  const website = `${site.url}/#website`;
  return {
    '@context': SCHEMA_CONTEXT,
    '@type': 'ProfilePage',
    '@id': `${pageUrl}#profilepage`,
    url: pageUrl,
    name: path === '/' ? homeDocumentTitle(site) : `About ${site.fullName}`,
    description: site.bio,
    inLanguage: 'en',
    isPartOf: {'@id': website},
    mainEntity: {'@id': person},
    about: {'@id': person},
  };
}

export function buildBlogPostJsonLd(post: BlogPost, site: SiteSettings = SITE) {
  const postUrl = `${site.url}/blog/${post.slug}`;
  const person = `${site.url}/#person`;
  const website = `${site.url}/#website`;
  const headline = postSearchTitle(post);
  const linkedContribution = contributions.find(
    (c) => c.noteSlug === post.slug || c.slug === post.slug,
  );

  return {
    '@context': SCHEMA_CONTEXT,
    '@type': post.template === 'til' || post.template === 'talk-notes' ? 'BlogPosting' : 'TechArticle',
    '@id': `${postUrl}#article`,
    url: postUrl,
    mainEntityOfPage: postUrl,
    headline,
    name: headline,
    description: post.description,
    datePublished: `${post.publishedAt}T00:00:00Z`,
    dateModified: `${post.updatedAt}T00:00:00Z`,
    inLanguage: 'en',
    author: {'@id': person},
    publisher: {'@id': person},
    isPartOf: {'@id': website},
    keywords: [
      ...post.topics,
      'OpenTelemetry Java',
      'Java',
      site.fullName,
      site.handle,
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
              author: {'@id': person},
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
