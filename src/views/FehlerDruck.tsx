import { useMemo } from 'react';
import { Icon } from '../components/Icon';
import { dayKey, formatDay, formatDayNumeric } from '../lib/dates';
import { allStatuses, STATUS_LABEL } from '../lib/errorbook';
import { fehlertyp } from '../lib/fehlertypen';
import { typo } from '../lib/normalize';
import { useApp } from '../lib/store';
import { applyFilter, filterFromQuery } from './Fehlerbuch';

export function FehlerDruck({ query }: { query: URLSearchParams }) {
  const data = useApp();
  const statuses = useMemo(() => allStatuses(data.attempts, data.errors), [data.attempts, data.errors]);
  const f = filterFromQuery(query);
  const entries = applyFilter(data.errors, statuses, f);
  const hasFilter = query.toString().length > 0;
  return (
    <div className="print-page">
      <div className="no-print row wrap" style={{ marginBottom: 20, gap: 10 }}>
        <a className="btn" href={`#/fehlerbuch${hasFilter ? `?${query.toString()}` : ''}`}>
          <Icon name="chevronLeft" /> Zurück
        </a>
        <button className="btn primary" onClick={() => window.print()}>
          <Icon name="print" /> Drucken oder als PDF sichern
        </button>
        <span className="small muted">Im Druckdialog „Als PDF sichern“ wählen.</span>
      </div>
      <h1>Fehlerbuch</h1>
      <p style={{ color: '#555' }}>
        Stand {formatDay(dayKey())} · {entries.length} {entries.length === 1 ? 'Eintrag' : 'Einträge'}
        {hasFilter ? ' · gefiltert' : ''}
      </p>
      <table>
        <thead>
          <tr>
            <th style={{ width: '10%' }}>Datum</th>
            <th style={{ width: '16%' }}>Fehlertyp</th>
            <th style={{ width: '30%' }}>So stand es da</th>
            <th style={{ width: '30%' }}>Richtig</th>
            <th style={{ width: '14%' }}>Quelle · Status</th>
          </tr>
        </thead>
        <tbody>
          {entries.map((e) => (
            <tr key={e.id}>
              <td>{formatDayNumeric(e.tag)}</td>
              <td>
                {fehlertyp(e.fehlertyp)?.label}
                <div style={{ color: '#666' }}>Lektion {e.lektion}</div>
              </td>
              <td className="read">{typo(e.original)}</td>
              <td className="read">
                {typo(e.korrektur)}
                {e.notiz ? <div style={{ color: '#666', fontFamily: 'var(--font-ui)' }}>Notiz: {e.notiz}</div> : null}
              </td>
              <td>
                {e.herkunft === 'app' ? 'App' : e.quelle}
                <div style={{ color: '#666' }}>{STATUS_LABEL[statuses.get(e.id)?.status ?? 'offen']}</div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
