// Export des Fehlerbuchs (CSV) und allgemeiner Download.

import { fehlertyp, bereichLabel } from './fehlertypen';
import { formatDayNumeric } from './dates';
import { STATUS_LABEL, type StatusInfo } from './errorbook';
import type { ErrorEntry } from './types';

function csvField(v: string | number | undefined): string {
  const s = v === undefined ? '' : String(v);
  return /[";\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function errorsToCsv(entries: ErrorEntry[], statuses: Map<string, StatusInfo>): string {
  const head = ['Datum', 'Herkunft', 'Quelle', 'Kurs', 'Lektion', 'Bereich', 'Fehlertyp', 'So stand es da', 'Richtig', 'Status', 'Begründung', 'Notiz'];
  const rows = entries.map((e) => {
    const ft = fehlertyp(e.fehlertyp);
    return [
      formatDayNumeric(e.tag),
      e.herkunft === 'app' ? 'App' : 'Arbeit',
      e.quelle,
      e.kurs,
      e.lektion,
      ft ? bereichLabel(ft.bereich) : '',
      ft?.label ?? e.fehlertyp,
      e.original,
      e.korrektur,
      STATUS_LABEL[statuses.get(e.id)?.status ?? 'offen'],
      e.begruendung ?? '',
      e.notiz ?? '',
    ].map(csvField);
  });
  return '﻿' + [head.map(csvField), ...rows].map((r) => r.join(';')).join('\r\n') + '\r\n';
}

export function download(filename: string, content: string, mime: string) {
  const blob = new Blob([content], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 2000);
}
