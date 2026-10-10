import { useMemo, useState } from 'react';
import { LineChart, type Point } from '../components/Charts';
import { Empty, LevelBadge, plural } from '../components/ui';
import { BANK } from '../lib/content';
import { addDays, dayKey, formatDay, monthName, parseDay } from '../lib/dates';
import { frequentTypes } from '../lib/errorbook';
import { fehlertyp } from '../lib/fehlertypen';
import { navigate } from '../lib/router';
import { practiceDays, rateBy, streak, weekly } from '../lib/stats';
import { useApp } from '../lib/store';

function pctText(v: number): string {
  return `${Math.round(v)} %`;
}

export function Statistik() {
  const data = useApp();
  const today = dayKey();
  const [kurs, setKurs] = useState<number | 0>(0);
  const attempts = data.attempts;

  const filterKurs = (a: { kurs: number }) => !kurs || a.kurs === kurs;
  const weeks = useMemo(() => weekly(attempts, filterKurs, 12, today), [attempts, kurs, today]);
  const rate30 = useMemo(() => rateBy(attempts.filter(filterKurs), () => 'all', 30, today).get('all'), [attempts, kurs, today]);
  const total = useMemo(() => rateBy(attempts.filter(filterKurs), () => 'all').get('all'), [attempts, kurs]);
  const days = useMemo(() => practiceDays(attempts), [attempts]);
  const st = streak(attempts, today);
  const top5 = useMemo(() => frequentTypes(attempts, data.errors, today, 30, 5), [attempts, data.errors, today]);
  const perCourse = useMemo(() => rateBy(attempts, (a) => a.kurs), [attempts]);
  const perLesson = useMemo(() => rateBy(attempts, (a) => a.lektion), [attempts]);
  const perCourse30 = useMemo(() => rateBy(attempts, (a) => a.kurs, 30, today), [attempts, today]);

  if (!attempts.length) {
    return (
      <div>
        <div className="page-head">
          <h1>Statistik</h1>
        </div>
        <Empty icon="statistik" title="Noch keine Daten" action={<a className="btn primary" href="#/kurse">Zu den Kursen</a>}>
          Sobald du Aufgaben beantwortest, siehst du hier Trefferquoten, Fehler je 100 Aufgaben, deine häufigsten Fehlertypen und deine Übungstage.
        </Empty>
      </div>
    );
  }

  const q = kurs ? `kurs=${kurs}&` : '';
  const ratePoints: Point[] = weeks.map((w) => ({
    key: w.woche,
    label: formatDay(w.woche, true),
    value: w.aufgaben ? (w.richtig / w.aufgaben) * 100 : null,
    detail: w.aufgaben ? `${w.richtig} von ${w.aufgaben} richtig` : undefined,
  }));
  const errPoints: Point[] = weeks.map((w) => ({
    key: w.woche,
    label: formatDay(w.woche, true),
    value: w.aufgaben ? (w.falsch / w.aufgaben) * 100 : null,
    detail: w.aufgaben ? `${w.falsch} Fehler bei ${plural(w.aufgaben, 'Aufgabe', 'Aufgaben')}` : undefined,
  }));
  const maxTop = Math.max(1, ...top5.map((t) => t.anzahl));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Statistik</h1>
          <p className="lead">Jede Zahl führt zu den Aufgaben, aus denen sie entsteht.</p>
        </div>
      </div>

      <div className="row wrap" style={{ marginBottom: 20 }}>
        <label className="small muted" htmlFor="st-kurs">
          Bereich
        </label>
        <select id="st-kurs" className="select" style={{ width: 'auto', minWidth: 220 }} value={kurs} onChange={(e) => setKurs(Number(e.target.value))}>
          <option value={0}>Alle Kurse</option>
          {BANK.courses.map((c) => (
            <option key={c.id} value={c.id}>
              Kurs {c.id}: {c.titel}
            </option>
          ))}
        </select>
      </div>

      <div className="card">
        <div className="stat-row">
          <button className="stat" onClick={() => navigate(`/statistik/aufgaben?${q}`)}>
            <span className="value">{total?.aufgaben ?? 0}</span>
            <span className="label">Aufgaben gesamt</span>
          </button>
          <button className="stat" onClick={() => navigate(`/statistik/aufgaben?${q}tage=30`)}>
            <span className="value">{rate30 ? pctText((rate30.richtig / rate30.aufgaben) * 100) : '–'}</span>
            <span className="label">Trefferquote, 30 Tage</span>
          </button>
          <button className="stat" onClick={() => navigate(`/statistik/aufgaben?${q}tage=30&nur=falsch`)}>
            <span className="value">{rate30 ? Math.round(((rate30.aufgaben - rate30.richtig) / rate30.aufgaben) * 100) : '–'}</span>
            <span className="label">Fehler je 100 Aufgaben, 30 Tage</span>
          </button>
          <div className="stat">
            <span className="value">{days.size}</span>
            <span className="label">
              Übungstage · Serie {st.tage}
            </span>
          </div>
        </div>
      </div>

      <div className="section grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <h3>Trefferquote je Woche</h3>
          </div>
          <LineChart
            points={ratePoints}
            max={100}
            format={pctText}
            title="Trefferquote je Woche, letzte zwölf Wochen"
            onSelect={(p) => navigate(`/statistik/aufgaben?${q}woche=${p.key}`)}
          />
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Fehler je 100 Aufgaben</h3>
          </div>
          <LineChart
            points={errPoints}
            format={(v) => String(Math.round(v))}
            title="Fehler je 100 Aufgaben je Woche, letzte zwölf Wochen"
            onSelect={(p) => navigate(`/statistik/aufgaben?${q}woche=${p.key}&nur=falsch`)}
          />
        </div>
      </div>

      <div className="section grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <h3>Häufigste Fehlertypen</h3>
            <span className="small muted">30 Tage</span>
          </div>
          {top5.length ? (
            <div className="bars">
              {top5.map((t) => (
                <button key={t.typ} className="bar-row" onClick={() => navigate(`/statistik/aufgaben?typ=${t.typ}&tage=30&nur=falsch`)} aria-label={`${fehlertyp(t.typ)?.label}: ${t.anzahl} Fehler`}>
                  <span>{fehlertyp(t.typ)?.label}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ display: 'block', width: `${(t.anzahl / maxTop) * 100}%` }} />
                  </span>
                  <span className="val">{t.anzahl}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="muted small">In den letzten 30 Tagen keine Fehler.</p>
          )}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Übungstage</h3>
          </div>
          <Calendar days={days} today={today} goal={data.settings.tagesziel} />
        </div>
      </div>

      <div className="section">
        <h2>Trefferquote je Kurs und Lektion</h2>
        <div className="table-wrap">
          <table className="data">
            <thead>
              <tr>
                <th>Kurs / Lektion</th>
                <th className="r">Aufgaben</th>
                <th className="r">Quote gesamt</th>
                <th className="r">Quote 30 Tage</th>
                <th>Stand</th>
              </tr>
            </thead>
            <tbody>
              {BANK.courses
                .filter((c) => !kurs || c.id === kurs)
                .flatMap((c) => {
                  const r = perCourse.get(c.id);
                  const r30 = perCourse30.get(c.id);
                  const rows = [
                    <tr key={`k${c.id}`} style={{ background: 'var(--surface-2)' }}>
                      <td>
                        <strong>
                          Kurs {c.id}: {c.titel}
                        </strong>
                      </td>
                      <td className="r">{r ? <button className="linklike" onClick={() => navigate(`/statistik/aufgaben?kurs=${c.id}`)}>{r.aufgaben}</button> : '–'}</td>
                      <td className="r">{r ? pctText((r.richtig / r.aufgaben) * 100) : '–'}</td>
                      <td className="r">{r30 ? <button className="linklike" onClick={() => navigate(`/statistik/aufgaben?kurs=${c.id}&tage=30`)}>{pctText((r30.richtig / r30.aufgaben) * 100)}</button> : '–'}</td>
                      <td />
                    </tr>,
                  ];
                  if (kurs || r) {
                    for (const l of c.lektionen) {
                      const lr = perLesson.get(l.id);
                      rows.push(
                        <tr key={l.id}>
                          <td style={{ paddingLeft: 26 }}>
                            <a href={`#/lektion/${l.id}`}>
                              {l.id} {l.titel}
                            </a>
                          </td>
                          <td className="r">{lr ? <button className="linklike" onClick={() => navigate(`/statistik/aufgaben?lektion=${l.id}`)}>{lr.aufgaben}</button> : '–'}</td>
                          <td className="r">{lr ? <button className="linklike" onClick={() => navigate(`/statistik/aufgaben?lektion=${l.id}&nur=falsch`)}>{pctText((lr.richtig / lr.aufgaben) * 100)}</button> : '–'}</td>
                          <td className="r">–</td>
                          <td>
                            <LevelBadge level={data.lessons[l.id]?.stufe ?? 'neu'} />
                          </td>
                        </tr>,
                      );
                    }
                  }
                  return rows;
                })}
            </tbody>
          </table>
        </div>
        <p className="small muted" style={{ marginTop: 8 }}>Ein Klick auf eine Quote zeigt die falsch beantworteten Aufgaben.</p>
      </div>
    </div>
  );
}

