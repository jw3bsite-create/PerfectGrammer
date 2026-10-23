// Ende-zu-Ende-Prüfung im echten Browser (Chromium über playwright-core).
// Aufruf: npm run e2e  (baut die App und startet die Vorschau selbst)

import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { chromium, type Browser, type BrowserContext, type Page } from 'playwright-core';
import { preview, type PreviewServer } from 'vite';
import { mkdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { getTask } from '../src/lib/content';
import { parseKomma, parseFehler } from '../src/lib/markup';
import { fehlertypLabel } from '../src/lib/fehlertypen';
import { singleErrorType } from '../src/lib/sessions';
import type { Task } from '../src/lib/types';
import { aufgabe as swAufgabe, KATEGORIEN, regelOptionen, transferKats } from '../src/schwaechen/daten';
import type { SAufgabe } from '../src/schwaechen/typen';
import { ARTEN as Z_ARTEN, REGELN as Z_REGELN, text as zText, TEXTSORTEN as Z_SORTEN, musterGesamt } from '../src/zusammenfassen/daten';
import { DEFEKTE, defektOptionen, schlussOptionen, verbOptionen, verdichtbar } from '../src/zusammenfassen/logik';

const PORT = 4179;
const BASE = `http://localhost:${PORT}/`;
const SHOTS = path.resolve('e2e/screenshots');
const CHROMIUM = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';

let server: PreviewServer;
let browser: Browser;
const pageErrors: string[] = [];

function watchErrors(page: Page) {
  page.on('pageerror', (e) => pageErrors.push(`pageerror: ${e.message}`));
  page.on('console', (m) => {
    if (m.type() === 'error') pageErrors.push(`console: ${m.text()}`);
  });
}

async function newContext(opts: { width: number; height: number; dark?: boolean; touch?: boolean } = { width: 1280, height: 860 }): Promise<BrowserContext> {
  return browser.newContext({
    viewport: { width: opts.width, height: opts.height },
    colorScheme: opts.dark ? 'dark' : 'light',
    hasTouch: !!opts.touch,
    isMobile: !!opts.touch,
    locale: 'de-DE',
    acceptDownloads: true,
  });
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(250);
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`), fullPage: false });
}

/** Kein Inhalt ragt über die Breite des Geräts hinaus (sonst verrutscht die Ansicht auf Tablet und Handy). */
async function noOverflow(page: Page, width: number, what: string) {
  const w = await page.evaluate(() => document.documentElement.scrollWidth);
  expect(w, `${what}: waagerechtes Scrollen`).toBeLessThanOrEqual(width);
}

async function onboard(page: Page) {
  await page.goto(BASE);
  await page.getByRole('button', { name: 'Ohne Einstufung beginnen' }).click();
  await page.getByRole('heading', { name: 'Wiederholung' }).waitFor();
}

// ---------- Aufgaben lösen ----------

async function currentTask(page: Page): Promise<{ task: Task; modus: string }> {
  const el = page.locator('[data-task]');
  await el.waitFor();
  const id = (await el.getAttribute('data-task'))!;
  const modus = (await el.getAttribute('data-modus')) ?? '';
  // Eigene Aufgaben (Fehlerbuch, Wortliste) liegen nur in der IndexedDB des Browsers.
  const task =
    getTask(id) ??
    ((await page.evaluate(
      (key) =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('sprachrichtigkeit');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const get = req.result.transaction('eigeneAufgaben').objectStore('eigeneAufgaben').get(key);
            get.onsuccess = () => resolve(get.result);
            get.onerror = () => reject(get.error);
          };
        }),
      id,
    )) as Task | undefined);
  if (!task) throw new Error(`Aufgabe ${id} nicht gefunden`);
  return { task, modus };
}

async function moveCursor(page: Page, from: number, to: number) {
  const key = to > from ? 'ArrowRight' : 'ArrowLeft';
  for (let i = 0; i < Math.abs(to - from); i++) await page.keyboard.press(key);
}

/** Wortbereiche der Fehlerstellen im Original und der korrigierte Text dafür, von hinten nach vorn. */
function chunkEdits(text: string): { first: number; last: number; value: string }[] {
  const p = parseFehler(text);
  const original = p.original;
  const words: { s: number; e: number }[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(original))) words.push({ s: m.index, e: m.index + m[0].length });
  const errs = p.fehler.filter((f) => f.fehlertyp !== 'frei');
  const groups: { first: number; last: number; errs: typeof errs }[] = [];
  for (const f of errs) {
    let first = words.findIndex((w) => w.e > f.start);
    let last = first;
    if (f.end > f.start) {
      first = words.findIndex((w) => w.e > f.start);
      last = words.findIndex((w) => w.e >= f.end);
    } else {
      // Einfügung ohne Original: an das Wort davor hängen
      first = last = Math.max(0, words.findIndex((w) => w.e >= f.start));
    }
    const g = groups.find((x) => !(last < x.first || first > x.last));
    if (g) {
      g.first = Math.min(g.first, first);
      g.last = Math.max(g.last, last);
      g.errs.push(f);
    } else groups.push({ first, last, errs: [f] });
  }
  return groups
    .map((g) => {
      const s = words[g.first].s;
      const e = words[g.last].e;
      let seg = original.slice(s, e);
      for (const f of [...g.errs].sort((a, b) => b.start - a.start)) seg = seg.slice(0, f.start - s) + f.richtig + seg.slice(f.end - s);
      return { first: g.first, last: g.last, value: seg.trim() };
    })
    .sort((a, b) => b.first - a.first);
}

async function applyChunkEdits(page: Page, text: string) {
  let cursor = 0;
  for (const ed of chunkEdits(text)) {
    await moveCursor(page, cursor, ed.first);
    await page.keyboard.press('e');
    const input = page.getByLabel('Korrigierte Fassung');
    await input.waitFor();
    for (let i = ed.first; i < ed.last; i++) await input.press('Alt+ArrowRight');
    await input.fill(ed.value);
    await input.press('Enter');
    await input.waitFor({ state: 'detached' });
    cursor = ed.first;
  }
}

/** Beantwortet die angezeigte Aufgabe richtig oder bewusst falsch, nur mit der Tastatur. */
async function answer(page: Page, correct = true): Promise<Task> {
  const { task, modus } = await currentTask(page);
  await solveExercise(page, task, modus, correct);
  await expectFeedback(page, task.id, task.typ, correct);
  return task;
}

async function expectFeedback(page: Page, id: string, typ: string, correct: boolean) {
  const fb = page.getByRole('region', { name: 'Rückmeldung' });
  await fb.waitFor();
  const cls = (await fb.getAttribute('class')) ?? '';
  if (correct !== /\bok\b/.test(cls)) await page.screenshot({ path: path.join(SHOTS, `fehlschlag-${id}.png`), fullPage: true });
  if (correct) expect(cls, `${id} (${typ}) sollte richtig sein: ${await fb.innerText()}`).toContain('ok');
  else expect(cls, `${id} sollte falsch sein`).not.toContain(' ok');
}

/** Bearbeitet die Übung selbst (ohne auf die Rückmeldung zu warten). */
async function solveExercise(page: Page, task: Task | SAufgabe, modus: string, correct: boolean) {
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  if (task.typ === 'schreiben') {
    const ta = page.locator('.practice-body textarea').first();
    await ta.waitFor();
    await ta.fill(correct ? task.beispiel : (task.gegenbeispiel ?? 'Das ist falsch'));
    await ta.press('Enter');
    return;
  }
  switch (task.typ) {
    case 'probe':
    case 'komma': {
      const p = parseKomma(task.text);
      let cursor = 0;
      if (task.typ === 'probe') {
        if (correct) {
          for (let i = 0; i < p.tokens.length; i++) {
            if (!p.tokens[i].verb) continue;
            await moveCursor(page, cursor, i);
            cursor = i;
            await page.keyboard.press(' ');
          }
        }
        await page.keyboard.press('Enter');
        await page.locator('.word.res-ok, .word.res-fehlt, .word.res-zuviel, .word[disabled]').first().waitFor();
        await page.keyboard.press('Enter');
        await page.getByText('Schritt 2 von 2').waitFor();
        cursor = 0;
      }
      if (correct) {
        for (let i = 0; i < p.gaps.length; i++) {
          if (p.gaps[i] !== 'ja') continue;
          await moveCursor(page, cursor, i);
          cursor = i;
          await page.keyboard.press(' ');
        }
      } else {
        // Ein Komma an einer falschen Stelle oder keins, wo eines fehlt
        const wrong = p.gaps.findIndex((g) => g === 'nein');
        if (wrong >= 0) {
          await moveCursor(page, cursor, wrong);
          await page.keyboard.press(' ');
        }
      }
      await page.keyboard.press('Enter');
      break;
    }
    case 'eintippen':
    case 'wort': {
      const input = page.locator('.practice-body input.gap-input, .practice-body input.input').first();
      await input.waitFor();
      const value = task.typ === 'wort' ? task.wort : task.loesungen[0];
      await input.fill(correct ? value : `${value}x`);
      await input.press('Enter');
      break;
    }
    case 'entscheiden': {
      const idx = task.optionen.findIndex((o) => (correct ? task.loesungen.includes(o) : !task.loesungen.includes(o)));
      await page.keyboard.press(String(idx + 1));
      break;
    }
    case 'umformen':
    case 'textwiedergabe': {
      const ta = page.locator('.practice-body textarea').first();
      await ta.waitFor();
      const value = task.typ === 'umformen' ? task.loesungen[0] : task.muster;
      await ta.fill(correct ? value : task.vorlage);
      await ta.press('Enter');
      break;
    }
    case 'fehler':
    case 'fehlertyp': {
      if (modus === 'fehlertyp' || task.typ === 'fehlertyp') {
        const label = fehlertypLabel(singleErrorType(task));
        const opts = await page.locator('.options .option').allInnerTexts();
        const idx = opts.findIndex((o) => o.includes(label));
        expect(idx, `Fehlertyp ${label} unter den Optionen`).toBeGreaterThanOrEqual(0);
        await page.keyboard.press(String(correct ? idx + 1 : ((idx + 1) % opts.length) + 1));
        await page.keyboard.press('Enter');
      }
      if (correct) await applyChunkEdits(page, task.text);
      else if (parseFehler(task.text).fehler.every((f) => f.fehlertyp === 'frei')) await applyChunkEdits(page, '[[' + parseFehler(task.text).original.split(' ')[0] + '=>xx|z]] ' + parseFehler(task.text).original.split(' ').slice(1).join(' '));
      await page.keyboard.press('Enter');
      break;
    }
    case 'korrektur': {
      if (correct) await applyChunkEdits(page, task.text);
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      await page.keyboard.press('Enter');
      break;
    }
  }
}

async function nextTask(page: Page) {
  await page.keyboard.press('Enter');
}

/** Löst alle Aufgaben der laufenden Sitzung; falsch: Indizes, die bewusst falsch beantwortet werden. */
async function solveSession(page: Page, wrong: number[] = []): Promise<Task[]> {
  const done: Task[] = [];
  for (let i = 0; i < 80; i++) {
    const summary = page.locator('.summary');
    const task = page.locator('[data-task]');
    await Promise.race([summary.waitFor(), task.waitFor()]);
    if (await summary.isVisible()) return done;
    done.push(await answer(page, !wrong.includes(i)));
    await nextTask(page);
  }
  throw new Error('Sitzung endet nicht');
}

// ---------- Meine Schwächen ----------

async function swCurrent(page: Page): Promise<SAufgabe> {
  const el = page.locator('[data-task]');
  await el.waitFor();
  const id = (await el.getAttribute('data-task'))!;
  const a =
    swAufgabe(id, []) ??
    ((await page.evaluate(
      (key) =>
        new Promise((resolve, reject) => {
          const req = indexedDB.open('sprachrichtigkeit');
          req.onerror = () => reject(req.error);
          req.onsuccess = () => {
            const get = req.result.transaction('meta').objectStore('meta').get('schwaechen');
            get.onsuccess = () => resolve((get.result?.eigene ?? []).find((x: { id: string }) => x.id === key));
            get.onerror = () => reject(get.error);
          };
        }),
      id,
    )) as SAufgabe | undefined);
  if (!a) throw new Error(`Aufgabe ${id} nicht gefunden`);
  return a;
}

/** Löst eine Aufgabe im Modul: Übung, dann Regel (oder Kategorien beim Transfer) wählen. */
async function swAnswer(page: Page, antwortOk = true, regelOk = true): Promise<SAufgabe> {
  const a = await swCurrent(page);
  try {
    await solveExercise(page, a, '', antwortOk);
  } catch (e) {
    await page.screenshot({ path: path.join(SHOTS, `fehlschlag-${a.id}.png`), fullPage: true });
    throw new Error(`${a.id}: ${String(e)}`);
  }
  if (a.kat === 'T') {
    await page.locator('[data-phase="kategorien"]').waitFor();
    const soll = transferKats(a);
    const wahl = regelOk ? soll : soll.slice(1);
    for (const k of wahl.length ? wahl : [KATEGORIEN.find((x) => !soll.includes(x.id))!.id]) await page.locator(`[data-phase="kategorien"] [data-kat="${k}"]`).click();
    await page.locator('[data-phase="kategorien"]').getByRole('button', { name: 'Prüfen' }).click();
  } else {
    await page.locator('[data-phase="regel"]').waitFor();
    const opts = regelOptionen(a);
    const wahl = regelOk ? a.regel : opts.find((o) => o.id !== a.regel)!.id;
    // Regel per Ziffer wählen, wie mit der Tastatur
    await page.keyboard.press(String(opts.findIndex((o) => o.id === wahl) + 1));
  }
  await expectFeedback(page, a.id, a.typ, antwortOk && regelOk);
  return a;
}

async function swWeiter(page: Page) {
  await page.keyboard.press('Enter');
  await page.getByRole('region', { name: 'Rückmeldung' }).waitFor({ state: 'detached' });
}

async function swSolve(page: Page, falsch: number[] = []): Promise<SAufgabe[]> {
  const done: SAufgabe[] = [];
  for (let i = 0; i < 60; i++) {
    const summary = page.locator('.summary');
    const task = page.locator('[data-task]');
    await Promise.race([summary.waitFor(), task.waitFor()]);
    if (await summary.isVisible()) return done;
    done.push(await swAnswer(page, true, !falsch.includes(i)));
    await swWeiter(page);
  }
  throw new Error('Training endet nicht');
}

// ---------- Zusammenfassen ----------

async function zJaNein(page: Page, nein: string[] = []) {
  const fragen = page.locator('[data-frage]');
  await fragen.first().waitFor();
  const n = await fragen.count();
  for (let i = 0; i < n; i++) {
    const f = fragen.nth(i);
    const id = (await f.getAttribute('data-frage'))!;
    await f.getByRole('button', { name: nein.includes(id) ? 'Nein' : 'Ja', exact: true }).click();
  }
}

/** Löst die angezeigte Teilübung richtig und prüft die Rückmeldung. */
async function zLoesen(page: Page): Promise<{ art: string; textId: string }> {
  const el = page.locator('[data-task]');
  await el.waitFor();
  const [art, textId, ns] = (await el.getAttribute('data-task'))!.split(':');
  const n = Number(ns);
  const t = zText(textId)!;
  await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
  switch (art) {
    case 'textsorte':
      await page.keyboard.press(String(Z_SORTEN.indexOf(t.textsorte) + 1));
      break;
    case 'einleitungPruefen': {
      const d = DEFEKTE[n % DEFEKTE.length];
      await page.keyboard.press(String(defektOptionen(t, d).indexOf(d) + 1));
      break;
    }
    case 'einleitungSchreiben':
      await page.getByLabel('Deine Einleitung').fill(t.einleitung);
      await page.getByRole('button', { name: /^Prüfen/ }).click();
      await zJaNein(page);
      await page.getByRole('button', { name: 'Auswerten' }).click();
      break;
    case 'struktur': {
      const starts = new Set(t.abschnitte.map((a) => a.von));
      for (let i = 1; i < t.absaetze.length; i++) if (starts.has(i)) await page.locator(`[data-grenze="${i}"]`).click();
      await page.getByRole('button', { name: 'Abschnitte prüfen' }).click();
      expect(await page.locator('[data-grenzen]').getAttribute('data-grenzen')).toBe('ok');
      for (let k = 0; k < t.abschnitte.length; k++) await page.locator(`[data-abschnitt="${k}"] [data-funktion="${t.abschnitte[k].funktion}"]`).click();
      await page.getByRole('button', { name: 'Funktionen prüfen' }).click();
      break;
    }
    case 'these':
      await page.locator(`[data-satz="${t.these[0]}-${t.these[1]}"]`).click();
      break;
    case 'kernBeispiel':
      await page.keyboard.press(t.kernBeispiel[n].art === 'kern' ? '1' : '2');
      break;
    case 'funktionsverb':
      await page.keyboard.press(String(verbOptionen(t, n).indexOf(t.abschnitte[n].verb) + 1));
      break;
    case 'fingertest': {
      const f = t.fingertest[n];
      const a = f.satz.indexOf(f.falsch);
      const toks = [...f.satz.matchAll(/\S+/g)];
      const i = toks.findIndex((m) => m.index! + m[0].length > a);
      await page.locator(`[data-wort="${i}"]`).click();
      await page.getByRole('button', { name: 'Prüfen' }).click();
      break;
    }
    case 'synonym':
      await page.keyboard.press(t.synonyme[n].gleich ? '1' : '2');
      break;
    case 'konjunktiv': {
      const k = t.konjunktiv[n];
      await page.getByLabel('Indirekte Rede').fill(k.loesungen[0]);
      await page.getByLabel('Indirekte Rede').press('Enter');
      expect(await page.locator('[data-form]').getAttribute('data-form'), `${textId} ${k.loesungen[0]}`).toBe('ok');
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      await page.keyboard.press(String(Z_REGELN.findIndex((r) => r.id === k.regel) + 1));
      break;
    }
    case 'verdichten': {
      const a = t.abschnitte[verdichtbar(t)[n]];
      await page.getByLabel('Dein Satz').fill(a.muster);
      await page.getByRole('button', { name: /^Vergleichen/ }).click();
      await zJaNein(page);
      await page.getByRole('button', { name: 'Auswerten' }).click();
      break;
    }
    case 'schlussWaehlen':
      await page.keyboard.press(String(schlussOptionen(t).findIndex((o) => o.art === 'richtig') + 1));
      break;
    case 'schlussSchreiben':
      await page.getByLabel('Dein Schluss').fill(t.schluss);
      await page.getByRole('button', { name: /^Vergleichen/ }).click();
      await zJaNein(page);
      await page.getByRole('button', { name: 'Auswerten' }).click();
      break;
  }
  await expectFeedback(page, `${art}:${textId}:${n}`, art, true);
  return { art, textId };
}

async function zWeiter(page: Page) {
  await page.getByRole('region', { name: 'Rückmeldung' }).getByRole('button', { name: /Weiter|Abschließen/ }).click();
  await page.getByRole('region', { name: 'Rückmeldung' }).waitFor({ state: 'detached' });
}

// ---------- Tests ----------

beforeAll(async () => {
  mkdirSync(SHOTS, { recursive: true });
  server = await preview({ preview: { port: PORT, strictPort: true }, logLevel: 'warn' });
  browser = await chromium.launch({ executablePath: CHROMIUM });
}, 60_000);

afterAll(async () => {
  await browser?.close();
  await new Promise<void>((r) => server?.httpServer.close(() => r()));
});

describe('Sprachrichtigkeit im Browser', () => {
  it('Lektion 1.1: Probe und Komma per Tastatur, falsche Antwort landet im Fehlerbuch', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await shot(page, 'desktop-heute-leer');
    await page.goto(`${BASE}#/lektion/1.1`);
    await page.getByRole('button', { name: 'Verstanden, zur geführten Übung' }).click();
    await page.locator('[data-task]').waitFor();
    await shot(page, 'desktop-sitzung-probe');
    // Regelkarte mit R
    await page.keyboard.press('r');
    await page.getByText('Regelkarte').first().waitFor();
    await shot(page, 'desktop-regelkarte');
    await page.keyboard.press('Escape');
    const tasks = await solveSession(page, [1]);
    expect(tasks.length).toBe(5);
    await shot(page, 'desktop-zusammenfassung');
    await page.goto(`${BASE}#/fehlerbuch`);
    await expect.poll(() => page.locator('.entry').count()).toBe(1);
    await shot(page, 'desktop-fehlerbuch');
    await ctx.close();
  }, 120_000);

  it('Probe: Verben falsch markiert, Komma richtig – die Aufgabe zählt als richtig', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/lektion/1.1`);
    await page.getByRole('button', { name: 'Verstanden, zur geführten Übung' }).click();
    for (let n = 0; n < 5; n++) {
      const { task } = await currentTask(page);
      if (task.typ !== 'probe') {
        await answer(page, true);
        await nextTask(page);
        continue;
      }
      const p = parseKomma(task.text);
      await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur());
      // Schritt 1: kein Verb markiert (falsch), Schritt 2: Kommas richtig
      await page.keyboard.press('Enter');
      await page.locator('.word[disabled], .word.res-fehlt').first().waitFor();
      await page.keyboard.press('Enter');
      await page.getByText('Schritt 2 von 2').waitFor();
      let cursor = 0;
      for (let i = 0; i < p.gaps.length; i++) {
        if (p.gaps[i] !== 'ja') continue;
        await moveCursor(page, cursor, i);
        cursor = i;
        await page.keyboard.press(' ');
      }
      await page.keyboard.press('Enter');
      const fb = page.getByRole('region', { name: 'Rückmeldung' });
      await fb.waitFor();
      expect(await fb.getAttribute('class'), task.id).toContain('ok');
      expect(await fb.innerText()).toContain('gewertet wird das Komma');
      await ctx.close();
      return;
    }
    throw new Error('keine Probe-Aufgabe in Lektion 1.1');
  }, 120_000);

  it('alle Übungstypen: richtig gelöst werden sie als richtig gewertet', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    const seen = new Set<string>();
    const phases: [string, string][] = [
      ['1.2', 'frei'],
      ['2.2', 'frei'],
      ['3.5', 'frei'],
      ['4.1', 'frei'],
      ['7.5', 'gefuehrt'],
      ['9.4', 'frei'],
      ['9.5', 'frei'],
      ['9.6', 'frei'],
      ['3.7', 'gefuehrt'],
      ['3.8', 'gefuehrt'],
      ['10.1', 'gefuehrt'],
    ];
    for (const [lektion, phase] of phases) {
      await page.goto(`${BASE}#/lektion/${lektion}`);
      const label = phase === 'gefuehrt' ? 'Geführte Übung' : 'Freie Übung';
      await page.locator('.list-item', { hasText: label }).first().click();
      const solved = await solveSession(page);
      for (const t of solved) seen.add(t.typ);
    }
    for (const typ of ['probe', 'komma', 'eintippen', 'entscheiden', 'umformen', 'fehler', 'wort', 'textwiedergabe', 'korrektur']) {
      expect(seen.has(typ), `Typ ${typ} wurde geprüft`).toBe(true);
    }
    await page.goto(`${BASE}#/statistik`);
    await shot(page, 'desktop-statistik-daten');
    await page.goto(`${BASE}#/kurse`);
    await shot(page, 'desktop-kurse-daten');
    await page.goto(`${BASE}#/kurse/3`);
    await shot(page, 'desktop-kurs3-daten');
    await ctx.close();
  }, 600_000);

  it('Fehlerbuch: manueller Eintrag mit eigener Aufgabe und fünf verwandten in der Wiederholung', async () => {
    const ctx = await newContext({ width: 820, height: 1180, touch: true });
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/fehlerbuch/neu`);
    const t0 = Date.now();
    await page.getByLabel('Quelle').fill('Deutschklausur 1, Erörterung');
    await page.getByLabel('So stand es da').fill('Er behauptet das die Lage ernst ist.');
    await page.getByLabel('So stand es da').press('Enter');
    const korr = page.getByLabel('Richtig');
    await expect.poll(() => korr.inputValue()).toBe('Er behauptet das die Lage ernst ist.');
    await korr.fill('Er behauptet, dass die Lage ernst ist.');
    await expect.poll(() => page.getByLabel('Fehlertyp').inputValue()).not.toBe('');
    await shot(page, 'tablet-fehlerbuch-erfassen');
    await korr.press('Enter');
    await page.getByText('Gerade erfasst (1)').waitFor();
    expect(Date.now() - t0).toBeLessThan(20_000);
    // zweiter Fehler derselben Arbeit, Quelle bleibt stehen
    await expect.poll(() => page.getByLabel('Quelle').inputValue()).toBe('Deutschklausur 1, Erörterung');
    await page.getByLabel('So stand es da').fill('wegen dem Regen');
    await page.getByLabel('So stand es da').press('Enter');
    await page.getByLabel('Richtig').fill('wegen des Regens');
    await page.getByLabel('Fehlertyp').selectOption('f-genitiv');
    await page.getByLabel('Richtig').press('Enter');
    await page.getByText('Gerade erfasst (2)').waitFor();
    // Heute: eigene Aufgaben plus verwandte sind fällig
    await page.goto(BASE);
    const reviewCard = page.locator('.card', { has: page.getByRole('heading', { name: 'Wiederholung' }) });
    const due = Number(await reviewCard.locator('.stat .value').innerText());
    expect(due).toBeGreaterThanOrEqual(12);
    await shot(page, 'tablet-heute');
    await reviewCard.getByRole('button', { name: /starten/ }).click();
    const solved = await solveSession(page);
    expect(solved.length).toBeGreaterThanOrEqual(12);
    expect(solved.filter((t) => t.id.startsWith('eigen-')).length).toBe(2);
    await page.goto(`${BASE}#/fehlerbuch/auswertung`);
    await shot(page, 'tablet-fehlerbuch-auswertung');
    await ctx.close();
  }, 300_000);

  it('Sicherung: Export und Import stellen alles wieder her; Statistik und Einstellungen', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/lektion/4.1`);
    await page.locator('.list-item', { hasText: 'Freie Übung' }).first().click();
    await solveSession(page, [0, 3]);
    await page.goto(`${BASE}#/fehlerbuch`);
    await expect.poll(() => page.locator('.entry').count()).toBe(2);
    await page.goto(`${BASE}#/statistik`);
    await shot(page, 'desktop-statistik');
    await page.goto(`${BASE}#/einstellungen`);
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'Sichern' }).click()]);
    const file = await download.path();
    const json = JSON.parse(readFileSync(file!, 'utf8'));
    expect(json.app).toBe('sprachrichtigkeit');
    expect(json.daten.errors.length).toBe(2);
    // Zurücksetzen
    await page.getByRole('button', { name: 'Zurücksetzen' }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Endgültig zurücksetzen' }).click();
    await page.goto(`${BASE}#/fehlerbuch`);
    await expect.poll(() => page.locator('.entry').count()).toBe(0);
    // Import
    await page.goto(`${BASE}#/einstellungen`);
    await page.locator('input[type=file]').setInputFiles(file!);
    await page.getByRole('dialog').getByRole('button', { name: 'Einspielen' }).click();
    await page.getByRole('dialog').waitFor({ state: 'detached' });
    await page.goto(`${BASE}#/fehlerbuch`);
    await expect.poll(() => page.locator('.entry').count()).toBe(2);
    await ctx.close();
  }, 180_000);

  it('Einstufungstest mit 40 Aufgaben', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Einstufung starten' }).click();
    const solved = await solveSession(page, [0, 5, 10]);
    expect(solved.length).toBe(40);
    const kurse = new Set(solved.map((t) => t.kurs));
    expect(kurse.size).toBeGreaterThanOrEqual(9);
    await shot(page, 'desktop-einstufung-ergebnis');
    await ctx.close();
  }, 600_000);

  it('Bildschirmgrößen und dunkles Design, ohne waagerechtes Scrollen', async () => {
    for (const v of [
      { name: 'phone', width: 390, height: 844, touch: true },
      { name: 'tablet', width: 820, height: 1180, touch: true },
      { name: 'desktop', width: 1280, height: 860 },
    ]) {
      for (const dark of [false, true]) {
        const ctx = await newContext({ ...v, dark });
        const page = await ctx.newPage();
        watchErrors(page);
        await onboard(page);
        for (const [route, name] of [
          ['', 'heute'],
          ['kurse', 'kurse'],
          ['kurse/1', 'kurs1'],
          ['lektion/3.3', 'lektion'],
          ['fehlerbuch', 'fehlerbuch'],
          ['fehlerbuch/neu', 'erfassen'],
          ['fehlerbuch/auswertung', 'auswertung'],
          ['statistik', 'statistik'],
          ['einstellungen', 'einstellungen'],
        ]) {
          await page.goto(`${BASE}#/${route}`);
          await page.locator('main').first().waitFor();
          await noOverflow(page, v.width, `${v.name} ${route}`);
          await shot(page, `${v.name}${dark ? '-dunkel' : ''}-${name}`);
        }
        await page.goto(`${BASE}#/lektion/10.1`);
        await page.locator('.list-item', { hasText: 'Geführte Übung' }).first().click();
        await page.locator('[data-task]').waitFor();
        await noOverflow(page, v.width, `${v.name} Korrekturlesen`);
        await shot(page, `${v.name}${dark ? '-dunkel' : ''}-korrektur`);
        await page.goto(`${BASE}#/lektion/1.4`);
        await page.locator('.list-item', { hasText: 'Geführte Übung' }).first().click();
        await answer(page, false);
        await noOverflow(page, v.width, `${v.name} Rückmeldung`);
        await shot(page, `${v.name}${dark ? '-dunkel' : ''}-rueckmeldung`);
        await ctx.close();
      }
    }
  }, 600_000);

  it('offline: Die App startet ohne Netz aus dem Zwischenspeicher', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    await page.reload();
    await page.waitForFunction(() => !!navigator.serviceWorker.controller);
    await ctx.setOffline(true);
    await page.reload();
    await page.getByRole('heading', { name: 'Wiederholung' }).waitFor();
    await page.goto(`${BASE}#/lektion/5.1`);
    await page.getByRole('heading', { name: /Verben als Nomen/ }).first().waitFor();
    await ctx.close();
  }, 120_000);

  it('Fehlerbuch: Suche, Bearbeiten, Löschen, CSV und Druckansicht', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/fehlerbuch/neu`);
    await page.getByLabel('Quelle').fill('Klausur 2; Textanalyse');
    for (const [orig, korr, typ] of [
      ['wegen dem Regen', 'wegen des Regens', 'f-genitiv'],
      ['Er glaubt das sie kommt.', 'Er glaubt, dass sie kommt.', 'k-nebensatz'],
    ]) {
      await page.getByLabel('So stand es da').fill(orig);
      await page.getByLabel('So stand es da').press('Enter');
      await page.getByLabel('Richtig').fill(korr);
      await page.getByLabel('Fehlertyp').selectOption(typ);
      await page.getByLabel('Richtig').press('Enter');
    }
    await page.getByText('Gerade erfasst (2)').waitFor();
    // Volltextsuche
    await page.goto(`${BASE}#/fehlerbuch`);
    await page.getByLabel('Volltextsuche').fill('Regen');
    await expect.poll(() => page.locator('.entry').count()).toBe(1);
    await page.getByLabel('Volltextsuche').fill('');
    await expect.poll(() => page.locator('.entry').count()).toBe(2);
    // Bearbeiten
    await page.locator('.entry', { hasText: 'wegen dem Regen' }).locator('.entry-text').click();
    await page.getByRole('link', { name: 'Bearbeiten' }).click();
    await page.getByLabel('Notiz').fill('Rotstift: Genitiv!');
    await page.getByRole('button', { name: 'Speichern', exact: true }).click();
    await page.waitForURL(/#\/fehlerbuch$/);
    await page.getByLabel('Volltextsuche').fill('Rotstift');
    await expect.poll(() => page.locator('.entry').count()).toBe(1);
    await page.getByLabel('Volltextsuche').fill('');
    // CSV: Semikolon, BOM, Feld mit Semikolon in Anführungszeichen
    const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: 'CSV' }).first().click()]);
    const csv = readFileSync((await download.path())!, 'utf8');
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toContain('Datum;Herkunft;Quelle');
    expect(lines).toHaveLength(3);
    expect(csv).toContain('"Klausur 2; Textanalyse"');
    // Druckansicht für das PDF
    await page.getByRole('link', { name: 'PDF' }).first().click();
    await page.getByRole('heading', { name: 'Fehlerbuch' }).waitFor();
    await expect.poll(() => page.locator('table tbody tr').count()).toBe(2);
    await shot(page, 'desktop-fehlerbuch-druck');
    // Löschen
    await page.goto(`${BASE}#/fehlerbuch`);
    await page.locator('.entry', { hasText: 'Er glaubt das sie kommt.' }).locator('.entry-text').click();
    await page.getByRole('button', { name: 'Löschen' }).first().click();
    await page.getByRole('dialog').getByRole('button', { name: 'Löschen' }).click();
    await expect.poll(() => page.locator('.entry').count()).toBe(1);
    await ctx.close();
  }, 180_000);

  it('Lektion am Stück: Knöpfe der Zusammenfassung führen zur freien Übung und zum Lektionstest', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/lektion/4.1`);
    await page.getByRole('button', { name: 'Verstanden, zur geführten Übung' }).click();
    expect(await solveSession(page)).toHaveLength(5);
    await page.getByRole('button', { name: /Weiter zur freien Übung/ }).click();
    await page.locator('[data-task]').waitFor();
    expect(await page.locator('.task-meta').innerText()).toContain('Freie Übung');
    expect((await solveSession(page)).length).toBeGreaterThanOrEqual(12);
    // per Enter, wie mit der Tastatur
    await page.getByRole('button', { name: /Weiter zum Lektionstest/ }).waitFor();
    await page.keyboard.press('Enter');
    await page.locator('[data-task]').waitFor();
    expect(await page.locator('.task-meta').innerText()).toContain('Lektionstest');
    expect(await solveSession(page)).toHaveLength(10);
    await page.getByRole('heading', { name: 'Lektionstest bestanden' }).waitFor();
    await ctx.close();
  }, 300_000);

  it('Lektionstest bis „Sicher“, Kurstest und Kursabschluss', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/lektion/4.1`);
    await page.locator('.list-item', { hasText: 'Lektionstest' }).first().click();
    const test = await solveSession(page, [3]);
    expect(test).toHaveLength(10);
    await page.getByRole('heading', { name: 'Lektionstest bestanden' }).waitFor();
    await page.getByText('Die Lektion ist jetzt „Sicher“.').waitFor();
    await page.goto(`${BASE}#/kurse/4`);
    await page.getByRole('button', { name: /Kurstest/ }).click();
    const kurstest = await solveSession(page, [7, 19]);
    expect(kurstest).toHaveLength(25);
    await page.getByRole('heading', { name: 'Kurstest bestanden' }).waitFor();
    await page.goto(`${BASE}#/kurse`);
    await page.locator('a, .list-item', { hasText: 'das oder dass' }).getByText('abgeschlossen').first().waitFor();
    await shot(page, 'desktop-kurse-abgeschlossen');
    await ctx.close();
  }, 300_000);

  it('Mischtraining „Fehlertyp bestimmen“ und „Vor der Klausur“ mit Prüfroutine', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/ueben`);
    await page.getByRole('group', { name: 'Sitzungslänge' }).getByRole('button', { name: '15 Aufgaben' }).click();
    await page.getByRole('button', { name: /^4 / }).click();
    await page.getByRole('button', { name: /^9 / }).click();
    await page.getByLabel(/Nur „Fehlertyp bestimmen“/).check();
    await page.getByRole('button', { name: 'Mischtraining starten' }).click();
    await page.locator('[data-task]').waitFor();
    expect(await page.locator('[data-task]').getAttribute('data-modus')).toBe('fehlertyp');
    await shot(page, 'desktop-fehlertyp-bestimmen');
    await solveSession(page, [2]);
    await page.goto(`${BASE}#/ueben`);
    await page.getByRole('button', { name: '15 Minuten starten' }).click();
    await page.locator('[data-task]').waitFor();
    await page.getByText(/noch 1[45] min/).waitFor();
    await solveSession(page);
    await page.getByRole('heading', { name: 'Jetzt die Prüfroutine' }).waitFor();
    const boxes = page.locator('.summary input[type=checkbox]');
    expect(await boxes.count()).toBeGreaterThanOrEqual(10);
    await boxes.first().check();
    await shot(page, 'desktop-pruefroutine');
    await ctx.close();
  }, 300_000);

  it('Zeitmodus: Die Aufgabe wird nach Ablauf der Zeit ausgewertet', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/einstellungen`);
    await page.getByRole('group', { name: 'Zeitmodus' }).getByRole('button', { name: 'An' }).click();
    await page.getByRole('group', { name: 'Sekunden je Aufgabe' }).getByRole('button', { name: '20 s' }).click();
    await page.goto(`${BASE}#/lektion/5.1`);
    await page.locator('.list-item', { hasText: 'Freie Übung' }).first().click();
    await page.getByRole('timer').waitFor();
    await page.getByRole('region', { name: 'Rückmeldung' }).waitFor({ timeout: 26_000 });
    await shot(page, 'desktop-zeitmodus');
    await ctx.close();
  }, 120_000);

  it('Bedienung per Antippen auf dem Handy', async () => {
    const ctx = await newContext({ width: 390, height: 844, touch: true });
    const page = await ctx.newPage();
    watchErrors(page);
    await page.goto(BASE);
    await page.getByRole('button', { name: 'Ohne Einstufung beginnen' }).tap();
    await page.goto(`${BASE}#/lektion/1.3`);
    await page.locator('.list-item', { hasText: 'Geführte Übung' }).first().tap();
    for (let n = 0; n < 5; n++) {
      const { task } = await currentTask(page);
      if (task.typ === 'probe' || task.typ === 'komma') {
        const p = parseKomma(task.text);
        if (task.typ === 'probe') {
          for (let i = 0; i < p.tokens.length; i++) if (p.tokens[i].verb) await page.locator('.sentence .word').nth(i).tap();
          await page.getByRole('button', { name: /Verben prüfen/ }).tap();
          await page.getByRole('button', { name: /Weiter: Kommas setzen/ }).tap();
        }
        for (let i = 0; i < p.gaps.length; i++) if (p.gaps[i] === 'ja') await page.locator('.sentence .gap').nth(i).tap();
        await page.getByRole('button', { name: /^Prüfen/ }).tap();
        const fb = page.getByRole('region', { name: 'Rückmeldung' });
        await fb.waitFor();
        expect(await fb.getAttribute('class'), task.id).toContain('ok');
      } else {
        await answer(page, true);
      }
      await page.getByRole('region', { name: 'Rückmeldung' }).getByRole('button', { name: /Weiter|Abschließen/ }).tap();
    }
    await page.locator('.summary').waitFor();
    await ctx.close();
  }, 180_000);

  it('Meine Schwächen: eigenes Fenster, Kursverweis, Training mit Regelwahl und Kontrollaufgabe, Erfassen, Checkliste', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    const [sw] = await Promise.all([ctx.waitForEvent('page'), page.getByRole('link', { name: /Meine Schwächen/ }).first().click()]);
    watchErrors(sw);
    await sw.getByRole('heading', { name: 'Meine Schwächen', level: 1 }).waitFor();
    expect(sw.url()).toContain('#/schwaechen');
    expect(await sw.evaluate(() => window.name)).toBe('sr-schwaechen');
    expect(await sw.locator('.ampel-card').count()).toBe(12);
    expect(await sw.locator('.ampel-card [data-ampel="rot"]').count()).toBe(12);
    await shot(sw, 'schwaechen-uebersicht');

    // Kategorie mit Verweis in den Kurs: öffnet im Hauptfenster, nicht hier
    await sw.locator('.ampel-card[data-kat="S1"]').click();
    await sw.getByRole('heading', { name: 'Konjunktiv', level: 1 }).waitFor();
    await shot(sw, 'schwaechen-kategorie');
    const link = sw.locator('[data-lektion="3.8"]').first();
    expect(await link.getAttribute('target')).toBe('sr-haupt');
    await link.click();
    await page.waitForURL(/#\/lektion\/3\.8/);
    expect(sw.url()).toContain('#/schwaechen/kat/S1');
    expect(ctx.pages().length).toBe(2);

    // Training: erste Antwort richtig, Regel falsch → Kontrollaufgabe folgt sofort
    await sw.locator('[data-start="S1"]').click();
    await sw.locator('[data-task]').waitFor();
    const erste = await swCurrent(sw);
    await solveExercise(sw, erste, '', true);
    await sw.locator('[data-phase="regel"]').waitFor();
    await shot(sw, 'schwaechen-regelwahl');
    const falscheRegel = regelOptionen(erste).find((o) => o.id !== erste.regel)!;
    await sw.locator(`[data-regel="${falscheRegel.id}"]`).click();
    await expectFeedback(sw, erste.id, erste.typ, false);
    const fb = sw.getByRole('region', { name: 'Rückmeldung' });
    expect(await fb.innerText()).toContain('Antwort richtig, Begründung falsch');
    expect(await fb.innerText()).toContain('Kontrollaufgabe');
    expect(await fb.innerText()).toContain('Entscheidungskette');
    await shot(sw, 'schwaechen-rueckmeldung');
    await sw.keyboard.press('Enter');
    await sw.getByText('Kontrollaufgabe', { exact: true }).waitFor();
    const kontrolle = await swCurrent(sw);
    expect(kontrolle.kat).toBe('S1');
    expect(kontrolle.id).not.toBe(erste.id);
    const rest = await swSolve(sw);
    expect(rest.length).toBe(10);
    await sw.locator('[data-meldung]').waitFor();
    expect(await sw.locator('[data-meldung]').innerText()).toMatch(/Stufe 1|morgen/);
    await shot(sw, 'schwaechen-ergebnis');
    await sw.getByRole('link', { name: 'Zur Übersicht' }).click();
    await sw.locator('.ampel-card[data-kat="S1"] [data-ampel="gelb"]').waitFor();

    // Fehler erfassen: daraus entstehen neue Aufgaben
    await sw.getByRole('link', { name: 'Fehler erfassen' }).click();
    await sw.getByLabel('So stand es da').fill('Die Autorin meint, die Lage wäre ernst.');
    await sw.getByLabel('So ist es richtig').fill('Die Autorin meint, die Lage sei ernst.');
    await sw.getByLabel('Kategorie').selectOption('S1');
    await sw.getByLabel('Quelle (freiwillig)').fill('Klausur Sozialstaat');
    await sw.getByRole('button', { name: 'Speichern' }).click();
    await sw.getByText(/2 neue Aufgaben/).waitFor();
    await sw.locator('[data-eintraege="1"]').waitFor();
    expect(await sw.getByLabel('So stand es da').inputValue()).toBe('');

    // Gemischtes Training mit Transfer-Absätzen; ein Fehler in der Begründung
    await sw.getByRole('link', { name: 'Übersicht' }).first().click();
    await sw.locator('[data-start="misch"]').click();
    const misch = await swSolve(sw, [3]);
    expect(misch.length).toBeGreaterThanOrEqual(15);
    expect(misch.filter((a) => a.kat === 'T').length).toBeGreaterThanOrEqual(2);
    expect(new Set(misch.map((a) => a.kat)).size).toBeGreaterThanOrEqual(5);
    await sw.getByRole('link', { name: 'Zur Übersicht' }).click();
    await sw.getByRole('heading', { name: 'Wiederholungstäter' }).waitFor();

    // Checkliste „Vor der Abgabe“
    await sw.getByRole('link', { name: 'Vor der Abgabe' }).first().click();
    const haken = sw.locator('[data-haken]');
    await haken.first().waitFor();
    expect(await haken.count()).toBe(3);
    for (let i = 0; i < 3; i++) await haken.nth(i).check();
    await shot(sw, 'schwaechen-checkliste');
    await sw.getByRole('button', { name: 'Text geprüft' }).click();
    await sw.getByText('Bisher 1 Text mit der Checkliste geprüft.', { exact: false }).waitFor();
    expect(await haken.nth(0).isChecked()).toBe(false);

    // Stand bleibt nach dem Neuladen; das Hauptfenster übernimmt ihn beim Zurückkehren
    await sw.reload();
    await sw.locator('[data-haken]').first().waitFor();
    await sw.goto(`${BASE}#/schwaechen`);
    await sw.locator('.ampel-card[data-kat="S1"] [data-ampel="gelb"]').waitFor();
    await ctx.close();
  });

  it('Meine Schwächen: Selbst schreiben, eigene Fassung übersteuern; Handy und dunkles Design', async () => {
    for (const v of [
      { width: 390, height: 844, dark: false, name: 'handy' },
      { width: 820, height: 1180, dark: true, name: 'tablet-dunkel' },
    ]) {
      const ctx = await newContext({ width: v.width, height: v.height, dark: v.dark, touch: v.width < 500 });
      const page = await ctx.newPage();
      watchErrors(page);
      await onboard(page);
      await page.goto(`${BASE}#/schwaechen`);
      await page.locator('.ampel-card').first().waitFor();
      await noOverflow(page, v.width, `Übersicht ${v.name}`);
      await shot(page, `schwaechen-${v.name}`);
      await page.goto(`${BASE}#/schwaechen/kat/S12`);
      await page.getByRole('heading', { name: /Aufzählungen/, level: 1 }).waitFor();
      await noOverflow(page, v.width, `Kategorie ${v.name}`);
      await page.locator('[data-start="S12"]').click();
      await page.locator('[data-task]').waitFor();
      // Bis zur ersten Schreibaufgabe richtig lösen, die dann bewusst mit dem Gegenbeispiel
      for (let i = 0; i < 12; i++) {
        const a = await swCurrent(page);
        if (a.typ === 'schreiben') {
          await solveExercise(page, a, '', false);
          await page.locator('[data-phase="regel"]').waitFor();
          await noOverflow(page, v.width, `Regelwahl ${v.name}`);
          await page.locator(`[data-regel="${a.regel}"]`).click();
          await expectFeedback(page, a.id, a.typ, false);
          await shot(page, `schwaechen-schreiben-${v.name}`);
          await page.getByRole('button', { name: 'Meine Fassung ist auch richtig' }).click();
          await page.getByRole('button', { name: 'Meine Fassung ist auch richtig' }).waitFor({ state: 'detached' });
          expect(await page.getByText('Gleich folgt eine ähnliche Kontrollaufgabe').count()).toBe(0);
          break;
        }
        await swAnswer(page);
        await swWeiter(page);
      }
      await ctx.close();
    }
  });

  it('Zusammenfassen: alle 13 Teilübungen mit je mindestens drei Texten', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/zusammenfassen`);
    // Stufe 3: alle Texte im Pool
    await page.getByRole('group', { name: 'Stufe' }).getByRole('button', { name: 'Stufe 3' }).click();
    for (const a of Z_ARTEN) {
      const texte = new Set<string>();
      for (let runde = 0; runde < 3 && texte.size < 3; runde++) {
        await page.goto(`${BASE}#/zusammenfassen/${a.teil}`);
        await page.locator(`[data-art="${a.id}"]`).click();
        for (let i = 0; i < 6 && texte.size < 3; i++) {
          const r = await zLoesen(page);
          expect(r.art).toBe(a.id);
          texte.add(r.textId);
          if (i === 0 && runde === 0) await shot(page, `zs-${a.id}`);
          await zWeiter(page);
          if (await page.locator('.summary').isVisible()) break;
        }
      }
      expect(texte.size, a.id).toBeGreaterThanOrEqual(3);
    }
    // Ergebnisse zählen in den Kategorien
    await page.goto(`${BASE}#/zusammenfassen`);
    await page.getByRole('group', { name: 'Stufe' }).waitFor();
    expect(await page.locator('[data-kat="dazugedichtet"] [data-ampel]').getAttribute('data-ampel')).toBe('gruen');
    await shot(page, 'zs-uebersicht');
    await ctx.close();
  }, 600_000);

  it('Zusammenfassen: ganzer Text mit Plan, Checkliste, KI, Vergleich, Überarbeitung; Stand nach Neustart', async () => {
    const ctx = await newContext();
    const page = await ctx.newPage();
    watchErrors(page);
    // Lokale KI als Attrappe
    await page.route('http://localhost:11434/**', async (route) => {
      const url = route.request().url();
      if (url.endsWith('/api/tags')) return route.fulfill({ json: { models: [{ name: 'qwen2.5:7b' }] } });
      return route.fulfill({ json: { message: { content: JSON.stringify({ fehler: [{ kategorie: 'Präteritum', stelle: 'stellte dar', art: 'Präteritum statt Präsens' }] }) } } });
    });
    await onboard(page);
    await page.goto(`${BASE}#/zusammenfassen/ki`);
    await page.getByLabel('KI verwenden').check();
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.getByRole('button', { name: 'Verbindung testen' }).click();
    await page.getByText('Verbunden. Modell').waitFor();

    await page.goto(`${BASE}#/zusammenfassen`);
    await page.locator('[data-start="volltext"]').click();
    await page.locator('[data-phase="plan"]').waitFor();
    const titel = await page.locator('.zs-titel').first().innerText();
    const t = [...Array(80).keys()].map((i) => zText(`Z${String(i).padStart(2, '0')}`)).find((x) => x && x.titel === titel)!;
    expect(t).toBeTruthy();
    await page.locator(`[data-these="${t.these[0]}"]`).click();
    await page.locator('[data-plan="0"] select').selectOption(t.abschnitte[0].funktion);
    await page.locator('[data-plan="0"] input').first().fill(t.abschnitte[0].verb);
    await shot(page, 'zs-volltext-plan');
    await page.getByRole('button', { name: 'Weiter zum Schreiben' }).click();
    const feld = page.getByLabel('Deine Zusammenfassung');
    await feld.fill(musterGesamt(t));
    await page.getByRole('timer').waitFor();
    await shot(page, 'zs-volltext-schreiben');
    await page.getByRole('button', { name: 'Fertig, zur Selbstprüfung' }).click();
    await page.getByRole('button', { name: 'KI-Rückmeldung holen' }).click();
    await page.getByText('Präteritum statt Präsens').waitFor();
    await zJaNein(page, ['laenge']);
    await shot(page, 'zs-volltext-pruefen');
    await page.getByRole('button', { name: 'Weiter zur Musterlösung' }).click();
    await page.locator('[data-muster]').waitFor();
    await shot(page, 'zs-volltext-vergleich');
    await page.getByRole('button', { name: 'Einmal überarbeiten' }).click();
    await page.getByLabel('Deine Zusammenfassung').fill(musterGesamt(t));
    await page.getByRole('button', { name: 'Fertig, zur Selbstprüfung' }).click();
    await zJaNein(page);
    await page.getByRole('button', { name: 'Weiter zur Musterlösung' }).click();
    await page.getByText('Nach der Überarbeitung verneint').waitFor();
    expect(await page.getByRole('button', { name: 'Einmal überarbeiten' }).count()).toBe(0);
    // Nächster Text startet sofort
    await page.getByRole('button', { name: 'Nächster Text' }).click();
    await page.locator('[data-phase="plan"]').waitFor();
    expect(await page.locator('.zs-titel').first().innerText()).not.toBe(titel);

    // Neustart: Stand bleibt
    await page.reload();
    await page.goto(`${BASE}#/zusammenfassen`);
    await page.getByRole('heading', { name: 'Deine Zusammenfassungen' }).waitFor();
    expect(await page.locator('[data-kat="laenge"]').innerText()).toContain('1 von 2 richtig');
    expect(await page.locator('[data-kat="these"]').innerText()).toContain('2 von 2 richtig');
    await page.getByRole('link', { name: 'Weiterschreiben' }).waitFor();
    await ctx.close();
  }, 180_000);

  it('Zusammenfassen: eigener Text aus dem Unterricht mit Musterlösung; Handy und dunkles Design', async () => {
    const ctx = await newContext({ width: 390, height: 844, touch: true, dark: true });
    const page = await ctx.newPage();
    watchErrors(page);
    await onboard(page);
    await page.goto(`${BASE}#/zusammenfassen`);
    await page.getByRole('heading', { name: 'Zusammenfassen', level: 1 }).waitFor();
    await noOverflow(page, 390, 'Zusammenfassen Übersicht');
    await shot(page, 'zs-handy-uebersicht');
    await page.goto(`${BASE}#/zusammenfassen/eigene`);
    await page.getByLabel('Titel').fill('Erst muss alles zerfallen');
    await page.getByLabel('Verfasser').fill('Thomas Mayer');
    await page.getByLabel('Erschienen (Ort, Datum)').fill('Die Weltwoche, 24.09.2025');
    const absatz = 'Der Staat hat sich als Allversicherer gegen jede Krise unverzichtbar gemacht, und mit jeder Rettung wird er mächtiger. ';
    await page.getByLabel('Text (Absätze durch eine Leerzeile trennen)').fill(`${absatz.repeat(3)}\n\n${absatz.repeat(2)}\n\n${absatz}`);
    await page.getByLabel('Musterlösung (freiwillig)').fill('Der Autor vertritt die These, der Sozialstaat sei nicht mehr reformierbar.');
    await page.getByRole('button', { name: 'Speichern' }).click();
    await page.locator('[data-eigene="1"]').waitFor();
    await page.getByRole('button', { name: 'Zusammenfassen', exact: true }).click();
    await page.locator('[data-phase="plan"]').waitFor();
    await noOverflow(page, 390, 'Schreibplan');
    await page.getByRole('button', { name: 'Weiter zum Schreiben' }).click();
    await page.getByLabel('Deine Zusammenfassung').fill('In seinem Kommentar „Erst muss alles zerfallen“, erschienen am 24.09.2025 in der Weltwoche, setzt sich Thomas Mayer mit dem Sozialstaat auseinander. Er behauptet, der Staat sei als Allversicherer unverzichtbar geworden.');
    await shot(page, 'zs-handy-schreiben');
    await page.getByRole('button', { name: 'Fertig, zur Selbstprüfung' }).click();
    await zJaNein(page);
    await noOverflow(page, 390, 'Selbstprüfung');
    await page.getByRole('button', { name: 'Weiter zur Musterlösung' }).click();
    await page.getByText('Musterlösung (eingefügt)').waitFor();
    await page.goto(`${BASE}#/zusammenfassen/hauptteil`);
    await page.locator('[data-art="struktur"]').click();
    await page.locator('[data-task]').waitFor();
    await noOverflow(page, 390, 'Struktur erkennen');
    await shot(page, 'zs-handy-struktur');
    await ctx.close();
  }, 180_000);

  it('keine Fehler in der Konsole', () => {
    const relevant = pageErrors.filter((e) => !/net::ERR_INTERNET_DISCONNECTED|Failed to load resource/.test(e));
    expect(relevant).toEqual([]);
  });
});
