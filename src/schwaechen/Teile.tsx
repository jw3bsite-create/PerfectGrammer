// Kleine Bausteine des Moduls „Meine Schwächen“.

import { Icon } from '../components/Icon';
import { getLesson } from '../lib/content';
import { ampel, type Ampel } from './logik';
import type { SKatStand } from './typen';

export const AMPEL_TEXT: Record<Ampel, string> = {
  rot: 'Rot · übt noch',
  gelb: 'Gelb · in Prüfung',
  gruen: 'Grün · gemeistert',
};

/** Ampel mit Farbe und Wort, damit sie nicht nur über die Farbe lesbar ist. */
export function AmpelBadge({ stand }: { stand: SKatStand }) {
  const a = ampel(stand);
  return (
    <span className={`ampel ${a}`} data-ampel={a}>
      {AMPEL_TEXT[a]}
    </span>
  );
}

/** Fenstername der Haupt-App: Verweise in die Kurse öffnen dort, nicht im Schwächen-Fenster. */
export const HAUPTFENSTER = 'sr-haupt';
export const SCHWAECHENFENSTER = 'sr-schwaechen';

/** Verweise auf Lektionen der Kurse; sie öffnen im Hauptfenster der App. */
export function KursLinks({ ids, titel, kompakt }: { ids: string[]; titel: string; kompakt?: boolean }) {
  const lessons = ids.map((id) => getLesson(id)).filter((l): l is NonNullable<typeof l> => !!l);
  if (!lessons.length) return null;
  if (kompakt) {
    return (
      <div>
        <div className="fb-label">{titel}</div>
        <div className="row wrap" style={{ gap: '6px 16px' }}>
          {lessons.map((l) => (
            <a key={l.id} className="small sw-kurslink" href={`#/lektion/${l.id}`} target={HAUPTFENSTER} data-lektion={l.id}>
              <Icon name="kurse" />
              {l.id} {l.titel}
              <span className="sr-only"> (öffnet im Hauptfenster)</span>
            </a>
          ))}
        </div>
      </div>
    );
  }
  return (
    <div className="list">
      {lessons.map((l) => (
        <a key={l.id} className="list-item" href={`#/lektion/${l.id}`} target={HAUPTFENSTER} data-lektion={l.id}>
          <span className="nr">{l.id}</span>
          <span className="grow">
            <span className="title-line">{l.titel}</span>
            <span className="sub-line">Lektion im Kurs · öffnet im Hauptfenster</span>
          </span>
          <Icon name="arrowRight" className="chev" />
        </a>
      ))}
    </div>
  );
}
