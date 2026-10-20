import type {Metadata} from 'next';
import SiteNavigation from '../components/site-navigation';
import ThemeToggle from '../components/theme-toggle';
import {SITE} from '../lib/site';
import './globals.css';

export const metadata: Metadata = {
  title: {default: `${SITE.name} | Java & OpenTelemetry`, template: `%s | ${SITE.name}`},
  description: 'Java backend engineer at Orange/Sofrecom. OpenTelemetry Java contributions, technical notes, and speaking.',
  icons: {icon: '/favicon.svg'},
};

const themeScript = `(() => { const saved = localStorage.getItem('theme'); const preferred = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'; document.documentElement.dataset.theme = saved || preferred; })();`;

export default function Layout({children}: Readonly<{children: React.ReactNode}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: themeScript}} />
      </head>
      <body>
        <a className="skip" href="#main">Skip to content</a>
        <div className="shell">
          <header className="site-header">
            <a className="wordmark" href="/" aria-label={`${SITE.name} home`}>{SITE.handle}</a>
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
              <a href={SITE.github}>GitHub</a>
              <a href={SITE.linkedin}>LinkedIn</a>
              <a href={SITE.rss}>RSS</a>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
