import type {Metadata} from 'next';
import SiteNavigation from '../components/site-navigation';
import ThemeToggle from '../components/theme-toggle';
import {buildPageMetadata, buildSiteGraphJsonLd, serializeJsonLd} from '../lib/seo';
import {SITE} from '../lib/site';
import './globals.css';

export const metadata: Metadata = {
  metadataBase: new URL(SITE.url),
  ...buildPageMetadata({
    description: SITE.bio,
    path: '/',
    includeIdentityKeywords: true,
  }),
  title: {
    default: `${SITE.name} (${SITE.handle}) | Java & OpenTelemetry`,
    template: `%s | ${SITE.name}`,
  },
  icons: {icon: '/favicon.svg'},
};

const themeScript = `(() => { const saved = localStorage.getItem('theme'); const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = saved || preferred; })();`;

export default function Layout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{__html: serializeJsonLd(buildSiteGraphJsonLd())}}
        />
        <link rel="alternate" type="application/rss+xml" title={`${SITE.name} RSS Feed`} href={SITE.rss} />
        <link rel="alternate" type="text/plain" title="LLMs.txt Index" href={SITE.llms} />
        <link rel="alternate" type="text/plain" title="LLMs-full.txt Complete Corpus" href={SITE.llmsFull} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <div className="shell">
          <header className="site-header">
            <a className="wordmark" href="/" aria-label={`${SITE.fullName} home`}>{SITE.handle}</a>
            <div className="header-right">
              <SiteNavigation />
              <ThemeToggle />
            </div>
          </header>
          <main id="main">{children}</main>
          <footer>
            <div>
              <a className="footer-name" href="/">{SITE.fullName}</a>
              <p>{SITE.role}</p>
            </div>
            <div className="footer-links">
              <a href={SITE.github} rel="me">GitHub</a>
              <a href={SITE.linkedin} rel="me">LinkedIn</a>
              <a href={SITE.rss}>RSS</a>
              <a href={SITE.llms}>llms.txt</a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
