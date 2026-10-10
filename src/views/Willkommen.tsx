import { Icon } from '../components/Icon';
import { startPlacement } from '../lib/start';
import { updateSettings } from '../lib/store';

export function Willkommen() {
  const finish = async (placement: boolean) => {
    await updateSettings({ onboardingErledigt: true });
    if (placement) await startPlacement();
  };
  return (
    <div className="practice">
      <main className="practice-body" style={{ maxWidth: 640, paddingTop: 56 }}>
        <div className="brand" style={{ padding: 0, marginBottom: 32 }}>
          <span className="brand-mark" aria-hidden="true">
            ß
          </span>
          Sprachrichtigkeit
        </div>
        <h1 style={{ fontSize: 32 }}>Fehlerfrei schreiben, Satz für Satz.</h1>
        <p className="lead" style={{ fontSize: 17 }}>
          Für jeden Fehlertyp gibt es genau eine Probe: einen Handgriff, den du mechanisch am eigenen Satz durchführst. Die App lehrt nur diese eine Probe – und übt sie, bis sie sitzt.
        </p>
        <div className="stack" style={{ marginTop: 32 }}>
          {[
            { icon: 'kurse', t: 'Kurse', d: 'Zehn Kurse von der Kommasetzung bis zum Korrekturlesen. Jede Lektion: Regelkarte, geführte Übung, freie Übung, Test.' },
            { icon: 'repeat', t: 'Tägliche Wiederholung', d: 'Fehler kehren nach 1, 3, 7, 16 und 35 Tagen zurück, gemischt aus allen Kursen.' },
            { icon: 'fehlerbuch', t: 'Fehlerbuch', d: 'Jeder Fehler wird festgehalten – aus der App und aus deinen korrigierten Klausuren – und in gezielte Übung verwandelt.' },
          ].map((x) => (
            <div key={x.t} className="row" style={{ alignItems: 'flex-start', gap: 14 }}>
              <span className="brand-mark" style={{ background: 'var(--accent-soft)', color: 'var(--accent)', flex: 'none' }}>
                <Icon name={x.icon} />
              </span>
              <div>
                <div className="title-line">{x.t}</div>
                <div className="sub-line">{x.d}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="card" style={{ marginTop: 36 }}>
          <h2 style={{ marginBottom: 8 }}>Einstufungstest</h2>
          <p className="muted">40 Aufgaben quer durch alle Kurse, etwa 15 Minuten, ohne Zeitdruck. Das Ergebnis setzt deinen Ausgangsstand je Kurs und schlägt eine Reihenfolge vor: die schwächsten Kurse zuerst. Nichts ist gesperrt.</p>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button className="btn primary" onClick={() => finish(true)} autoFocus>
              Einstufung starten
            </button>
            <button className="btn ghost" onClick={() => finish(false)}>
              Ohne Einstufung beginnen
            </button>
          </div>
        </div>
        <p className="small muted" style={{ marginTop: 24 }}>
          Alle Daten bleiben auf diesem Gerät. Kein Konto, kein Server, kein Tracking.
        </p>
      </main>
    </div>
  );
}
