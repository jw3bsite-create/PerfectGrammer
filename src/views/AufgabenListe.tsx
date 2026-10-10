import { useMemo, useState } from 'react';
import { Icon } from '../components/Icon';
import { getCourse, getLesson, getTask, taskPrompt } from '../lib/content';
import { dayKey, diffDays, formatDay, formatTime, weekKey } from '../lib/dates';
import { fehlertyp } from '../lib/fehlertypen';
import { units } from '../lib/mastery';
import { typo } from '../lib/normalize';
import { useApp } from '../lib/store';
import type { Attempt } from '../lib/types';

const KONTEXT: Record<string, string> = {
  gefuehrt: 'geführt',
  frei: 'frei',
  test: 'Lektionstest',
  wiederholung: 'Wiederholung',
  misch: 'Mischtraining',
  gezielt: 'gezielt',
  klausur: 'vor der Klausur',
  einstufung: 'Einstufung',
  kurstest: 'Kurstest',
  korrektur: 'Korrekturlesen',
};

export function AufgabenListe({ query }: { query: URLSearchParams }) {
  const data = useApp();
  const [limit, setLimit] = useState(100);
  const today = dayKey();
  const kurs = query.get('kurs');
  const lektion = query.get('lektion');
  const typ = query.get('typ');
  const woche = query.get('woche');
  const tag = query.get('tag');
  const tage = query.get('tage');
  const nur = query.get('nur');

  const list = useMemo(() => {
    const matchTyp = (a: Attempt) => !typ || a.fehlertyp === typ || (a.teile ?? []).some((t) => t.fehlertyp === typ);
    return data.attempts
      .filter((a) => {
        if (kurs && a.kurs !== Number(kurs)) return false;
        if (lektion && a.lektion !== lektion) return false;
        if (!matchTyp(a)) return false;
        if (woche && weekKey(a.tag) !== woche) return false;
        if (tag && a.tag !== tag) return false;
        if (tage && diffDays(today, a.tag) >= Number(tage)) return false;
        if (nur === 'falsch') {
          if (typ && a.teile) return a.teile.some((t) => t.fehlertyp === typ && !t.richtig);
          return !a.richtig;
        }
        if (nur === 'richtig') return a.richtig;
        return true;
      })
      .reverse();
  }, [data.attempts, kurs, lektion, typ, woche, tag, tage, nur, today]);

  const unitCount = list.flatMap(units).length;
  const right = list.flatMap(units).filter((u) => u.richtig).length;

  const parts: string[] = [];
  if (kurs) parts.push(`Kurs ${kurs}: ${getCourse(Number(kurs))?.titel ?? ''}`);
  if (lektion) parts.push(`Lektion ${lektion} ${getLesson(lektion)?.titel ?? ''}`);
  if (typ) parts.push(`Fehlertyp ${fehlertyp(typ)?.label ?? typ}`);
  if (woche) parts.push(`Woche ab ${formatDay(woche, true)}`);
  if (tag) parts.push(formatDay(tag));
  if (tage) parts.push(`letzte ${tage} Tage`);
  if (nur === 'falsch') parts.push('nur falsch beantwortet');

  return (
    <div>
      <a className="back" href="#/statistik">
        <Icon name="chevronLeft" /> Statistik
      </a>
      <div className="page-head">
        <div>
          <h1>Aufgaben</h1>
          <p className="lead">{parts.length ? parts.join(' · ') : 'Alle beantworteten Aufgaben'}</p>
        </div>
      </div>
      <p className="small muted" style={{ marginBottom: 14 }}>
        {list.length === 1 ? 'Ein Versuch' : `${list.length} Versuche`}
        {unitCount ? ` · ${right} von ${unitCount} richtig` : ''}
      </p>
      {list.length ? (
        <div className="list" style={{ display: 'block' }}>
          {list.slice(0, limit).map((a) => {
            const t = getTask(a.taskId);
            return (
              <div key={a.id} className="entry">
                <div className="entry-head">
                  <Icon name={a.richtig ? 'checkCircle' : 'crossCircle'} className="" />
                  <strong style={{ color: a.richtig ? 'var(--ok)' : 'var(--bad)' }}>{a.richtig ? 'richtig' : 'falsch'}</strong>
                  <span>·</span>
                  <span>
                    {formatDay(a.tag, true)}, {formatTime(a.zeit)}
                  </span>
                  <span>·</span>
                  <span>Lektion {a.lektion}</span>
                  <span>·</span>
                  <span>{fehlertyp(a.fehlertyp)?.label}</span>
                  <span>·</span>
                  <span>{KONTEXT[a.kontext]}</span>
                  {a.teile ? <span>· {a.teile.filter((x) => x.richtig).length} von {a.teile.length} Stellen</span> : null}
                  {a.uebersteuert ? <span className="badge outline">als richtig gewertet</span> : null}
                </div>
                {t && t.typ !== 'korrektur' && t.typ !== 'textwiedergabe' ? <div className="small muted" style={{ marginTop: 6 }}>{typo(taskPrompt(t))}</div> : null}
                <div className="entry-text">
                  {a.richtig ? (
                    <span>{typo(short(a.antwort))}</span>
                  ) : (
                    <>
                      <span className="falsch">{typo(short(a.antwort))}</span>
                      <span className="arrow">→</span>
                      <span>{typo(short(a.loesung))}</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card flat">
          <p className="muted">Keine Aufgaben für diese Auswahl.</p>
        </div>
      )}
      {list.length > limit ? (
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => setLimit(limit + 200)}>
            Weitere anzeigen ({list.length - limit})
          </button>
        </div>
      ) : null}
    </div>
  );
}

function short(s: string): string {
  return s.length > 320 ? `${s.slice(0, 320)} …` : s;
}
