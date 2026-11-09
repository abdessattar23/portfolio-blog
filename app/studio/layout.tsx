import type {Metadata} from 'next';
import {requireOwner} from '../../lib/studio/auth';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Studio',
  robots: {index: false, follow: false},
};

export default async function StudioLayout({children}: Readonly<{children: React.ReactNode}>) {
  const session = await requireOwner();
  return (
    <div className="studio">
      <nav className="studio-nav" aria-label="Studio">
        <a href="/studio">Dashboard</a>
        <a href="/studio/settings">Settings</a>
        <a href="/">View site</a>
        <a href="/api/auth/logout">Sign out</a>
        <span>{session.login}</span>
      </nav>
      {children}
    </div>
  );
}
