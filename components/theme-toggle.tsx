'use client';

import {useSyncExternalStore} from 'react';

type Theme = 'light' | 'dark';

function subscribe(onStoreChange: () => void) {
  window.addEventListener('theme-change', onStoreChange);
  return () => window.removeEventListener('theme-change', onStoreChange);
}

function currentTheme(): Theme {
  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

function serverTheme(): Theme {
  return 'light';
}

export default function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, currentTheme, serverTheme);

  function toggleTheme() {
    const next: Theme = theme === 'light' ? 'dark' : 'light';
    document.documentElement.dataset.theme = next;
    localStorage.setItem('theme', next);
    window.dispatchEvent(new Event('theme-change'));
  }

  return (
    <button className="theme-toggle" type="button" aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} theme`} onClick={toggleTheme}>
      <span aria-hidden="true">{theme === 'light' ? '☼' : '◐'}</span>
    </button>
  );
}
