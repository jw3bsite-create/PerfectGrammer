import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { Progress, plural } from '../components/ui';
import { getLesson } from '../lib/content';
import { dayKey, formatWeekday } from '../lib/dates';
import { allStatuses, weakestTypes } from '../lib/errorbook';
import { fehlertyp } from '../lib/fehlertypen';
import { dueCount } from '../lib/sessions';
import { startPlacement, startReview, startTargeted } from '../lib/start';
import { streak, todayCount } from '../lib/stats';
import { dismissNotice, useApp } from '../lib/store';
import type { AppData } from '../lib/types';

function continueTarget(data: AppData): { titel: string; text: string; href: string } | null {
  if (data.session) {
    const s = data.session;
    return {
      titel: s.titel,
      text: `Aufgabe ${Math.min(s.index + 1, s.items.length)} von ${s.items.length}. Die Sitzung ist gespeichert.`,
      href: '#/sitzung',
    };
  }
  const recent = Object.values(data.lessons)
    .filter((l) => l.zuletzt)
    .sort((a, b) => (b.zuletzt ?? 0) - (a.zuletzt ?? 0))[0];
  if (!recent) return null;
  const lesson = getLesson(recent.lektion);
  if (!lesson) return null;
  const phase = recent.phase;
  const next =
    recent.stufe === 'sicher' || recent.stufe === 'gemeistert'
      ? 'Lektionstest bestanden'
      : phase === 'test'
        ? 'Nächster Schritt: Lektionstest wiederholen'
        : phase === 'frei'
          ? 'Nächster Schritt: Lektionstest'
          : phase === 'gefuehrt'
            ? 'Nächster Schritt: freie Übung'
            : 'Nächster Schritt: geführte Übung';
  return { titel: `${lesson.id} ${lesson.titel}`, text: next, href: `#/lektion/${lesson.id}` };
}

