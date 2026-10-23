// Aktionen des Moduls „Zusammenfassen“: alles, was den gespeicherten Stand ändert.

import { dayKey } from '../lib/dates';
import { uid } from '../lib/random';
import { navigate } from '../lib/router';
import { getState, updateZusammenfassen } from '../lib/store';
import { KATEGORIEN } from './daten';
import { sitzungItems } from './logik';
import type { ZArt, ZEigenerText, ZItem, ZKat, ZKi, ZVolltext } from './typen';

const S = () => getState().zusammenfassen;

export async function starteSitzung(opts: { titel: string; zurueck: string; arten: ZArt[]; n: number }): Promise<boolean> {
  const items = sitzungItems(S(), opts.arten, opts.n, dayKey(), `${opts.arten.join(',')}:${Date.now()}`);
  if (!items.length) return false;
  await updateZusammenfassen((s) => ({
    ...s,
    sitzung: { id: uid(), titel: opts.titel, arten: opts.arten, zurueck: opts.zurueck, items, index: 0, ergebnisse: [], gestartet: Date.now() },
    letzte: undefined,
  }));
  navigate('/zusammenfassen/uebung');
  return true;
}

/** Speichert das Ergebnis der aktuellen Teilübung und die Ereignisse je Fehlerkategorie. */
export async function ergebnisSpeichern(item: ZItem, richtig: boolean, kats: { kat: ZKat; ok: boolean }[]) {
  const zeit = Date.now();
  const tag = dayKey(zeit);
  await updateZusammenfassen((s) => {
    const sitz = s.sitzung;
    return {
      ...s,
      uebungen: [...s.uebungen, { zeit, tag, art: item.art, textId: item.textId, n: item.n, richtig }],
      ereignisse: [...s.ereignisse, ...kats.map((k) => ({ zeit, tag, kat: k.kat, ok: k.ok, quelle: item.art, textId: item.textId }))],
      sitzung: sitz ? { ...sitz, index: sitz.index + 1, ergebnisse: [...sitz.ergebnisse, { art: item.art, textId: item.textId, richtig }] } : sitz,
    };
  });
}

export async function sitzungBeenden() {
  await updateZusammenfassen((s) => ({ ...s, sitzung: null, letzte: s.sitzung ?? s.letzte }));
}

export async function sitzungAbbrechen() {
  await updateZusammenfassen((s) => ({ ...s, sitzung: null }));
}

// ---------- Ganze Zusammenfassung ----------

export async function volltextStarten(textId: string, absaetze: number, eigen = false): Promise<string> {
  const id = uid();
  const v: ZVolltext = {
    id,
    textId,
    eigen: eigen || undefined,
    start: Date.now(),
    phase: 'plan',
    plan: Array.from({ length: absaetze }, (_, i) => ({ von: i, bis: i, funktion: '', verb: '', woerter: [] })),
    theseAbsatz: null,
    fassung1: '',
  };
  await updateZusammenfassen((s) => ({ ...s, volltexte: [...s.volltexte, v] }));
  navigate(`/zusammenfassen/schreiben/${id}`);
  return id;
}

export async function volltextAendern(id: string, patch: Partial<ZVolltext>) {
  await updateZusammenfassen((s) => ({ ...s, volltexte: s.volltexte.map((v) => (v.id === id ? { ...v, ...patch } : v)) }));
}

/** Checkliste speichern: Jedes „Nein“ zählt als Fehler in seiner Kategorie. */
export async function checklisteSpeichern(id: string, runde: 1 | 2, antworten: Record<string, boolean>) {
  const zeit = Date.now();
  const tag = dayKey(zeit);
  await updateZusammenfassen((s) => {
    const v = s.volltexte.find((x) => x.id === id);
    if (!v) return s;
    const ev = KATEGORIEN.filter((k) => k.id in antworten).map((k) => ({ zeit, tag, kat: k.id, ok: !!antworten[k.id], quelle: 'volltext' as const, textId: v.textId }));
    const patch: Partial<ZVolltext> = runde === 1 ? { check1: antworten, phase: 'vergleich' } : { check2: antworten, phase: 'fertig', ende: zeit };
    return { ...s, ereignisse: [...s.ereignisse, ...ev], volltexte: s.volltexte.map((x) => (x.id === id ? { ...x, ...patch } : x)) };
  });
}

export async function volltextLoeschen(id: string) {
  await updateZusammenfassen((s) => ({ ...s, volltexte: s.volltexte.filter((v) => v.id !== id) }));
}

// ---------- Eigene Texte, Einstellungen ----------

export async function eigenenTextSpeichern(t: Omit<ZEigenerText, 'id' | 'zeit'>): Promise<string> {
  const id = `eigen-${uid()}`;
  await updateZusammenfassen((s) => ({ ...s, eigeneTexte: [...s.eigeneTexte, { ...t, id, zeit: Date.now() }] }));
  return id;
}

export async function eigenenTextLoeschen(id: string) {
  await updateZusammenfassen((s) => ({ ...s, eigeneTexte: s.eigeneTexte.filter((t) => t.id !== id) }));
}

export async function niveauSetzen(n: 1 | 2 | 3 | undefined) {
  await updateZusammenfassen((s) => ({ ...s, niveau: n }));
}

export async function kiSpeichern(ki: ZKi) {
  await updateZusammenfassen((s) => ({ ...s, ki }));
}
