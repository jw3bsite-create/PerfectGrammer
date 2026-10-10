// Startet Sitzungen und wechselt in die Übungsansicht.

import { getLesson, getCourse } from './content';
import { dayKey } from './dates';
import { uid } from './random';
import { navigate } from './router';
import {
  buildCourseTest,
  buildKlausur,
  buildLessonPhase,
  buildMixed,
  buildPlacement,
  buildReview,
  buildTargeted,
} from './sessions';
import { abandonSession, getState, markRuleRead, startSession } from './store';
import { fehlertypLabel } from './fehlertypen';
import type { Session, SessionItem } from './types';

const PHASE_LABEL = { gefuehrt: 'Geführte Übung', frei: 'Freie Übung', test: 'Lektionstest' } as const;

async function begin(partial: Omit<Session, 'id' | 'index' | 'results' | 'gestartet'>): Promise<boolean> {
  if (!partial.items.length) return false;
  if (getState().session) await abandonSession();
  const s: Session = { ...partial, id: uid(), index: 0, results: [], gestartet: Date.now() };
  await startSession(s);
  navigate('/sitzung');
  return true;
}

export async function startLessonPhase(lessonId: string, phase: 'gefuehrt' | 'frei' | 'test') {
  const lesson = getLesson(lessonId);
  if (!lesson) return false;
  if (!getState().lessons[lessonId]?.regelGelesen) await markRuleRead(lessonId);
  const items = buildLessonPhase(lesson, phase, getState(), `${lessonId}:${phase}:${Date.now()}`);
  return begin({ art: 'lektion', titel: `${lesson.id} ${lesson.titel} · ${PHASE_LABEL[phase]}`, lektion: lessonId, kurs: lesson.kurs, phase, items });
}

export async function startReview(size?: number) {
  const st = getState();
  const plan = buildReview(st, dayKey(), size ?? st.settings.sitzungslaenge, `review:${Date.now()}`);
  return begin({ art: 'wiederholung', titel: 'Tägliche Wiederholung', items: plan.items });
}

export async function startMixed(kurse: number[], nurFehlertyp: boolean, size?: number) {
  const st = getState();
  const items = buildMixed(kurse, size ?? st.settings.sitzungslaenge, nurFehlertyp, st, `mix:${Date.now()}`);
  const titel = nurFehlertyp ? 'Mischtraining · Fehlertyp bestimmen' : 'Mischtraining';
  return begin({ art: 'misch', titel, items, kurse });
}

export async function startTargeted(types: string[], size = 15) {
  const items = buildTargeted(types, size, getState(), `target:${Date.now()}`);
  const titel = types.length === 1 ? `Gezielt üben · ${fehlertypLabel(types[0])}` : 'Gezielt üben';
  return begin({ art: 'gezielt', titel, items, fehlertypen: types });
}

export async function startKlausur() {
  const { items, typen } = buildKlausur(getState(), dayKey(), `klausur:${Date.now()}`);
  return begin({ art: 'klausur', titel: 'Vor der Klausur', items, fehlertypen: typen, endetUm: Date.now() + 15 * 60 * 1000 });
}

export async function startPlacement() {
  return begin({ art: 'einstufung', titel: 'Einstufungstest', items: buildPlacement(`einstufung:${Date.now()}`) });
}

export async function startCourseTest(kurs: number) {
  const c = getCourse(kurs);
  const items = buildCourseTest(kurs, getState(), `kurstest:${kurs}:${Date.now()}`);
  return begin({ art: 'kurstest', titel: `Kurstest · ${c?.titel ?? `Kurs ${kurs}`}`, kurs, items });
}

export async function startSingle(taskId: string, titel: string, kontext: SessionItem['kontext'] = 'korrektur') {
  return begin({ art: 'text', titel, items: [{ taskId, kontext }] });
}

export { PHASE_LABEL };
