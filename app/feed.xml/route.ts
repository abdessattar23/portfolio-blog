import {publishedPosts} from '../../content/posts';
import {SITE} from '../../lib/site';

const XML_ENTITIES: Record<string, string> = {
  '<': '&lt;',
  '>': '&gt;',
  '&': '&amp;',
  '"': '&quot;',
  "'": '&apos;',
};

const escapeXml = (value: string) =>
  value.replace(/[<>&"']/g, (char) => XML_ENTITIES[char] ?? char);

export function GET() {
  const items = publishedPosts
    .map((post) => {
      const url = `${SITE.url}/blog/${post.slug}`;
      const pubDate = new Date(`${post.publishedAt}T00:00:00Z`).toUTCString();
      return `<item><title>${escapeXml(post.title)}</title><link>${url}</link><guid>${url}</guid><pubDate>${pubDate}</pubDate><description>${escapeXml(post.excerpt)}</description></item>`;
    })
    .join('');

  const xml = `<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>${escapeXml(SITE.name)}: technical notes</title><link>${SITE.url}/blog</link><description>Java, observability, and open-source engineering.</description><language>en</language>${items}</channel></rss>`;

  return new Response(xml, {
    headers: {'Content-Type': 'application/rss+xml; charset=utf-8'},
  });
}
