'use client';

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
  return (
    <div className="site-navigation">
      <nav id="primary-navigation" className="main-nav" aria-label="Main navigation">
        {links.map((link) => {
          const active = link.href === '/' ? pathname === '/' : pathname.startsWith(link.href);
          return <a key={link.href} className="nav-link" href={link.href} aria-current={active ? 'page' : undefined}>{link.label}</a>;
        })}
      </nav>
    </div>
  );
}
