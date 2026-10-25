import { useEffect, useRef, useState } from 'react';
import { APP_VERSION_TEXT } from '../lib/version';
import { Icon } from '../components/Icon';
import { Confirm, toast } from '../components/ui';
import { BANK, allTasks } from '../lib/content';
import { DATA_VERSION } from '../lib/db';
import { dayKey } from '../lib/dates';
import { download } from '../lib/exporter';
import { speak, speechAvailable, hasGermanVoice } from '../lib/speech';
import { startPlacement } from '../lib/start';
import { exportJson, importJson, resetAll, updateSettings, useApp } from '../lib/store';
import type { Settings } from '../lib/types';

function Seg<T extends string | number>({ value, options, onChange, label }: { value: T; options: { v: T; l: string }[]; onChange: (v: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={String(o.v)} aria-pressed={value === o.v} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

function Row({ title, text, children }: { title: string; text?: string; children: React.ReactNode }) {
  return (
    <div className="row between wrap" style={{ padding: '14px 0', borderTop: '1px solid var(--border)', gap: 16 }}>
      <div style={{ flex: '1 1 240px' }}>
        <div className="title-line">{title}</div>
        {text ? <div className="sub-line">{text}</div> : null}
      </div>
      <div>{children}</div>
    </div>
  );
}

export function Einstellungen() {
  const data = useApp();
  const s = data.settings;
  const set = (patch: Partial<Settings>) => void updateSettings(patch);
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<string | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);
  const [persisted, setPersisted] = useState<boolean | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted).catch(() => setPersisted(null));
  }, []);

  const bankCount = allTasks().filter((t) => t.geprueft !== false).length;

  return (
    <div>
      <div className="page-head">
        <h1>Einstellungen</h1>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Üben</h2>
        <Row title="Sitzungslänge" text="Aufgaben je Wiederholung und Mischtraining">
          <Seg label="Sitzungslänge" value={s.sitzungslaenge} options={[15, 30, 50].map((n) => ({ v: n as 15 | 30 | 50, l: String(n) }))} onChange={(v) => set({ sitzungslaenge: v })} />
        </Row>
        <Row title="Tagesziel" text="Aufgaben je Tag">
          <Seg label="Tagesziel" value={s.tagesziel} options={[10, 20, 30, 50, 80].map((n) => ({ v: n, l: String(n) }))} onChange={(v) => set({ tagesziel: v })} />
        </Row>
        <Row title="Zeitmodus" text="Eine Zeitvorgabe je Aufgabe. Ohne Zeitmodus gibt es keinen Zeitdruck.">
          <Seg label="Zeitmodus" value={s.zeitmodus ? 'an' : 'aus'} options={[{ v: 'aus', l: 'Aus' }, { v: 'an', l: 'An' }]} onChange={(v) => set({ zeitmodus: v === 'an' })} />
        </Row>
        {s.zeitmodus ? (
          <Row title="Sekunden je Aufgabe" text="Längere Aufgabentypen erhalten ein Vielfaches.">
            <Seg label="Sekunden je Aufgabe" value={s.sekundenJeAufgabe} options={[20, 30, 40, 60].map((n) => ({ v: n, l: `${n} s` }))} onChange={(v) => set({ sekundenJeAufgabe: v })} />
          </Row>
        ) : null}
        <Row title="Sprachausgabe" text={speechAvailable() ? (hasGermanVoice() ? 'Liest Wörter in „Wort tippen“ vor (de-DE).' : 'Keine deutsche Stimme gefunden; der Browser nutzt seine Standardstimme.') : 'Dieser Browser bietet keine Sprachausgabe.'}>
          <div className="row">
            <Seg label="Sprachausgabe" value={s.sprachausgabe ? 'an' : 'aus'} options={[{ v: 'aus', l: 'Aus' }, { v: 'an', l: 'An' }]} onChange={(v) => set({ sprachausgabe: v === 'an' })} />
            {speechAvailable() ? (
              <button className="btn small icon" aria-label="Probe hören" onClick={() => speak('Rhythmus')}>
                <Icon name="speaker" />
              </button>
            ) : null}
          </div>
        </Row>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Darstellung</h2>
        <Row title="Farbschema" text="Folgt dem System oder bleibt fest.">
          <Seg label="Farbschema" value={s.darstellung} options={[{ v: 'system', l: 'System' }, { v: 'hell', l: 'Hell' }, { v: 'dunkel', l: 'Dunkel' }]} onChange={(v) => set({ darstellung: v })} />
        </Row>
        <Row title="Schriftgröße der Übungssätze">
          <Seg label="Schriftgröße" value={s.schriftgroesse} options={[{ v: 'normal', l: 'Normal' }, { v: 'gross', l: 'Groß' }]} onChange={(v) => set({ schriftgroesse: v })} />
        </Row>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Sicherung und Wiederherstellung</h2>
        <p className="small muted" style={{ marginBottom: 6 }}>
          Alle Daten liegen nur auf diesem Gerät. Sichere sie regelmäßig als Datei, damit ein Gerätewechsel nichts kostet.
        </p>
        <Row title="Daten sichern" text="Vollständiger Stand als JSON-Datei: Antworten, Fehlerbuch, Wiederholung, Lektionsstände, eigene Aufgaben, Einstellungen.">
          <button className="btn" onClick={() => download(`perfectgrammar-sicherung-${dayKey()}.json`, exportJson(), 'application/json')}>
            <Icon name="download" /> Sichern
          </button>
        </Row>
        <Row title="Sicherung einspielen" text="Ersetzt den aktuellen Stand vollständig.">
          <>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              style={{ display: 'none' }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (!f) return;
                setImportError(null);
                setPending(await f.text());
              }}
            />
            <button className="btn" onClick={() => fileRef.current?.click()}>
              <Icon name="upload" /> Datei wählen
            </button>
          </>
        </Row>
        {importError ? (
          <div className="notice error" role="alert">
            <Icon name="alert" />
            <span>{importError}</span>
          </div>
        ) : null}
        <Row title="Dauerhafter Speicher" text={persisted ? 'Der Browser hält die Daten dauerhaft vor.' : 'Der Browser darf die Daten bei Speichermangel löschen. Als App auf dem Home-Bildschirm installiert, sind sie geschützt.'}>
          <span className={`badge ${persisted ? 'ok' : 'outline'}`}>{persisted ? 'gewährt' : 'nicht gewährt'}</span>
        </Row>
      </div>

      <div className="card">
        <h2 style={{ marginBottom: 6 }}>Lernstand</h2>
        <Row title="Einstufungstest" text={data.placementDone ? 'Erneut einstufen; der Ausgangsstand je Kurs wird überschrieben.' : '40 Aufgaben quer durch alle Kurse.'}>
          <button className="btn" onClick={() => startPlacement()}>
            Starten
          </button>
        </Row>
        <Row title="Alles zurücksetzen" text="Löscht Antworten, Fehlerbuch, Wiederholung und eigene Aufgaben auf diesem Gerät.">
          <button className="btn danger" onClick={() => setConfirmReset(true)}>
            Zurücksetzen
          </button>
        </Row>
      </div>

      <div className="card flat">
        <h3 style={{ marginBottom: 8 }}>Über die App</h3>
        <ul className="checklist" style={{ marginTop: 0 }}>
          <li>Regelstand: Amtliches Regelwerk der deutschen Rechtschreibung, Fassung 2024.</li>
          <li>
            {BANK.courses.length} Kurse, {BANK.lessons.size} Lektionen, {bankCount} geprüfte Aufgaben.
          </li>
          <li>Läuft vollständig auf dem Gerät: kein Konto, kein Server, kein Tracking. Offline nutzbar.</li>
          <li>Installation auf dem iPad: in Safari „Teilen“ → „Zum Home-Bildschirm“.</li>
          <li>
            Datenversion {DATA_VERSION}. {APP_VERSION_TEXT}.
          </li>
        </ul>
      </div>

      {pending ? (
        <Confirm
          title="Sicherung einspielen?"
          text="Der aktuelle Stand auf diesem Gerät wird vollständig durch die Sicherung ersetzt."
          confirmLabel="Einspielen"
          onCancel={() => setPending(null)}
          onConfirm={async () => {
            const text = pending;
            setPending(null);
            try {
              await importJson(text);
              toast('Sicherung eingespielt. Der vollständige Stand ist wiederhergestellt.');
            } catch (e) {
              setImportError(e instanceof Error ? e.message : 'Die Sicherung konnte nicht gelesen werden.');
            }
          }}
        />
      ) : null}
      {confirmReset ? (
        <Confirm
          title="Alles zurücksetzen?"
          text="Alle Antworten, das Fehlerbuch, die Wiederholung und eigene Aufgaben werden gelöscht. Sichere vorher, wenn du den Stand behalten willst."
          confirmLabel="Endgültig zurücksetzen"
          danger
          onCancel={() => setConfirmReset(false)}
          onConfirm={async () => {
            setConfirmReset(false);
            await resetAll();
            toast('Alle Daten wurden zurückgesetzt.');
          }}
        />
      ) : null}
    </div>
  );
}
