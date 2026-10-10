import { Icon } from '../components/Icon';
import { Empty, LevelBadge } from '../components/ui';
import { BANK, getCourse, lessonTasks } from '../lib/content';
import { formatDay, dayKey } from '../lib/dates';
import { LEVEL_RANK } from '../lib/mastery';
import { typo } from '../lib/normalize';
import { startCourseTest, startMixed, startSingle } from '../lib/start';
import { useApp } from '../lib/store';
import type { AppData, Course, Level } from '../lib/types';
import { placementOrder } from './Sitzung';

export function lessonLevel(data: AppData, id: string): Level {
  return data.lessons[id]?.stufe ?? 'neu';
}

export function courseDone(data: AppData, c: Course): boolean {
  const allSafe = c.lektionen.every((l) => LEVEL_RANK[lessonLevel(data, l.id)] >= LEVEL_RANK.sicher);
  const test = (data.courses[c.id]?.kurstests ?? []).some((t) => t.bestanden);
  return allSafe && test;
}

export function Kurse() {
  const data = useApp();
  const order = data.placementDone ? placementOrder(data.courses).map((p) => p.kurs) : null;
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Kurse</h1>
          <p className="lead">Jeder Kurs lehrt genau eine Probe: einen Handgriff, der sich mechanisch durchführen lässt.</p>
        </div>
      </div>
      {order ? (
        <div className="notice info" style={{ marginBottom: 20 }}>
          <Icon name="info" />
          <span>
            Vorgeschlagene Reihenfolge nach deiner Einstufung: {order.slice(0, 4).map((k) => `Kurs ${k}`).join(', ')} … Alle Kurse bleiben frei wählbar.
          </span>
        </div>
      ) : null}
      <div className="course-grid">
        {BANK.courses.map((c) => {
          const levels = c.lektionen.map((l) => lessonLevel(data, l.id));
          const safe = levels.filter((l) => LEVEL_RANK[l] >= LEVEL_RANK.sicher).length;
          const done = courseDone(data, c);
          const est = data.courses[c.id]?.einstufung;
          return (
            <a key={c.id} className="course-card" href={`#/kurse/${c.id}`}>
              <div className="row between">
                <span className="kursnr">Kurs {c.id}</span>
                {done ? (
                  <span className="badge ok">
                    <Icon name="check" /> abgeschlossen
                  </span>
                ) : order ? (
                  <span className="badge outline">Platz {order.indexOf(c.id) + 1}</span>
                ) : null}
              </div>
              <h3>{c.titel}</h3>
              <p className="probe">{typo(c.probe)}</p>
              <div className="levelbar" aria-hidden="true">
                {levels.map((l, i) => (
                  <span key={i} className={l} />
                ))}
              </div>
              <div className="row between small muted">
                <span>
                  {safe} von {c.lektionen.length} {c.lektionen.length === 1 ? 'Lektion' : 'Lektionen'} sicher
                </span>
                {est ? (
                  <span>
                    Einstufung {est.richtig}/{est.gesamt}
                  </span>
                ) : null}
              </div>
            </a>
          );
        })}
      </div>
    </div>
  );
}

