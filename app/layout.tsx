import type {Metadata} from 'next';
import SiteNavigation from '../components/site-navigation';
import ThemeToggle from '../components/theme-toggle';
import {buildPageMetadata, buildSiteGraphJsonLd, serializeJsonLd} from '../lib/seo';
import {liveSiteSettings} from '../lib/studio/published';
import {SITE} from '../lib/site';
import './globals.css';

export async function generateMetadata(): Promise<Metadata> {
  const site = await liveSiteSettings();
  return {
    metadataBase: new URL(site.url),
    ...buildPageMetadata({
      description: site.bio,
      path: '/',
      includeIdentityKeywords: true,
    }),
    title: {
      default: `${site.name} (${site.handle}) | Java & OpenTelemetry`,
      template: `%s | ${site.name}`,
    },
    icons: {icon: site.favicon},
  };
}

const themeScript = `(() => { const saved = localStorage.getItem('theme'); const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = saved || preferred; })();`;

export default async function Layout({children}: Readonly<{children: React.ReactNode}>) {
  const site = await liveSiteSettings();
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: serializeJsonLd(buildSiteGraphJsonLd(site))}}
        />
        <link rel="icon" href={site.favicon} />
        <link rel="alternate" type="application/rss+xml" title={`${site.name} RSS Feed`} href={SITE.rss} />
        <link rel="alternate" type="text/plain" title="LLMs.txt Index" href={SITE.llms} />
        <link rel="alternate" type="text/plain" title="LLMs-full.txt Complete Corpus" href={SITE.llmsFull} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <div className="shell">
          <header className="site-header">
            <a className="wordmark" href="/" aria-label={`${site.fullName} home`}>{site.handle}</a>
            <div className="header-right">
              <SiteNavigation />
              <ThemeToggle />
            </div>
          </header>
          <main id="main">{children}</main>
          <footer>
            <div>
              <a className="footer-name" href="/">{site.fullName}</a>
              <p>{site.role}</p>
            </div>
            <div className="footer-links">
              <a href={site.github} rel="me">GitHub</a>
              <a href={site.linkedin} rel="me">LinkedIn</a>
              <a href={SITE.rss}>RSS</a>
              <a href={SITE.llms}>llms.txt</a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
