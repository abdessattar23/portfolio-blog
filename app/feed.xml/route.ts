import {SITE} from '../../lib/site';
import {livePublishedPosts, liveSiteSettings} from '../../lib/studio/published';

const XML_ENTITIES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (char) => XML_ENTITIES[char] ?? char);

export async function GET() {
  const [site, publishedPosts] = await Promise.all([liveSiteSettings(), livePublishedPosts()]);
  const feedUrl = `${SITE.url}${SITE.rss}`;

  const items = publishedPosts
    .map((post) => {
      const url = `${SITE.url}/blog/${post.slug}`;
      const pubDate = new Date(`${post.publishedAt}T00:00:00Z`).toUTCString();
      const categories = post.topics
        .map((topic) => `<category>${escapeXml(topic)}</category>`)
        .join('');

      return [
        '<item>',
        `<title>${escapeXml(post.title)}</title>`,
        `<link>${url}</link>`,
        `<guid isPermaLink="true">${url}</guid>`,
        `<pubDate>${pubDate}</pubDate>`,
        `<dc:creator>${escapeXml(site.fullName)}</dc:creator>`,
        categories,
        `<description>${escapeXml(post.excerpt)}</description>`,
        '</item>',
      ].join('');
    })
    .join('');

  const xml = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">',
    '<channel>',
    `<title>${escapeXml(site.websiteName)}: technical notes</title>`,
    `<link>${SITE.url}/blog</link>`,
    `<atom:link href="${feedUrl}" rel="self" type="application/rss+xml" />`,
    `<description>${escapeXml(`Observability, Java, the JVM, open source, and AI. Notes by ${site.fullName} (${site.handle}).`)}</description>`,
    '<language>en</language>',
    `<dc:creator>${escapeXml(site.fullName)}</dc:creator>`,
    items,
    '</channel>',
    '</rss>',
  ].join('');

  return new Response(xml, {
    headers: {'Content-Type': 'application/rss+xml; charset=utf-8'},
  });
}
