// Optionale KI-Rückmeldung über ein lokales Sprachmodell (Ollama, http://localhost:11434).
// Die Daten verlassen den Rechner nicht. Ohne eingerichtete KI bleibt es bei Checkliste und Musterlösung.

import { KATEGORIEN } from './daten';
import type { ZKi } from './typen';

export interface KiFehler {
  kategorie: string;
  stelle: string;
  art: string;
}

export interface KiAntwort {
  fehler: KiFehler[];
  roh: string;
}

export const KI_REGELN = [
  'Einleitung: Autor, Titel, Textsorte, Erscheinungsort und -datum, Thema und Kernaussage in höchstens zwei Sätzen.',
  'Hauptteil: etwa ein Satz pro Sinnabschnitt, eigene Satzbauweise, Funktionsverben (stellt dar, widerspricht, schlägt vor, fordert, beruft sich auf), Präsens.',
  'Behauptungen des Autors im Konjunktiv: Singular Konjunktiv I; Plural würden + Infinitiv, außer seien und hätten. Handlungen des Autors im Indikativ. Nach „dass“ ist der Indikativ erlaubt.',
  'Keine Zeilenangaben, keine Umgangssprache, keine eigene Wertung, nichts dazudichten, Kern statt Beispiel, keine Abschwächung (müssen wird nicht zu sollte).',
  'Schluss: Gesamtaussage in ein bis zwei Sätzen. Insgesamt knapp, etwa zehn Sätze.',
];

export function kiSystemPrompt(): string {
  return [
    'Du bist eine Deutschlehrkraft der gymnasialen Oberstufe in Baden-Württemberg und prüfst die strukturierte Textwiedergabe eines Sachtextes.',
    'Bewerte sachlich und ohne Lob. Prüfe nur diese Kategorien:',
    ...KATEGORIEN.map((k) => `- ${k.label}: ${k.frage}`),
    'Es gelten diese Erwartungen:',
    ...KI_REGELN.map((r) => `- ${r}`),
    'Nenne zu jedem Fehler die Stelle als wörtliches Zitat aus der Zusammenfassung (höchstens zwölf Wörter), die Kategorie (genau eine Bezeichnung aus der Liste) und die Fehlerart in einem kurzen Satz.',
    'Schreibe keine verbesserte Fassung, keine Musterlösung und keine Formulierungsvorschläge.',
    'Antworte ausschließlich mit JSON in dieser Form: {"fehler":[{"kategorie":"…","stelle":"…","art":"…"}]}. Findest du keinen Fehler, antworte mit {"fehler":[]}.',
  ].join('\n');
}

function basis(ki: ZKi): string {
  return ki.url.replace(/\/+$/, '');
}

export function kiAntwortLesen(roh: string): KiFehler[] {
  const m = roh.match(/\{[\s\S]*\}/);
  if (!m) return [];
  try {
    const j = JSON.parse(m[0]) as { fehler?: unknown };
    if (!Array.isArray(j.fehler)) return [];
    return j.fehler
      .filter((f): f is Record<string, unknown> => !!f && typeof f === 'object')
      .map((f) => ({ kategorie: String(f.kategorie ?? ''), stelle: String(f.stelle ?? ''), art: String(f.art ?? '') }))
      .filter((f) => f.art || f.stelle);
  } catch {
    return [];
  }
}

export async function kiRueckmeldung(ki: ZKi, quelltext: string, zusammenfassung: string, signal?: AbortSignal): Promise<KiAntwort> {
  const res = await fetch(`${basis(ki)}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    signal,
    body: JSON.stringify({
      model: ki.modell,
      stream: false,
      format: 'json',
      options: { temperature: 0.1 },
      messages: [
        { role: 'system', content: kiSystemPrompt() },
        { role: 'user', content: `ORIGINALTEXT:\n${quelltext}\n\nZUSAMMENFASSUNG:\n${zusammenfassung}` },
      ],
    }),
  });
  if (!res.ok) throw new Error(`Die KI antwortet mit Fehler ${res.status}.`);
  const j = (await res.json()) as { message?: { content?: string } };
  const roh = j.message?.content ?? '';
  return { fehler: kiAntwortLesen(roh), roh };
}

/** Prüft die Verbindung und ob das Modell installiert ist. */
export async function kiTesten(ki: ZKi): Promise<{ ok: boolean; text: string; modelle: string[] }> {
  try {
    const res = await fetch(`${basis(ki)}/api/tags`);
    if (!res.ok) return { ok: false, text: `Ollama antwortet mit Fehler ${res.status}.`, modelle: [] };
    const j = (await res.json()) as { models?: { name: string }[] };
    const modelle = (j.models ?? []).map((m) => m.name);
    const da = modelle.some((m) => m === ki.modell || m.split(':')[0] === ki.modell);
    return da
      ? { ok: true, text: `Verbunden. Modell „${ki.modell}“ ist installiert.`, modelle }
      : { ok: false, text: `Verbunden, aber das Modell „${ki.modell}“ fehlt. Installiert: ${modelle.join(', ') || 'keins'}.`, modelle };
  } catch {
    return { ok: false, text: 'Keine Verbindung. Läuft Ollama auf diesem Rechner?', modelle: [] };
  }
}
