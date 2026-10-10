import { useState } from 'react';
import { Icon } from '../components/Icon';
import { toast } from '../components/ui';
import { BANK } from '../lib/content';
import { dayKey } from '../lib/dates';
import { BEREICHE, FEHLERTYPEN } from '../lib/fehlertypen';
import { dueCount } from '../lib/sessions';
import { startKlausur, startMixed, startPlacement, startReview, startTargeted } from '../lib/start';
import { useApp } from '../lib/store';

const SIZES = [15, 30, 50] as const;

export function Ueben() {
  const data = useApp();
  const [size, setSize] = useState<number>(data.settings.sitzungslaenge);
  const [kurse, setKurse] = useState<number[]>(() => BANK.courses.filter((c) => c.id !== 10).map((c) => c.id));
  const [nurTyp, setNurTyp] = useState(false);
  const [typen, setTypen] = useState<string[]>([]);
  const due = dueCount(data, dayKey());

  const toggleKurs = (k: number) => setKurse((ks) => (ks.includes(k) ? ks.filter((x) => x !== k) : [...ks, k].sort((a, b) => a - b)));
  const toggleTyp = (t: string) => setTypen((ts) => (ts.includes(t) ? ts.filter((x) => x !== t) : [...ts, t]));

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Üben</h1>
          <p className="lead">Die Aufgaben verschiedener Kurse erscheinen durchmischt. So erkennst du den Fehlertyp selbst – wie in der Klausur.</p>
        </div>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Sitzungslänge</h2>
        </div>
        <div className="segmented" role="group" aria-label="Sitzungslänge">
          {SIZES.map((n) => (
            <button key={n} aria-pressed={size === n} onClick={() => setSize(n)}>
              {n} Aufgaben
            </button>
          ))}
        </div>
      </div>

      <div className="section grid-2">
        <div className="card">
          <div className="card-title">
            <h3>Tägliche Wiederholung</h3>
            <Icon name="repeat" className="muted" />
          </div>
          <p className="small muted">
            {due ? `${due} fällig.` : 'Nichts fällig.'} Etwa 60 Prozent fällige Aufgaben, 30 Prozent aus deinen schwächsten Fehlertypen, 10 Prozent aus gemeisterten Lektionen.
          </p>
          <button className="btn primary wide" style={{ marginTop: 14 }} onClick={() => startReview(size)}>
            Wiederholung starten
          </button>
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Vor der Klausur</h3>
            <Icon name="timer" className="muted" />
          </div>
          <p className="small muted">15 Minuten aus deinen häufigsten eigenen Fehlertypen, danach die Prüfroutine aus Kurs 10 als Checkliste.</p>
          <button className="btn wide" style={{ marginTop: 14 }} onClick={() => startKlausur()}>
            15 Minuten starten
          </button>
        </div>
      </div>

      <div className="section">
        <h2>Mischtraining</h2>
        <div className="card">
          <div className="field">
            <span className="label">Kurse</span>
            <div className="chips">
              {BANK.courses
                .filter((c) => c.id !== 10)
                .map((c) => (
                  <button key={c.id} className="chip" aria-pressed={kurse.includes(c.id)} onClick={() => toggleKurs(c.id)}>
                    {c.id} {c.kurztitel}
                  </button>
                ))}
            </div>
          </div>
          <label className="check" style={{ marginTop: 14 }}>
            <input type="checkbox" checked={nurTyp} onChange={(e) => setNurTyp(e.target.checked)} />
            <span>
              Nur „Fehlertyp bestimmen“ <span className="muted small">– erst den Fehlertyp benennen, dann korrigieren</span>
            </span>
          </label>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button
              className="btn primary"
              disabled={!kurse.length}
              onClick={async () => {
                const ok = await startMixed(kurse, nurTyp, size);
                if (!ok) toast('Für diese Auswahl gibt es keine passenden Aufgaben.');
              }}
            >
              <Icon name="shuffle" /> Mischtraining starten
            </button>
          </div>
        </div>
      </div>

      <div className="section">
        <h2>Gezielt üben</h2>
        <div className="card">
          <p className="small muted" style={{ marginBottom: 14 }}>
            Wähle einen oder mehrere Fehlertypen.
          </p>
          <div className="stack">
            {BEREICHE.map((b) => (
              <div key={b.id}>
                <div className="eyebrow" style={{ marginBottom: 6 }}>
                  {b.label}
                </div>
                <div className="chips">
                  {FEHLERTYPEN.filter((t) => t.bereich === b.id).map((t) => (
                    <button key={t.id} className="chip" aria-pressed={typen.includes(t.id)} onClick={() => toggleTyp(t.id)}>
                      {t.label}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
          <div className="actions" style={{ justifyContent: 'flex-start' }}>
            <button
              className="btn primary"
              disabled={!typen.length}
              onClick={async () => {
                const ok = await startTargeted(typen, Math.min(size, 30));
                if (!ok) toast('Für diese Auswahl gibt es keine passenden Aufgaben.');
              }}
            >
              <Icon name="target" /> {typen.length ? `${typen.length === 1 ? 'Einen Fehlertyp' : `${typen.length} Fehlertypen`} üben` : 'Fehlertyp wählen'}
            </button>
          </div>
        </div>
      </div>

      <div className="section grid-2">
        <a className="card" href="#/kurse/10" style={{ color: 'inherit' }}>
          <div className="row">
            <Icon name="text" />
            <div className="grow">
              <div className="title-line">Korrekturlesen</div>
              <div className="sub-line">Ganze Texte in drei Durchgängen</div>
            </div>
            <Icon name="chevronRight" className="chev" />
          </div>
        </a>
        <button className="card" style={{ color: 'inherit', textAlign: 'left', cursor: 'pointer', font: 'inherit' }} onClick={() => startPlacement()}>
          <div className="row">
            <Icon name="flag" />
            <div className="grow">
              <div className="title-line">Einstufungstest</div>
              <div className="sub-line">{data.placementDone ? 'Erneut einstufen (40 Aufgaben)' : '40 Aufgaben quer durch alle Kurse'}</div>
            </div>
            <Icon name="chevronRight" className="chev" />
          </div>
        </button>
      </div>
    </div>
  );
}
