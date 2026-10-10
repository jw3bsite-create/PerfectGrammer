// Hash-Routen: funktionieren offline und unter jedem Pfad.

import { useEffect, useSyncExternalStore } from 'react';

function subscribe(cb: () => void) {
  window.addEventListener('hashchange', cb);
  return () => window.removeEventListener('hashchange', cb);
}

function getHash() {
  return window.location.hash || '#/';
}

export interface Route {
  parts: string[];
  query: URLSearchParams;
  raw: string;
}

export function parseHash(hash: string): Route {
  const h = hash.replace(/^#/, '') || '/';
  const [path, q = ''] = h.split('?');
  return { parts: path.split('/').filter(Boolean).map(decodeURIComponent), query: new URLSearchParams(q), raw: h };
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, getHash, () => '#/');
  return parseHash(hash);
}

export function navigate(to: string, replace = false) {
  const target = to.startsWith('#') ? to : `#${to}`;
  if (replace) {
    window.history.replaceState(null, '', target);
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  } else {
    window.location.hash = target;
  }
}

export function href(to: string): string {
  return to.startsWith('#') ? to : `#${to}`;
}

export function useScrollTop(key: string) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [key]);
}
