import { useState } from 'react';
import { Icon } from '../components/Icon';
import { Confirm, Empty, LevelBadge, RuleCard, toast } from '../components/ui';
import { getCourse, getLesson, lessonAblauf, lessonTasks, taskPrompt } from '../lib/content';
import { formatDay, dayKey } from '../lib/dates';
import { units } from '../lib/mastery';
import { NO_AUTOCORRECT } from '../exercises/common';
import { startLessonPhase } from '../lib/start';
import { addCustomWord, deleteCustomTask, markRuleRead, useApp } from '../lib/store';
import { typo } from '../lib/normalize';

export function LektionSeite({ id }: { id: string }) {
  const data = useApp();
  const lesson = getLesson(id);
  const [del, setDel] = useState<string | null>(null);
  const [wort, setWort] = useState('');
  const [umschreibung, setUmschreibung] = useState('');
  if (!lesson) {
    return (
      <Empty title="Lektion nicht gefunden" action={<a className="btn" href="#/kurse">Zu den Kursen</a>}>
        Diese Lektion gibt es nicht.
      </Empty>
    );
  }
  const course = getCourse(lesson.kurs)!;
  const ls = data.lessons[id];
  const level = ls?.stufe ?? 'neu';
  const ablauf = lessonAblauf(lesson);
  const tasks = lessonTasks(id);
  const bank = tasks.filter((t) => t.geprueft !== false);
  const own = tasks.filter((t) => t.geprueft === false);
  const lastTest = ls?.tests[ls.tests.length - 1];
  const lessonUnits = data.attempts.filter((a) => a.lektion === id).flatMap(units);
  const last20 = lessonUnits.slice(-20);
  const last20Right = last20.filter((u) => u.richtig).length;
  const last20Days = new Set(last20.map((u) => u.tag)).size;
  const teile = ablauf.wertung === 'teile';

  const phase = ls?.phase;
  const recommended = !ls?.regelGelesen ? 'regel' : !phase || phase === 'regel' ? 'gefuehrt' : phase === 'gefuehrt' ? 'frei' : 'test';

  const steps = [
    { key: 'gefuehrt' as const, nr: 2, titel: 'Geführte Übung', text: `${ablauf.gefuehrt} ${teile ? 'Aufgaben' : 'Aufgaben'}, nach jeder Antwort die Begründung über die Probe` },
    { key: 'frei' as const, nr: 3, titel: 'Freie Übung', text: `${ablauf.frei} Aufgaben in gemischten Typen, ohne Hilfen` },
    {
      key: 'test' as const,
      nr: 4,
      titel: 'Lektionstest',
      text: teile ? `${ablauf.test} Aufgaben, bestanden ab 90 Prozent der Prüfstellen` : `${ablauf.test} Aufgaben, bestanden ab neun richtigen`,
    },
  ];

  return (
    <div>
      <a className="back" href={`#/kurse/${course.id}`}>
        <Icon name="chevronLeft" /> Kurs {course.id}: {course.titel}
      </a>
      <div className="page-head">
        <div>
          <div className="eyebrow">Lektion {lesson.id}</div>
          <h1>{lesson.titel}</h1>
        </div>
        <LevelBadge level={level} />
      </div>

      {ls?.rueckgestuftAm && level === 'inArbeit' ? (
        <div className="notice" style={{ marginBottom: 16 }}>
          <Icon name="alert" />
          <span>Am {formatDay(dayKey(ls.rueckgestuftAm), true)} zurückgestuft: In der Wiederholung lag die Quote unter 80 Prozent. Schreib den Lektionstest erneut.</span>
        </div>
      ) : null}

      <div className="card">
        <div className="card-title">
          <h2>
            <span className="muted">1</span> Regelkarte
          </h2>
          {ls?.regelGelesen ? (
            <span className="badge ok">
              <Icon name="check" /> gelesen
            </span>
          ) : null}
        </div>
        <RuleCard karte={lesson.regelkarte} />
        {!ls?.regelGelesen ? (
          <div className="actions">
            <button className="btn" onClick={() => markRuleRead(id)}>
              Gelesen
            </button>
            <button className="btn primary" onClick={() => startLessonPhase(id, 'gefuehrt')}>
              Verstanden, zur geführten Übung
            </button>
          </div>
        ) : null}
      </div>

      <div className="section">
        <h2>Üben</h2>
        <div className="list">
          {steps.map((s) => (
            <button key={s.key} className="list-item" onClick={() => startLessonPhase(id, s.key)}>
              <span className="nr">{s.nr}</span>
              <span className="grow">
                <span className="title-line">
                  {s.titel}
                  {recommended === s.key ? <span className="badge sicher" style={{ marginLeft: 8 }}>als Nächstes</span> : null}
                </span>
                <span className="sub-line">
                  {s.text}
                  {s.key === 'test' && lastTest ? ` · zuletzt ${lastTest.richtig} von ${lastTest.gesamt} (${lastTest.bestanden ? 'bestanden' : 'nicht bestanden'})` : ''}
                </span>
              </span>
              <Icon name="play" className="chev" />
            </button>
          ))}
        </div>
      </div>

      <div className="section grid-2">
        <div className="card flat">
          <h3 style={{ marginBottom: 8 }}>Beherrschung</h3>
          <ul className="checklist" style={{ marginTop: 0 }}>
            <li>Sicher: Lektionstest {teile ? 'mit mindestens 90 Prozent' : 'mit mindestens 9 von 10'} bestanden.</li>
            <li>Gemeistert: mindestens 19 der letzten 20 Aufgaben richtig, an mindestens drei verschiedenen Tagen.</li>
            <li>Unter 80 Prozent in der Wiederholung stuft die Lektion auf „In Arbeit“ zurück.</li>
          </ul>
          <p className="small" style={{ marginTop: 12 }}>
            {last20.length
              ? `Letzte ${last20.length} ${teile ? 'Prüfstellen' : 'Aufgaben'}: ${last20Right} richtig an ${last20Days} ${last20Days === 1 ? 'Tag' : 'Tagen'}.`
              : 'Noch keine Aufgaben beantwortet.'}
          </p>
        </div>
        <div className="card flat">
          <h3 style={{ marginBottom: 8 }}>Aufgabenbank</h3>
          <p className="small muted">
            {bank.length} geprüfte Aufgaben{own.length ? `, ${own.length} eigene` : ''}. Wiederholung und Fehlerbuch greifen auf dieselbe Bank zu.
          </p>
        </div>
      </div>

      {id === '7.5' ? (
        <div className="section">
          <h2>Eigene Wortliste</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Ergänze Fachwörter, die du selbst schon falsch geschrieben hast. Die App liest sie vor und fragt sie ab.
          </p>
          <form
            className="card"
            onSubmit={async (e) => {
              e.preventDefault();
              if (!wort.trim()) return;
              await addCustomWord(wort, umschreibung);
              toast(`„${wort.trim()}“ steht jetzt in deiner Wortliste.`);
              setWort('');
              setUmschreibung('');
            }}
          >
            <div className="grid-2">
              <div className="field">
                <label htmlFor="w-wort">Wort</label>
                <input id="w-wort" className="input read" value={wort} onChange={(e) => setWort(e.target.value)} placeholder="z. B. Synekdoche" {...NO_AUTOCORRECT} />
              </div>
              <div className="field">
                <label htmlFor="w-um">Umschreibung</label>
                <input id="w-um" className="input" value={umschreibung} onChange={(e) => setUmschreibung(e.target.value)} placeholder="Was bedeutet es?" />
              </div>
            </div>
            <div className="actions" style={{ marginTop: 16 }}>
              <button className="btn primary" type="submit" disabled={!wort.trim()}>
                <Icon name="plus" /> Wort hinzufügen
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {own.length ? (
        <div className="section">
          <h2>Eigene Aufgaben</h2>
          <p className="muted small" style={{ marginBottom: 14 }}>
            Aus deinem Fehlerbuch oder deiner Wortliste. Sie sind als ungeprüft markiert und lassen sich löschen.
          </p>
          <div className="list">
            {own.map((t) => (
              <div key={t.id} className="list-item" style={{ cursor: 'default' }}>
                <span className="grow">
                  <span style={{ fontFamily: 'var(--font-read)' }}>{typo(t.typ === 'wort' ? t.wort : taskPrompt(t))}</span>
                  <span className="sub-line">{t.herkunft === 'wortliste' ? 'eigenes Wort' : 'aus dem Fehlerbuch'}</span>
                </span>
                <button className="btn icon small ghost" aria-label="Löschen" onClick={() => setDel(t.id)}>
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {del ? (
        <Confirm
          title="Eigene Aufgabe löschen?"
          text="Die Aufgabe verschwindet aus Übung und Wiederholung. Bisherige Antworten bleiben in der Statistik."
          confirmLabel="Löschen"
          danger
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await deleteCustomTask(del);
            setDel(null);
            toast('Aufgabe gelöscht.');
          }}
        />
      ) : null}
    </div>
  );
}
