import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Confirm, Empty, Progress, RuleCard, Sheet, numberWord } from '../components/ui';
import type { ExerciseResult } from '../exercises/common';
import { TaskView, TYP_LABEL } from '../exercises/TaskView';
import { getCourse, getLesson, getTask, solutionText } from '../lib/content';
import { DURCHGAENGE, fehlertypLabel } from '../lib/fehlertypen';
import { LEVEL_LABEL } from '../lib/mastery';
import { typo } from '../lib/normalize';
import { navigate } from '../lib/router';
import { abandonSession, finishSession, overrideLastAttempt, recordAttempt, updateSession, useApp, type SessionSummary } from '../lib/store';
import { startLessonPhase, startReview, PHASE_LABEL } from '../lib/start';
import type { Session, SessionItem, Task } from '../lib/types';
import { BANK } from '../lib/content';
import { HEAVY } from '../lib/sessions';

interface Answered {
  index: number;
  item: SessionItem;
  task: Task;
  result: ExerciseResult;
  attemptId: string;
  notice?: string;
  overridden?: boolean;
}

function backTarget(s: Session | { art: string; lektion?: string; kurs?: number }): string {
  if (s.art === 'lektion' && s.lektion) return `/lektion/${s.lektion}`;
  if (s.art === 'kurstest' && s.kurs) return `/kurse/${s.kurs}`;
  if (s.art === 'einstufung') return '/kurse';
  if (s.art === 'text') return '/kurse/10';
  return '/';
}

function timeLimit(task: Task, base: number): number {
  if (task.typ === 'korrektur') return base * 12;
  if (task.typ === 'textwiedergabe') return base * 8;
  if (task.typ === 'umformen') return base * 2;
  if (task.typ === 'probe') return Math.round(base * 1.5);
  return base;
}