function Calendar({ days, today, goal }: { days: Map<string, number>; today: string; goal: number }) {
  const [offset, setOffset] = useState(0);
  const t = parseDay(today);
  const first = new Date(t.getFullYear(), t.getMonth() - offset, 1, 12);
  const startKey = dayKey(first);
  const lead = (first.getDay() + 6) % 7;
  const len = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: len }, (_, i) => addDays(startKey, i))];
  const level = (n: number) => (n >= goal ? 'l3' : n >= goal / 2 ? 'l2' : 'l1');
  const inMonth = cells.filter((c): c is string => !!c && days.has(c)).length;
  return (
    <div>
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="btn icon small ghost" onClick={() => setOffset(offset + 1)} aria-label="Voriger Monat">
          ‹
        </button>
        <strong className="small">
          {monthName(first.getMonth())} {first.getFullYear()} · {inMonth} {inMonth === 1 ? 'Übungstag' : 'Übungstage'}
        </strong>
        <button className="btn icon small ghost" onClick={() => setOffset(Math.max(0, offset - 1))} disabled={offset === 0} aria-label="Nächster Monat">
          ›
        </button>
      </div>
      <div className="calendar">
        {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
          <span key={d} className="wd">
            {d}
          </span>
        ))}
        {cells.map((c, i) => {
          if (!c) return <span key={`b${i}`} className="day blank" />;
          const n = days.get(c) ?? 0;
          const cls = `day${n ? ` ${level(n)}` : ''}${c === today ? ' today' : ''}`;
          return n ? (
            <button key={c} className={cls} onClick={() => navigate(`/statistik/aufgaben?tag=${c}`)} aria-label={`${formatDay(c)}: ${plural(n, 'Aufgabe', 'Aufgaben')}`} title={plural(n, 'Aufgabe', 'Aufgaben')}>
              {parseDay(c).getDate()}
            </button>
          ) : (
            <span key={c} className={cls} aria-label={`${formatDay(c)}: nicht geübt`}>
              {parseDay(c).getDate()}
            </span>
          );
        })}
      </div>
      <div className="legend">
        <span>
          <span className="day l1" style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-block', background: 'color-mix(in srgb, var(--accent) 25%, var(--surface-2))' }} /> geübt
        </span>
        <span>
          <span style={{ width: 14, height: 14, borderRadius: 4, display: 'inline-block', background: 'var(--accent)' }} /> Tagesziel erreicht
        </span>
      </div>
    </div>
  );
}
