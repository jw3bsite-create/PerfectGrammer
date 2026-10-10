// Schlichte Liniensymbole (24 × 24, Strichstärke 1.75).

import type { ReactElement } from 'react';

const P: Record<string, ReactElement> = {
  heute: <><path d="M4 11.5 12 5l8 6.5" /><path d="M6 10v9h12v-9" /><path d="M10 19v-5h4v5" /></>,
  kurse: <><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H10a2 2 0 0 1 2 2v14a1.5 1.5 0 0 0-1.5-1.5H4z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H14a2 2 0 0 0-2 2v14a1.5 1.5 0 0 1 1.5-1.5H20z" /></>,
  ueben: <><path d="M15.5 4.5 19.5 8.5 9 19H5v-4z" /><path d="M13.5 6.5l4 4" /></>,
  fehlerbuch: <><path d="M6 3.5h11A1.5 1.5 0 0 1 18.5 5v15.5H7a2 2 0 0 1-2-2v-13a2 2 0 0 1 1-1.5z" /><path d="M5 18.5a2 2 0 0 1 2-2h11.5" /><path d="M9 8h6M9 11.5h4" /></>,
  statistik: <><path d="M4 20h16" /><path d="M7 16v-5M12 16V7M17 16v-8" /></>,
  einstellungen: <><circle cx="12" cy="12" r="3" /><path d="M12 3v2.2M12 18.8V21M4.2 7.5l1.9 1.1M17.9 15.4l1.9 1.1M4.2 16.5l1.9-1.1M17.9 8.6l1.9-1.1" /><circle cx="12" cy="12" r="7" /></>,
  check: <path d="M5 12.5 10 17.5 19 7" />,
  checkCircle: <><circle cx="12" cy="12" r="9" /><path d="M8 12.5l2.8 2.8L16.5 9.5" /></>,
  cross: <path d="M6 6l12 12M18 6 6 18" />,
  crossCircle: <><circle cx="12" cy="12" r="9" /><path d="M9 9l6 6M15 9l-6 6" /></>,
  minusCircle: <><circle cx="12" cy="12" r="9" /><path d="M8.5 12h7" /></>,
  chevronRight: <path d="M9.5 6l6 6-6 6" />,
  chevronLeft: <path d="M14.5 6l-6 6 6 6" />,
  chevronDown: <path d="M6 9.5l6 6 6-6" />,
  speaker: <><path d="M4 9.5v5h3.5L12 18.5v-13L7.5 9.5z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  plus: <path d="M12 5v14M5 12h14" />,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4 4" /></>,
  download: <><path d="M12 4v11M7.5 10.5 12 15l4.5-4.5" /><path d="M5 19.5h14" /></>,
  upload: <><path d="M12 15V4M7.5 8.5 12 4l4.5 4.5" /><path d="M5 19.5h14" /></>,
  print: <><path d="M7 9V4h10v5" /><rect x="4" y="9" width="16" height="7" rx="1.5" /><path d="M7 14h10v6H7z" /></>,
  timer: <><circle cx="12" cy="13" r="7.5" /><path d="M12 9v4l2.5 2M10 3h4" /></>,
  info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v5.5M12 7.8v.2" /></>,
  alert: <><path d="M12 4 21 19.5H3z" /><path d="M12 10v4.5M12 17v.2" /></>,
  card: <><rect x="4" y="5" width="16" height="14" rx="2" /><path d="M8 10h8M8 14h5" /></>,
  calendar: <><rect x="4" y="5.5" width="16" height="14.5" rx="2" /><path d="M4 10h16M8.5 3.5v4M15.5 3.5v4" /></>,
  trash: <><path d="M5 7h14M10 7V5h4v2M7 7l1 13h8l1-13" /></>,
  edit: <><path d="M15.5 4.5 19.5 8.5 9 19H5v-4z" /></>,
  close: <path d="M6 6l12 12M18 6 6 18" />,
  arrowRight: <><path d="M5 12h14M13 6l6 6-6 6" /></>,
  play: <path d="M8 5.5v13l10.5-6.5z" />,
  target: <><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r=".5" /></>,
  shuffle: <><path d="M4 7h3.5c4.5 0 5.5 10 10 10H20M4 17h3.5c1.5 0 2.6-1.1 3.4-2.6M20 7h-2.5c-1.6 0-2.7 1-3.5 2.5" /><path d="M17.5 4.5 20 7l-2.5 2.5M17.5 14.5 20 17l-2.5 2.5" /></>,
  repeat: <><path d="M4.5 12a7.5 7.5 0 0 1 13-5.1L19.5 9" /><path d="M19.5 4.5V9H15" /><path d="M19.5 12a7.5 7.5 0 0 1-13 5.1L4.5 15" /><path d="M4.5 19.5V15H9" /></>,
  text: <><path d="M5 6h14M5 10h14M5 14h14M5 18h9" /></>,
  list: <><path d="M9 6h11M9 12h11M9 18h11" /><circle cx="5" cy="6" r=".8" /><circle cx="5" cy="12" r=".8" /><circle cx="5" cy="18" r=".8" /></>,
  flag: <><path d="M6 21V4.5" /><path d="M6 5h11l-2 4 2 4H6" /></>,
  dot: <circle cx="12" cy="12" r="3" />,
  key: <><rect x="3.5" y="7" width="17" height="10" rx="2" /><path d="M7 10.5h.01M10 10.5h.01M13 10.5h.01M16 10.5h.01M8 14h8" /></>,
};

export function Icon({ name, title, className }: { name: keyof typeof P | string; title?: string; className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      className={className}
    >
      {title ? <title>{title}</title> : null}
      {P[name] ?? P.dot}
    </svg>
  );
}
