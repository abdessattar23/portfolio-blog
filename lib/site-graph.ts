import {slugifyHeading, type SiteOrganization, type SiteSettings} from './content/schema';

export function absoluteSiteUrl(siteUrl: string, path: string): string {
  if (path.startsWith('https://')) return path;
  return `${siteUrl}${path.startsWith('/') ? path : `/${path}`}`;
}

export function organizationId(siteUrl: string, name: string): string {
  return `${siteUrl}/#org-${slugifyHeading(name)}`;
}

export function buildIdentityGraph(site: SiteSettings) {
  const person = `${site.url}/#person`;
  const website = `${site.url}/#website`;
  const sameAs = [...new Set([site.github, site.linkedin, ...site.sameAs])];
  const organizations = site.organizations.map((org) => organizationNode(site.url, org, site.organizations));
  const parentNames = new Set(site.organizations.flatMap((org) => (org.parent ? [org.parent] : [])));
  const employers = organizations.filter((org) => !parentNames.has(String(org['name'])));

  return {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Person',
        '@id': person,
        name: site.fullName,
        givenName: site.givenName,
        ...(site.additionalName ? {additionalName: site.additionalName} : {}),
        familyName: site.familyName,
        alternateName: site.alternateNames,
        identifier: site.handle,
        url: site.url,
        image: absoluteSiteUrl(site.url, site.image),
        jobTitle: site.jobTitle,
        description: site.bio,
        homeLocation: {
          '@type': 'Place',
          name: site.location,
          address: {
            '@type': 'PostalAddress',
            addressLocality: site.addressLocality,
            addressCountry: site.addressCountry,
          },
        },
        ...(employers.length > 0 ? {worksFor: employers.map((org) => ({'@id': org['@id']}))} : {}),
        knowsAbout: site.knowsAbout,
        sameAs,
      },
      {
        '@type': 'WebSite',
        '@id': website,
        url: site.url,
        name: site.websiteName,
        alternateName: [...new Set([site.fullName, site.handle, ...site.alternateNames])],
        description: site.bio,
        inLanguage: 'en',
        author: {'@id': person},
        publisher: {'@id': person},
      },
      ...organizations,
    ],
  };
}

function organizationNode(siteUrl: string, org: SiteOrganization, all: SiteOrganization[]) {
  const parent = org.parent ? all.find((item) => item.name === org.parent) : undefined;
  return {
    '@type': 'Organization',
    '@id': organizationId(siteUrl, org.name),
    name: org.name,
    ...(org.url ? {url: org.url} : {}),
    ...(parent ? {parentOrganization: {'@id': organizationId(siteUrl, parent.name)}} : {}),
  };
}