export function Heute() {
  const data = useApp();
  const today = dayKey();
  const due = dueCount(data, today);
  const count = todayCount(data.attempts, today);
  const goal = data.settings.tagesziel;
  const st = streak(data.attempts, today);
  const statuses = useMemo(() => allStatuses(data.attempts, data.errors), [data.attempts, data.errors]);
  const weakest = useMemo(() => weakestTypes(data.attempts, data.errors, today, 3, statuses), [data.attempts, data.errors, today, statuses]);
  const cont = continueTarget(data);
  const notices = data.notices.filter((n) => !n.gelesen);
  const size = data.settings.sitzungslaenge;

  return (
    <div>
      <div className="page-head">
        <div>
          <div className="eyebrow">{formatWeekday(today)}</div>
          <h1>Heute</h1>
        </div>
        <a className="btn icon ghost mobile-only" href="#/einstellungen" aria-label="Einstellungen">
          <Icon name="einstellungen" />
        </a>
      </div>

      {notices.length ? (
        <div className="stack" style={{ marginBottom: 16 }}>
          {notices.map((n) => (
            <div key={n.id} className="notice" role="status">
              <Icon name="alert" />
              <div className="grow">
                <p>{n.text}</p>
                <div className="row" style={{ marginTop: 8 }}>
                  {n.lektion ? (
                    <a className="btn small" href={`#/lektion/${n.lektion}`}>
                      Zur Lektion
                    </a>
                  ) : null}
                  <button className="btn small ghost" onClick={() => dismissNotice(n.id)}>
                    Verstanden
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : null}

      {!data.placementDone ? (
        <div className="card accent" style={{ marginBottom: 16 }}>
          <div className="card-title">
            <h2>Einstufungstest</h2>
            <span className="badge">40 Aufgaben</span>
          </div>
          <p className="muted">Der Test misst deinen Ausgangsstand in jedem Kurs und schlägt eine Reihenfolge vor: die schwächsten Kurse zuerst. Alle Kurse bleiben frei wählbar.</p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn primary" onClick={() => startPlacement()}>
              Einstufung starten
            </button>
          </div>
        </div>
      ) : null}

      <div className="grid-2">
        <div className="card">
          <div className="card-title">
            <h2>Wiederholung</h2>
            <Icon name="repeat" className="muted" />
          </div>
          <div className="stat">
            <span className="value">{due}</span>
            <span className="label">{due === 1 ? 'Aufgabe oder Fehlertyp fällig' : 'Aufgaben und Fehlertypen fällig'}</span>
          </div>
          <p className="small muted" style={{ marginTop: 10 }}>
            {due ? 'Gemischt mit deinen schwächsten Fehlertypen und gemeisterten Lektionen.' : 'Heute ist nichts fällig. Eine Runde aus deinen schwächsten Bereichen hält den Stand.'}
          </p>
          <button className="btn primary wide" style={{ marginTop: 16 }} onClick={() => startReview()}>
            <Icon name="play" /> {plural(size, 'Aufgabe', 'Aufgaben')} starten
          </button>
        </div>

        <div className="card">
          <div className="card-title">
            <h2>Tagesziel</h2>
            <Icon name="calendar" className="muted" />
          </div>
          <div className="stat">
            <span className="value">
              {count} <span className="muted" style={{ fontSize: 18, fontWeight: 500 }}>von {goal}</span>
            </span>
            <span className="label">{count >= goal ? 'Tagesziel erreicht' : 'Aufgaben heute'}</span>
          </div>
          <div style={{ marginTop: 14 }}>
            <Progress value={goal ? count / goal : 0} label="Tagesziel" />
          </div>
          <p className="small muted" style={{ marginTop: 14 }}>
            {st.tage === 0
              ? 'Noch keine Serie. Ein Übungstag zählt ab der ersten Aufgabe.'
              : `Serie: ${plural(st.tage, 'Übungstag', 'Übungstage')} in Folge${st.heuteGeuebt ? '' : ' – heute noch offen'}.`}
          </p>
        </div>
      </div>

      {cont ? (
        <div className="section">
          <h2>Weiter, wo du warst</h2>
          <div className="list">
            <a className="list-item" href={cont.href}>
              <Icon name={data.session ? 'play' : 'kurse'} className="chev" />
              <span className="grow">
                <span className="title-line">{cont.titel}</span>
                <span className="sub-line">{cont.text}</span>
              </span>
              <Icon name="chevronRight" className="chev" />
            </a>
          </div>
        </div>
      ) : null}

      <div className="section">
        <div className="row between" style={{ marginBottom: 14 }}>
          <h2>Fehlerprofil</h2>
          <a className="small" href="#/fehlerbuch/auswertung">
            Auswertung
          </a>
        </div>
        {weakest.length ? (
          <div className="card">
            <div className="stack-sm">
              {weakest.map((w, i) => {
                const ft = fehlertyp(w.typ)!;
                const lesson = getLesson(ft.lektion);
                return (
                  <div key={w.typ} className="row between" style={{ padding: '6px 0', borderTop: i ? '1px solid var(--border)' : undefined }}>
                    <div>
                      <div className="title-line">{ft.label}</div>
                      <div className="sub-line">
                        {w.falsch + w.arbeit} Fehler in 30 Tagen
                        {w.arbeit ? ` · davon ${w.arbeit} aus Arbeiten` : ''}
                        {lesson ? ` · Lektion ${lesson.id}` : ''}
                      </div>
                    </div>
                    <button className="btn small" onClick={() => startTargeted([w.typ])}>
                      Üben
                    </button>
                  </div>
                );
              })}
            </div>
            <button className="btn primary wide" style={{ marginTop: 16 }} onClick={() => startTargeted(weakest.map((w) => w.typ))}>
              <Icon name="target" /> Jetzt gezielt üben
            </button>
          </div>
        ) : (
          <div className="card flat">
            <p className="muted">Noch kein Fehlerprofil. Sobald du Fehler machst oder Fehler aus Klausuren einträgst, stehen hier deine drei schwächsten Fehlertypen.</p>
          </div>
        )}
      </div>

      <div className="section">
        <h2>Schnellstart</h2>
        <div className="grid-2">
          <a className="card" href="#/kurse" style={{ color: 'inherit' }}>
            <div className="row">
              <Icon name="kurse" />
              <div className="grow">
                <div className="title-line">Kurse</div>
                <div className="sub-line">Zehn Kurse, je eine Probe</div>
              </div>
            </div>
          </a>
          <a className="card" href="#/fehlerbuch/neu" style={{ color: 'inherit' }}>
            <div className="row">
              <Icon name="plus" />
              <div className="grow">
                <div className="title-line">Klausurfehler eintragen</div>
                <div className="sub-line">In unter 20 Sekunden erfasst</div>
              </div>
            </div>
          </a>
          <a className="card" href="#/zusammenfassen" style={{ color: 'inherit' }} data-link="zusammenfassen">
            <div className="row">
              <Icon name="text" />
              <div className="grow">
                <div className="title-line">Zusammenfassen</div>
                <div className="sub-line">Strukturierte Textwiedergabe an vielen kurzen Texten</div>
              </div>
            </div>
          </a>
          <a className="card" href="#/schwaechen" target="sr-schwaechen" style={{ color: 'inherit' }} data-link="schwaechen">
            <div className="row">
              <Icon name="target" />
              <div className="grow">
                <div className="title-line">Meine Schwächen ↗</div>
                <div className="sub-line">Eigene Fehler trainieren, bis sie sitzen · eigenes Fenster</div>
              </div>
            </div>
          </a>
        </div>
      </div>
    </div>
  );
}
