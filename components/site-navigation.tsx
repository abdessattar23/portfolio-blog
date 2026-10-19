'use client';

import {useEffect, useState} from 'react';
import {usePathname} from 'next/navigation';

const links = [
  {href: '/', label: 'Home'},
  {href: '/blog', label: 'Blog'},
  {href: '/work', label: 'Open source'},
  {href: '/speaking', label: 'Talks'},
  {href: '/about', label: 'About'},
];

export default function SiteNavigation() {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false);
    }

    window.addEventListener('keydown', closeOnEscape);
    return () => window.removeEventListener('keydown', closeOnEscape);
  }, []);

  return (
    <div className="site-navigation">
      <button
        className="menu-toggle"
        type="button"
        aria-expanded={open}
        aria-controls="primary-navigation"
        aria-label={open ? 'Close navigation' : 'Open navigation'}
        onClick={() => setOpen((current) => !current)}
      >
        <span aria-hidden="true" />
        <span aria-hidden="true" />
        <span aria-hidden="true" />
      </button>
      <nav id="primary-navigation" className="main-nav" data-open={open} aria-label="Main navigation">
        {links.map((link) => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return <a key={link.href} className="nav-link" href={link.href} aria-current={active ? 'page' : undefined}>{link.label}</a>;
        })}
      </nav>
    </div>
  );
}