export function SessionView() {
  const data = useApp();
  const s = data.session;
  const [answered, setAnswered] = useState<Answered | null>(null);
  const [summary, setSummary] = useState<{ session: Session; summary: SessionSummary } | null>(null);
  const [rule, setRule] = useState<string | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const submitRef = useRef<(() => void) | null>(null);
  const feedbackRef = useRef<HTMLDivElement>(null);
  const finishing = useRef(false);
  const [now, setNow] = useState(Date.now());

  const index = answered ? answered.index : s?.index ?? 0;
  const item = s && index < s.items.length ? s.items[index] : undefined;
  const task = item ? getTask(item.taskId) : undefined;
  const settings = data.settings;
  const timed = settings.zeitmodus && !answered && !!task;
  const limit = task ? timeLimit(task, settings.sekundenJeAufgabe) : 0;
  const [taskStart, setTaskStart] = useState(Date.now());

  useEffect(() => {
    setTaskStart(Date.now());
  }, [s?.id, index]);

  // Uhr für Zeitmodus und „Vor der Klausur“
  useEffect(() => {
    if (!s || (!settings.zeitmodus && !s.endetUm)) return;
    const t = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(t);
  }, [s, settings.zeitmodus]);

  const finish = useCallback(async () => {
    if (finishing.current || !s) return;
    finishing.current = true;
    const snapshot = s;
    const sum = await finishSession();
    if (sum) setSummary({ session: snapshot, summary: sum });
    finishing.current = false;
  }, [s]);

  // Fehlende Aufgaben überspringen, Sitzungsende erkennen
  useEffect(() => {
    if (!s || answered || summary) return;
    if (s.index >= s.items.length || (s.endetUm && Date.now() > s.endetUm && s.results.length > 0)) {
      void finish();
      return;
    }
    if (item && !task) void updateSession({ ...s, index: s.index + 1 });
  }, [s, answered, summary, item, task, finish]);

  const onResult = useCallback(
    async (r: ExerciseResult) => {
      if (!s || !item || !task || answered) return;
      const { attempt, notice } = await recordAttempt({
        task,
        kontext: item.kontext,
        sitzung: s.id,
        antwort: r.antwort,
        loesung: r.loesung,
        richtig: r.richtig,
        teile: r.teile,
        eintraege: r.eintraege,
        fehlertypOverride: r.fehlertypOverride,
      });
      const next: Session = {
        ...s,
        index: s.index + 1,
        results: [...s.results, { taskId: task.id, richtig: r.richtig, attemptId: attempt.id, ...(r.teile ? { teile: r.teile } : {}) }],
      };
      setAnswered({ index: s.index, item, task, result: r, attemptId: attempt.id, notice });
      await updateSession(next);
    },
    [s, item, task, answered],
  );

  // Zeitablauf
  useEffect(() => {
    if (!timed || !task) return;
    if (now - taskStart >= limit * 1000) {
      if (submitRef.current) submitRef.current();
      else
        void onResult({
          richtig: false,
          antwort: '– (Zeit abgelaufen)',
          loesung: solutionText(task),
          hinweise: ['Die Zeit ist abgelaufen.'],
        });
    }
  }, [now, timed, task, taskStart, limit, onResult]);

  const next = useCallback(() => {
    setAnswered(null);
    submitRef.current = null;
    window.scrollTo(0, 0);
  }, []);

  useEffect(() => {
    if (answered) feedbackRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [answered]);

  // Tastatur: Enter prüft und geht weiter, R öffnet die Regelkarte
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.defaultPrevented || rule || confirmEnd) return;
      const target = e.target as HTMLElement;
      const tag = target?.tagName;
      if (e.key === 'Enter' && !e.shiftKey && !e.repeat) {
        if (tag === 'TEXTAREA' || tag === 'INPUT') return;
        const isTaskButton = tag === 'BUTTON' && (target.classList.contains('gap') || target.classList.contains('word') || target.classList.contains('chunk'));
        if (tag === 'BUTTON' && !isTaskButton) return;
        e.preventDefault();
        if (answered) next();
        else submitRef.current?.();
        return;
      }
      if ((e.key === 'r' || e.key === 'R') && !e.metaKey && !e.ctrlKey && !e.altKey && tag !== 'INPUT' && tag !== 'TEXTAREA') {
        const lesson = (answered?.task ?? task)?.lektion;
        if (lesson) {
          e.preventDefault();
          setRule(lesson);
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [answered, next, rule, confirmEnd, task]);

  const register = useCallback((fn: (() => void) | null) => {
    submitRef.current = fn;
  }, []);

  if (summary) return <SummaryView session={summary.session} summary={summary.summary} />;

  if (!s) {
    return (
      <div className="practice">
        <div className="practice-body">
          <Empty icon="ueben" title="Keine laufende Sitzung" action={<a className="btn primary" href="#/ueben">Zum Üben</a>}>
            Starte eine Lektion, die Wiederholung oder ein Mischtraining.
          </Empty>
        </div>
      </div>
    );
  }

  const shownTask = answered?.task ?? task;
  const shownItem = answered?.item ?? item;
  const total = s.items.length;
  const done = s.results.length;
  const remainingKlausur = s.endetUm ? Math.max(0, Math.round((s.endetUm - now) / 60000)) : null;
  const lesson = shownTask ? getLesson(shownTask.lektion) : undefined;
  const guided = shownItem?.kontext === 'gefuehrt';
  const course = shownTask ? getCourse(shownTask.kurs) : undefined;
  const timeLeft = timed ? Math.max(0, limit - Math.floor((now - taskStart) / 1000)) : 0;

  return (
    <div className="practice">
      <header className="practice-head">
        <div className="practice-head-inner">
          <button className="btn icon small ghost" onClick={() => setConfirmEnd(true)} aria-label="Sitzung beenden" title="Sitzung beenden">
            <Icon name="close" />
          </button>
          {s.endetUm ? (
            <span className="count" style={{ textAlign: 'left' }}>
              noch {remainingKlausur} min
            </span>
          ) : null}
          <Progress value={s.endetUm ? Math.min(1, (now - s.gestartet) / (s.endetUm - s.gestartet)) : done / total} label="Fortschritt" />
          <span className="count">{s.endetUm ? `${done} Aufg.` : `${Math.min(done + (answered ? 0 : 1), total)} / ${total}`}</span>
          {lesson ? (
            <button className="btn small ghost" onClick={() => setRule(lesson.id)} title="Regelkarte (R)">
              <Icon name="card" /> Regel
            </button>
          ) : null}
        </div>
        {timed ? (
          <div className={`timer${timeLeft <= 5 ? ' low' : ''}`} role="timer" aria-label={`noch ${timeLeft} Sekunden`}>
            <span style={{ width: `${(timeLeft / limit) * 100}%` }} />
          </div>
        ) : null}
      </header>

      <main className="practice-body">
        <div className="sr-only" aria-live="polite">
          {answered ? (answered.result.richtig || answered.overridden ? 'Richtig' : 'Falsch') : ''}
        </div>
        {shownTask && shownItem ? (
          <>
            <div className="task-meta">
              <span>{s.titel}</span>
              {s.art !== 'lektion' ? <span>· Lektion {shownTask.lektion}</span> : null}
              <span>· {shownItem.modus === 'fehlertyp' ? TYP_LABEL.fehlertyp : TYP_LABEL[shownTask.typ]}</span>
              {shownTask.geprueft === false ? <span className="badge outline">eigene Aufgabe</span> : null}
            </div>
            {guided && course && !answered ? (
              <div className="guide">
                <Icon name="target" />
                <span>
                  <strong>Probe:</strong> {typo(course.probe)}
                </span>
              </div>
            ) : null}
            <TaskView
              key={`${s.id}-${index}`}
              task={shownTask}
              modus={shownItem.modus}
              guided={guided}
              locked={!!answered}
              register={register}
              onResult={onResult}
            />
            {answered ? (
              <div ref={feedbackRef}>
                <Feedback
                  a={answered}
                  onRule={() => setRule(answered.task.lektion)}
                  onNext={next}
                  onOverride={async () => {
                    const ok = await overrideLastAttempt(answered.attemptId);
                    if (ok) setAnswered({ ...answered, overridden: true });
                  }}
                  last={s.index >= s.items.length || (!!s.endetUm && now > s.endetUm)}
                />
              </div>
            ) : null}
          </>
        ) : (
          <div className="loading">
            <div>
              <div className="spinner" />
              Wird geladen …
            </div>
          </div>
        )}
      </main>

      {rule ? (
        <Sheet title={`${rule} ${getLesson(rule)?.titel ?? ''}`} eyebrow="Regelkarte" onClose={() => setRule(null)}>
          {getLesson(rule) ? <RuleCard karte={getLesson(rule)!.regelkarte} /> : null}
        </Sheet>
      ) : null}
      {confirmEnd ? (
        <Confirm
          title="Sitzung beenden?"
          text="Beantwortete Aufgaben bleiben gespeichert und zählen für Fehlerbuch und Wiederholung."
          confirmLabel="Beenden"
          onCancel={() => setConfirmEnd(false)}
          onConfirm={async () => {
            const target = backTarget(s);
            setConfirmEnd(false);
            await abandonSession();
            navigate(target);
          }}
        />
      ) : null}
    </div>
  );
}

function Feedback({ a, onRule, onNext, onOverride, last }: { a: Answered; onRule: () => void; onNext: () => void; onOverride: () => void; last: boolean }) {
  const r = a.result;
  const ok = r.richtig || a.overridden;
  const cls = ok ? 'ok' : r.teilweise ? 'part' : 'bad';
  const head = ok ? (a.overridden ? 'Als richtig gewertet' : 'Richtig') : r.teilweise ? 'Teilweise richtig' : 'Falsch';
  const lesson = getLesson(a.task.lektion);
  return (
    <div className={`feedback ${cls}`} role="region" aria-label="Rückmeldung">
      <div className="feedback-head">
        <Icon name={ok ? 'checkCircle' : 'crossCircle'} />
        {head}
      </div>
      <div className="feedback-body">
        {r.detail}
        <div>
          <div className="fb-label">Begründung</div>
          <p className="fb-reason">{typo(r.begruendung ?? a.task.begruendung)}</p>
        </div>
        {(r.hinweise ?? []).map((h, i) => (
          <p key={i} className="fb-note">
            <Icon name="info" />
            {h}
          </p>
        ))}
        {a.notice ? (
          <div className="notice">
            <Icon name="alert" />
            <span>{a.notice}</span>
          </div>
        ) : null}
        <div className="row wrap" style={{ gap: 16 }}>
          {lesson ? (
            <button className="linklike small" onClick={onRule}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="card" className="" /> Regelkarte {lesson.id} {lesson.titel}
              </span>
            </button>
          ) : null}
          {!ok ? <span className="small muted">Im Fehlerbuch gespeichert.</span> : null}
          {r.uebersteuerbar && !a.overridden ? (
            <button className="btn small ghost" onClick={onOverride} title="Nur wählen, wenn deine Fassung ebenfalls korrekt ist">
              Meine Fassung ist auch richtig
            </button>
          ) : null}
        </div>
        <div className="actions" style={{ marginTop: 4 }}>
          <button className="btn primary" onClick={onNext} autoFocus>
            {last ? 'Abschließen' : 'Weiter'} <span className="kbd">↵</span>
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------- Abschluss ----------

function SummaryView({ session, summary }: { session: Session; summary: SessionSummary }) {
  const data = useApp();
  const wrong = session.results.filter((r) => !r.richtig);
  const lesson = session.lektion ? getLesson(session.lektion) : undefined;
  const [checks, setChecks] = useState<Record<string, boolean>>({});

  const nextLesson = useMemo(() => {
    if (!lesson) return undefined;
    const c = getCourse(lesson.kurs);
    const i = c?.lektionen.findIndex((l) => l.id === lesson.id) ?? -1;
    return i >= 0 ? c?.lektionen[i + 1] : undefined;
  }, [lesson]);

  let title = 'Sitzung abgeschlossen';
  let text: string | null = null;
  if (session.art === 'lektion' && session.phase) {
    title = `${PHASE_LABEL[session.phase]} abgeschlossen`;
    if (session.phase === 'test') {
      const teile = lesson?.ablauf?.wertung === 'teile';
      title = summary.bestanden ? 'Lektionstest bestanden' : 'Lektionstest nicht bestanden';
      text = summary.bestanden
        ? `Die Lektion ist jetzt „${LEVEL_LABEL[(summary.levelNachher ?? 'sicher') as keyof typeof LEVEL_LABEL]}“.`
        : teile
          ? 'Bestanden ist der Test ab 90 Prozent richtiger Prüfstellen. Übe weiter und schreib den Test erneut.'
          : 'Bestanden ist der Test ab neun richtigen Antworten. Übe weiter und schreib den Test erneut.';
    }
  } else if (session.art === 'kurstest') {
    title = summary.bestanden ? 'Kurstest bestanden' : 'Kurstest nicht bestanden';
    text = summary.bestanden ? 'Sind alle Lektionen sicher, ist der Kurs abgeschlossen.' : 'Bestanden ist der Kurstest ab 90 Prozent.';
  } else if (session.art === 'einstufung') {
    title = 'Einstufung abgeschlossen';
  } else if (session.art === 'klausur') {
    title = 'Jetzt die Prüfroutine';
  } else if (session.art === 'wiederholung') {
    title = 'Wiederholung abgeschlossen';
  }

  const placement = session.art === 'einstufung' ? placementOrder(data.courses) : null;

  return (
    <div className="practice">
      <main className="practice-body">
        <div className="eyebrow">{session.titel}</div>
        <h1 style={{ marginTop: 6 }}>{title}</h1>
        <div className="card" style={{ marginTop: 24 }}>
          <div className="stat">
            <span className="value">
              {summary.richtig} von {summary.gesamt}
            </span>
            <span className="label">{lesson?.ablauf?.wertung === 'teile' && session.phase === 'test' ? 'Prüfstellen richtig' : 'richtig beantwortet'}</span>
          </div>
          {text ? <p className="muted" style={{ marginTop: 12 }}>{text}</p> : null}
        </div>

        {placement ? (
          <div className="section">
            <h2>Ausgangsstand je Kurs</h2>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Vorgeschlagene Reihenfolge: die schwächsten Kurse zuerst. Alle Kurse bleiben frei wählbar.
            </p>
            <div className="list">
              {placement.map((p, i) => (
                <a key={p.kurs} className="list-item" href={`#/kurse/${p.kurs}`}>
                  <span className="nr">{i + 1}.</span>
                  <span className="grow">
                    <span className="title-line">{getCourse(p.kurs)?.titel}</span>
                    <span className="sub-line">{p.gesamt ? `${p.richtig} von ${p.gesamt} richtig` : 'Abschlusskurs'}</span>
                  </span>
                  <Icon name="chevronRight" className="chev" />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {session.art === 'klausur' ? (
          <div className="section">
            <h2>Prüfroutine in drei Durchgängen</h2>
            <p className="muted small" style={{ marginBottom: 14 }}>
              Lies deinen Text in der Klausur dreimal, jedes Mal mit nur einem Blick.
            </p>
            <div className="stack">
              {DURCHGAENGE.map((d) => (
                <div key={d.nr} className="card">
                  <h3 style={{ marginBottom: 10 }}>
                    {d.nr}. {d.titel}
                  </h3>
                  {d.punkte.map((p) => {
                    const key = `${d.nr}:${p}`;
                    return (
                      <label key={key} className="check">
                        <input type="checkbox" checked={!!checks[key]} onChange={(e) => setChecks({ ...checks, [key]: e.target.checked })} />
                        <span>{p}</span>
                      </label>
                    );
                  })}
                </div>
              ))}
            </div>
          </div>
        ) : null}

        {wrong.length && session.art !== 'einstufung' ? (
          <div className="section">
            <h2>Falsch beantwortet</h2>
            <div className="list">
              {wrong.map((w, i) => {
                const t = getTask(w.taskId);
                if (!t) return null;
                return (
                  <div key={i} className="list-item" style={{ cursor: 'default', alignItems: 'flex-start' }}>
                    <Icon name="crossCircle" className="chev" />
                    <span className="grow">
                      <span className="sub-line" style={{ marginTop: 0 }}>
                        {t.lektion} · {fehlertypLabel(t.fehlertyp)}
                        {w.teile ? ` · ${w.teile.filter((x) => x.richtig).length} von ${w.teile.length} Stellen` : ''}
                      </span>
                      <span style={{ fontFamily: 'var(--font-read)', display: 'block', marginTop: 4 }}>{typo(HEAVY.has(t.typ) ? shorten(solutionText(t)) : solutionText(t))}</span>
                    </span>
                  </div>
                );
              })}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              {wrong.length === 1 ? 'Die Aufgabe kehrt' : `Alle ${numberWord(wrong.length)} Aufgaben kehren`} morgen in der Wiederholung zurück.
            </p>
          </div>
        ) : null}

        <div className="actions" style={{ justifyContent: 'flex-start', marginTop: 32 }}>
          {session.art === 'lektion' && session.lektion && session.phase === 'gefuehrt' ? (
            <button className="btn primary" onClick={() => startLessonPhase(session.lektion!, 'frei')} autoFocus>
              Weiter zur freien Übung <span className="kbd">↵</span>
            </button>
          ) : null}
          {session.art === 'lektion' && session.lektion && session.phase === 'frei' ? (
            <button className="btn primary" onClick={() => startLessonPhase(session.lektion!, 'test')} autoFocus>
              Weiter zum Lektionstest <span className="kbd">↵</span>
            </button>
          ) : null}
          {session.art === 'lektion' && session.lektion && session.phase === 'test' && !summary.bestanden ? (
            <button className="btn primary" onClick={() => startLessonPhase(session.lektion!, 'frei')} autoFocus>
              Freie Übung wiederholen
            </button>
          ) : null}
          {session.art === 'lektion' && session.phase === 'test' && summary.bestanden && nextLesson ? (
            <a className="btn primary" href={`#/lektion/${nextLesson.id}`} autoFocus>
              Nächste Lektion: {nextLesson.id} {nextLesson.titel}
            </a>
          ) : null}
          {session.art === 'wiederholung' ? (
            <button className="btn primary" onClick={() => startReview()} autoFocus>
              Noch eine Runde
            </button>
          ) : null}
          <a className="btn" href={`#${backTarget(session)}`}>
            {session.art === 'lektion' ? 'Zur Lektion' : session.art === 'kurstest' ? 'Zum Kurs' : session.art === 'einstufung' ? 'Zu den Kursen' : 'Zur Startseite'}
          </a>
        </div>
      </main>
    </div>
  );
}

function shorten(s: string): string {
  return s.length > 140 ? `${s.slice(0, 140)} …` : s;
}

export function placementOrder(courses: Record<number, { einstufung?: { richtig: number; gesamt: number } }>) {
  const list = BANK.courses
    .filter((c) => c.id !== 10)
    .map((c) => ({ kurs: c.id, richtig: courses[c.id]?.einstufung?.richtig ?? 0, gesamt: courses[c.id]?.einstufung?.gesamt ?? 0 }))
    .sort((a, b) => (a.gesamt ? a.richtig / a.gesamt : 1) - (b.gesamt ? b.richtig / b.gesamt : 1) || a.kurs - b.kurs);
  if (BANK.courses.some((c) => c.id === 10)) list.push({ kurs: 10, richtig: 0, gesamt: 0 });
  return list;
}

