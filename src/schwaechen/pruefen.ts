// Auswertung selbst geschriebener Sätze: Jede Prüfung nennt Muster, die vorkommen müssen, und Muster, die fehlen müssen.

import { normalizeAnswer } from '../lib/normalize';
import type { SPruefung } from './typen';

export interface SchreibErgebnis {
  richtig: boolean;
  teile: { label: string; ok: boolean }[];
}

/** Doppelte Anführungszeichen werden für die Prüfung auf „ “ vereinheitlicht, alles andere bleibt, wie getippt. */
function vorbereiten(s: string): string {
  return normalizeAnswer(s).replace(/"/g, '„');
}

export function pruefeSchreiben(antwort: string, pruefungen: SPruefung[]): SchreibErgebnis {
  const text = vorbereiten(antwort);
  const teile = pruefungen.map((p) => {
    const muss = p.muss.every((m) => new RegExp(m, 'u').test(text));
    const nicht = p.nicht.every((m) => !new RegExp(m, 'u').test(text));
    return { label: p.label, ok: muss && nicht };
  });
  const satz = /[A-ZÄÖÜ]/.test(text.charAt(0)) && /[.!?]$/.test(text) && text.split(/\s+/).length >= 4;
  return { richtig: satz && teile.every((t) => t.ok), teile: [...teile, { label: 'Ganzer Satz mit Großbuchstabe am Anfang und Satzzeichen am Ende', ok: satz }] };
}