export function KursSeite({ kurs }: { kurs: number }) {
  const data = useApp();
  const c = getCourse(kurs);
  if (!c) {
    return (
      <Empty title="Kurs nicht gefunden" action={<a className="btn" href="#/kurse">Zu den Kursen</a>}>
        Diesen Kurs gibt es nicht.
      </Empty>
    );
  }
  const tests = data.courses[c.id]?.kurstests ?? [];
  const lastTest = tests[tests.length - 1];
  const done = courseDone(data, c);
  const allSafe = c.lektionen.every((l) => LEVEL_RANK[lessonLevel(data, l.id)] >= LEVEL_RANK.sicher);
  const texts = c.id === 10 ? c.lektionen.flatMap((l) => lessonTasks(l.id, false)) : [];

  return (
    <div>
      <a className="back" href="#/kurse">
        <Icon name="chevronLeft" /> Kurse
      </a>
      <div className="page-head">
        <div>
          <div className="eyebrow">Kurs {c.id}</div>
          <h1>{c.titel}</h1>
          {c.beschreibung ? <p className="lead">{typo(c.beschreibung)}</p> : null}
        </div>
        {done ? (
          <span className="badge ok">
            <Icon name="check" /> abgeschlossen
          </span>
        ) : null}
      </div>

      <div className="card">
        <div className="rule-probe">
          <div className="eyebrow">Die Probe</div>
          <p>{typo(c.probe)}</p>
        </div>
      </div>

      <div className="section">
        <h2>Lektionen</h2>
        <div className="list">
          {c.lektionen.map((l) => (
            <a key={l.id} className="list-item" href={`#/lektion/${l.id}`}>
              <span className="nr">{l.id}</span>
              <span className="grow">
                <span className="title-line">{l.titel}</span>
              </span>
              <LevelBadge level={lessonLevel(data, l.id)} />
              <Icon name="chevronRight" className="chev" />
            </a>
          ))}
        </div>
      </div>

      {c.id === 10 && texts.length ? (
        <div className="section">
          <h2>Korrekturtexte</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Jeder Text im Stil einer Abiturklausur, mit Fehlern aus allen Kursen. Du korrigierst in drei festen Durchgängen.
          </p>
          <div className="list">
            {texts.map((t, i) => {
              const last = [...data.attempts].reverse().find((a) => a.taskId === t.id);
              const found = last?.teile ? last.teile.filter((x) => x.richtig).length : null;
              return (
                <button key={t.id} className="list-item" onClick={() => startSingle(t.id, t.typ === 'korrektur' ? t.titel : `Text ${i + 1}`)}>
                  <span className="nr">{i + 1}</span>
                  <span className="grow">
                    <span className="title-line">{t.typ === 'korrektur' ? t.titel : t.id}</span>
                    <span className="sub-line">
                      {t.typ === 'korrektur' && t.aufgabe ? t.aufgabe : ''}
                      {last ? ` · zuletzt ${formatDay(last.tag, true)}: ${found} von ${last.teile?.length} Stellen` : ''}
                    </span>
                  </span>
                  <Icon name="chevronRight" className="chev" />
                </button>
              );
            })}
          </div>
        </div>
      ) : null}

      <div className="section grid-2">
        <div className="card">
          <div className="card-title">
            <h3>Kurstest</h3>
            {lastTest ? <span className={`badge ${lastTest.bestanden ? 'ok' : 'bad'}`}>{lastTest.bestanden ? 'bestanden' : 'nicht bestanden'}</span> : null}
          </div>
          <p className="small muted">
            {c.id === 10 ? 'Zwei Korrekturtexte, die du am längsten nicht bearbeitet hast. Bestanden ab 90 Prozent der Stellen.' : '25 gemischte Aufgaben aus allen Lektionen. Bestanden ab 90 Prozent.'}{' '}
            {allSafe ? 'Alle Lektionen sind sicher.' : 'Abgeschlossen ist der Kurs, wenn zusätzlich alle Lektionen sicher sind.'}
          </p>
          {lastTest ? (
            <p className="small" style={{ marginTop: 8 }}>
              Zuletzt am {formatDay(dayKey(lastTest.zeit), true)}: {lastTest.richtig} von {lastTest.gesamt}
            </p>
          ) : null}
          <button className="btn wide" style={{ marginTop: 14 }} onClick={() => startCourseTest(c.id)}>
            Kurstest starten
          </button>
        </div>
        {c.id !== 10 ? (
          <div className="card">
            <div className="card-title">
              <h3>Mischtraining</h3>
            </div>
            <p className="small muted">Aufgaben aus allen Lektionen dieses Kurses, durchmischt und ohne Hilfen.</p>
            <button className="btn wide" style={{ marginTop: 14 }} onClick={() => startMixed([c.id], false)}>
              Mischtraining starten
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
