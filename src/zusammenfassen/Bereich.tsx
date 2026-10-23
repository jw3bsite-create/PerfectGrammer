// Seiten des Moduls „Zusammenfassen“ in der Haupt-App.

import { useMemo, useState } from 'react';
import { LineChart, type Point } from '../components/Charts';
import { Icon } from '../components/Icon';
import { Confirm, plural, toast } from '../components/ui';
import { dayKey, formatDay } from '../lib/dates';
import { typo } from '../lib/normalize';
import type { Route } from '../lib/router';
import { useApp } from '../lib/store';
import { eigenenTextLoeschen, eigenenTextSpeichern, kiSpeichern, niveauSetzen, starteSitzung, volltextStarten } from './aktionen';
import { ARTEN, BEREICH_LABEL, eigeneAbsaetze, FUNKTIONSVERBEN, KATEGORIEN, katLabel, TEILE, TEXTE, text as textVon, TEXTSORTEN, woerter } from './daten';
import { kiSystemPrompt, kiTesten } from './ki';
import { ampel, haeufigsteFehler, katStatistik, naechsterVolltext, niveau, NIVEAU_TEXT, wochenVerlauf, type ZAmpel } from './logik';
import type { ZArt, ZKat, ZState, ZTeil } from './typen';

const SUBNAV = [
  { key: '', label: 'Übersicht' },
  { key: 'einleitung', label: 'Einleitung' },
  { key: 'hauptteil', label: 'Hauptteil' },
  { key: 'schluss', label: 'Schluss' },
  { key: 'texte', label: 'Ganzer Text' },
  { key: 'eigene', label: 'Eigene Texte' },
  { key: 'ki', label: 'KI (optional)' },
];

export function ZBereich({ route }: { route: Route }) {
  const b = route.parts[1] ?? '';
  let page;
  if (b === 'einleitung' || b === 'hauptteil' || b === 'schluss') page = <TeilSeite teil={b} />;
  else if (b === 'texte') page = <TexteSeite />;
  else if (b === 'eigene') page = <EigeneSeite />;
  else if (b === 'ki') page = <KiSeite />;
  else page = <Uebersicht />;
  return (
    <div>
      <nav className="subnav zs-subnav" aria-label="Zusammenfassen">
        {SUBNAV.map((n) => (
          <a key={n.key} href={`#/zusammenfassen${n.key ? `/${n.key}` : ''}`} aria-current={b === n.key ? 'page' : undefined}>
            {n.label}
          </a>
        ))}
      </nav>
      {page}
    </div>
  );
}

const AMPEL_TEXT: Record<ZAmpel, string> = { offen: 'Noch offen', rot: 'Rot · oft falsch', gelb: 'Gelb · meist richtig', gruen: 'Grün · sitzt' };

function ZAmpelBadge({ a }: { a: ZAmpel }) {
  return (
    <span className={`ampel ${a}`} data-ampel={a}>
      {AMPEL_TEXT[a]}
    </span>
  );
}

function artenFuerKat(k: ZKat): ZArt[] {
  return ARTEN.filter((a) => a.kats.includes(k)).map((a) => a.id);
}

function offenerVolltext(s: ZState) {
  return [...s.volltexte].reverse().find((v) => v.phase !== 'fertig');
}

// ---------- Übersicht ----------

function Uebersicht() {
  const data = useApp();
  const s = data.zusammenfassen;
  const today = dayKey();
  const nv = niveau(s);
  const naechster = naechsterVolltext(s);
  const offen = offenerVolltext(s);
  const top = haeufigsteFehler(s, today);
  const wochen = wochenVerlauf(s, today);
  const points: Point[] = wochen.map((w) => ({
    key: w.woche,
    label: formatDay(w.woche, true),
    value: w.gesamt ? (w.ok / w.gesamt) * 100 : null,
    detail: w.gesamt ? `${w.ok} von ${w.gesamt} richtig` : undefined,
  }));
  const fertige = s.volltexte.filter((v) => v.phase === 'fertig');

  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Zusammenfassen</h1>
          <p className="lead">Strukturierte Textwiedergabe von Sachtexten: viele kurze Texte, Teilübungen im Wechsel, eine Überarbeitung pro Text. So prägt sich das Muster ein.</p>
        </div>
      </div>

      <div className="grid-2" style={{ alignItems: 'stretch' }}>
        <div className="card">
          <div className="card-title">
            <h2>Gemischtes Training</h2>
            <Icon name="shuffle" className="muted" />
          </div>
          <p className="small muted">Zehn kurze Übungen aus Einleitung, Hauptteil und Schluss, jede zu einem anderen Text. Wo du oft danebenliegst, kommen mehr.</p>
          <button
            className="btn primary wide"
            style={{ marginTop: 14 }}
            data-start="misch"
            onClick={() => void starteSitzung({ titel: 'Gemischtes Training', zurueck: '/zusammenfassen', arten: ARTEN.map((a) => a.id), n: 10 })}
          >
            Training starten
          </button>
        </div>
        <div className="card">
          <div className="card-title">
            <h2>Ganzer Text</h2>
            <Icon name="text" className="muted" />
          </div>
          {offen ? (
            <>
              <p className="small muted">Angefangen: „{typo(titelVon(s, offen.textId))}“.</p>
              <a className="btn primary wide" style={{ marginTop: 14 }} href={`#/zusammenfassen/schreiben/${offen.id}`} data-start="weiter">
                Weiterschreiben
              </a>
            </>
          ) : (
            <>
              <p className="small muted">
                Nächster Text: „{typo(naechster.titel)}“ ({BEREICH_LABEL[naechster.bereich] ?? naechster.bereich}, {naechster.textsorte}). Schreibplan, Text mit Timer, Selbstprüfung, Musterlösung.
              </p>
              <button className="btn primary wide" style={{ marginTop: 14 }} data-start="volltext" onClick={() => void volltextStarten(naechster.id, naechster.absaetze.length)}>
                Zusammenfassung schreiben
              </button>
            </>
          )}
        </div>
      </div>

      <div className="section card">
        <div className="card-title">
          <h3>Schwierigkeit</h3>
          <span className="small muted">{NIVEAU_TEXT[nv]}</span>
        </div>
        <div className="segmented" role="group" aria-label="Stufe">
          {([undefined, 1, 2, 3] as const).map((x) => (
            <button key={String(x)} aria-pressed={s.niveau === x} onClick={() => void niveauSetzen(x)}>
              {x ? `Stufe ${x}` : 'Automatisch'}
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 10 }}>
          Automatisch beginnst du mit kurzen, klar gegliederten Texten. Nach vier ganzen Zusammenfassungen oder sicheren Teilübungen kommen längere Texte, später solche mit versteckter These.
        </p>
      </div>

      <div className="section">
        <h2>Fehlerkategorien</h2>
        <p className="muted small" style={{ marginBottom: 14 }}>
          Gezählt werden Teilübungen und jedes „Nein“ der Checkliste, jeweils die letzten 20 Antworten. Tippe eine Kategorie an, um sie gezielt zu üben.
        </p>
        <div className="ampel-grid">
          {KATEGORIEN.map((k) => {
            const st = katStatistik(s, k.id);
            const a = ampel(s, k.id);
            return (
              <button
                key={k.id}
                className={`card ampel-card a-${a === 'offen' ? 'offen' : a}`}
                data-kat={k.id}
                onClick={() => void starteSitzung({ titel: `Gezielt: ${k.label}`, zurueck: '/zusammenfassen', arten: artenFuerKat(k.id), n: 8 })}
              >
                <ZAmpelBadge a={a} />
                <h3>{k.label}</h3>
                <p className="small muted">{st.gesamt ? `${st.ok} von ${st.gesamt} richtig` : 'noch keine Antworten'}</p>
                <p className="small">{typo(k.tipp)}</p>
              </button>
            );
          })}
        </div>
      </div>

      <div className="section grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <h3>Häufigste Fehler</h3>
            <span className="small muted">30 Tage</span>
          </div>
          {top.length ? (
            <ol className="zs-top">
              {top.map((x) => (
                <li key={x.kat}>
                  <strong>{katLabel(x.kat)}</strong> <span className="muted small">· {plural(x.anzahl, 'Fehler', 'Fehler')}</span>
                </li>
              ))}
            </ol>
          ) : (
            <p className="small muted">Noch keine Fehler gezählt.</p>
          )}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Verlauf</h3>
            <span className="small muted">Anteil richtig je Woche</span>
          </div>
          {wochen.some((w) => w.gesamt) ? (
            <LineChart points={points} max={100} format={(v) => `${Math.round(v)} %`} title="Anteil richtiger Antworten je Woche im Modul Zusammenfassen" />
          ) : (
            <p className="small muted">Nach den ersten Übungen siehst du hier deinen Verlauf.</p>
          )}
        </div>
      </div>

      {s.volltexte.length ? (
        <div className="section">
          <h2>Deine Zusammenfassungen</h2>
          <p className="small muted" style={{ marginBottom: 12 }}>
            {plural(fertige.length, 'Text', 'Texte')} abgeschlossen.
          </p>
          <div className="list">
            {[...s.volltexte]
              .reverse()
              .slice(0, 12)
              .map((v) => (
                <a key={v.id} className="list-item" href={`#/zusammenfassen/schreiben/${v.id}`}>
                  <span className="grow">
                    <span className="title-line">{typo(titelVon(s, v.textId))}</span>
                    <span className="sub-line">
                      {formatDay(dayKey(v.start), true)} · {v.phase === 'fertig' ? `${woerter(v.fassung2 ?? v.fassung1)} Wörter${v.fassung2 ? ', überarbeitet' : ''}` : 'angefangen'}
                    </span>
                  </span>
                  <Icon name="chevronRight" className="chev" />
                </a>
              ))}
          </div>
        </div>
      ) : null}

      <p className="small muted section">Alle Texte der Textbank sind Übungstexte mit erfundenen Verfassern und Medien. Die Sachinformationen zu Epochen, Philosophie und Geschichte sind echt.</p>
    </div>
  );
}

function titelVon(s: ZState, id: string): string {
  return textVon(id)?.titel ?? s.eigeneTexte.find((e) => e.id === id)?.titel ?? 'Text';
}

// ---------- Einleitung, Hauptteil, Schluss ----------

const ERWARTUNGEN: Record<ZTeil, string[]> = {
  einleitung: [
    'Höchstens zwei Sätze.',
    'Verfasser (voller Name), Titel in Anführungszeichen, Textsorte.',
    'Erscheinungsort und -datum (Zeitung, Magazin, Verlag; Datum oder Jahr).',
    'Thema („Es geht um …“) und Kernaussage („Der Autor vertritt die These, dass …“).',
    'Sachlich und im Präsens, ohne Wertung.',
  ],
  hauptteil: [
    'Etwa ein Satz pro Sinnabschnitt, in der Reihenfolge des Textes.',
    'Eigene Satzbauweise, Präsens, Funktionsverben: Sie sagen, was der Autor tut.',
    'Behauptungen des Autors im Konjunktiv: Singular Konjunktiv I (sei, habe, müsse); Plural würden + Infinitiv, außer seien und hätten.',
    'Handlungen des Autors im Indikativ (Der Autor fordert …). Nach „dass“ ist der Indikativ erlaubt.',
    'Kern statt Beispiel, nichts dazudichten, keine Abschwächung, keine Zeilenangaben.',
  ],
  schluss: ['Gesamtaussage in ein bis zwei Sätzen.', 'Keine neuen Inhalte, keine eigene Meinung.', 'Insgesamt bleibt die Zusammenfassung knapp, etwa zehn Sätze.'],
};

function TeilSeite({ teil }: { teil: ZTeil }) {
  const data = useApp();
  const s = data.zusammenfassen;
  const titel = TEILE.find((x) => x.id === teil)!.titel;
  const arten = ARTEN.filter((a) => a.teil === teil);
  const quote = (a: ZArt) => {
    const u = s.uebungen.filter((x) => x.art === a).slice(-20);
    return u.length ? `${u.filter((x) => x.richtig).length} von ${u.length} richtig` : 'noch nicht geübt';
  };
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>{titel}</h1>
          <p className="lead">Kurze Übungen zu je einem anderen Text. Ein bis drei Minuten pro Aufgabe.</p>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <h3>Das erwartet deine Lehrerin</h3>
          </div>
          <ul className="checklist">
            {ERWARTUNGEN[teil].map((e) => (
              <li key={e}>{typo(e)}</li>
            ))}
          </ul>
          {teil === 'hauptteil' ? (
            <details className="zs-details" style={{ marginTop: 12 }}>
              <summary>Formulierungshilfen</summary>
              <p className="small" style={{ paddingTop: 8 }}>
                Die Autorin / Der Autor {FUNKTIONSVERBEN.join(' · ')} …
              </p>
            </details>
          ) : null}
          {teil === 'einleitung' ? (
            <div className="source-box" style={{ marginTop: 14 }}>
              <div className="eyebrow">Muster</div>
              In dem Kommentar „…“ von …, erschienen am … in der Wochenzeitung „…“, geht es um … . Der Autor vertritt die These, dass … .
            </div>
          ) : null}
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Übungen</h3>
          </div>
          <button
            className="btn primary wide"
            data-start={`teil-${teil}`}
            onClick={() => void starteSitzung({ titel: `${titel} gemischt`, zurueck: `/zusammenfassen/${teil}`, arten: arten.map((a) => a.id), n: teil === 'hauptteil' ? 10 : 8 })}
          >
            Alles aus „{titel}“ gemischt
          </button>
          <div className="list" style={{ marginTop: 14 }}>
            {arten.map((a) => (
              <button key={a.id} className="list-item" data-art={a.id} onClick={() => void starteSitzung({ titel: a.titel, zurueck: `/zusammenfassen/${teil}`, arten: [a.id], n: 6 })}>
                <span className="grow">
                  <span className="title-line">{a.titel}</span>
                  <span className="sub-line">
                    {a.kurz} · {quote(a.id)}
                  </span>
                </span>
                <Icon name="play" className="chev" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Textbank ----------

function TexteSeite() {
  const data = useApp();
  const s = data.zusammenfassen;
  const nv = niveau(s);
  const [bereich, setBereich] = useState('');
  const [stufe, setStufe] = useState<number | 0>(0);
  const naechster = naechsterVolltext(s);
  const offen = offenerVolltext(s);
  const bearbeitet = useMemo(() => {
    const m = new Map<string, number>();
    for (const v of s.volltexte) if (v.phase === 'fertig') m.set(v.textId, (m.get(v.textId) ?? 0) + 1);
    return m;
  }, [s.volltexte]);
  const bereiche = [...new Set(TEXTE.map((t) => t.bereich))];
  const liste = TEXTE.filter((t) => (!bereich || t.bereich === bereich) && (!stufe || t.stufe === stufe));
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Ganzer Text</h1>
          <p className="lead">
            {TEXTE.length} Übungstexte. Schreibplan, Zusammenfassung mit Timer und Wortzähler, Selbstprüfung, Musterlösung, eine Überarbeitung, dann der nächste Text.
          </p>
        </div>
      </div>
      <div className="card">
        <div className="row between wrap" style={{ gap: 12 }}>
          <div>
            <div className="eyebrow">{offen ? 'Angefangen' : `Empfohlen auf ${NIVEAU_TEXT[nv].split(':')[0]}`}</div>
            <strong>„{typo(offen ? titelVon(s, offen.textId) : naechster.titel)}“</strong>
          </div>
          {offen ? (
            <a className="btn primary" href={`#/zusammenfassen/schreiben/${offen.id}`}>
              Weiterschreiben
            </a>
          ) : (
            <button className="btn primary" data-start="volltext" onClick={() => void volltextStarten(naechster.id, naechster.absaetze.length)}>
              Starten
            </button>
          )}
        </div>
      </div>
      <div className="section">
        <div className="chips" role="group" aria-label="Bereich">
          <button className="chip" aria-pressed={!bereich} onClick={() => setBereich('')}>
            Alle
          </button>
          {bereiche.map((b) => (
            <button key={b} className="chip" aria-pressed={bereich === b} onClick={() => setBereich(b)}>
              {BEREICH_LABEL[b] ?? b}
            </button>
          ))}
        </div>
        <div className="segmented" role="group" aria-label="Stufe" style={{ marginTop: 10 }}>
          {[0, 1, 2, 3].map((x) => (
            <button key={x} aria-pressed={stufe === x} onClick={() => setStufe(x)}>
              {x ? `Stufe ${x}` : 'Alle Stufen'}
            </button>
          ))}
        </div>
        <div className="list" style={{ marginTop: 14 }}>
          {liste.map((t) => (
            <button key={t.id} className="list-item" data-textid={t.id} onClick={() => void volltextStarten(t.id, t.absaetze.length)}>
              <span className="grow">
                <span className="title-line">{typo(t.titel)}</span>
                <span className="sub-line">
                  {BEREICH_LABEL[t.bereich] ?? t.bereich} · {t.textsorte} · Stufe {t.stufe} · {woerter(t.absaetze.flat().join(' '))} Wörter
                  {bearbeitet.get(t.id) ? ` · ${bearbeitet.get(t.id)}× bearbeitet` : ''}
                </span>
              </span>
              {bearbeitet.get(t.id) ? <Icon name="checkCircle" className="ok-ink" /> : <Icon name="chevronRight" className="chev" />}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ---------- Eigene Texte ----------

function EigeneSeite() {
  const data = useApp();
  const s = data.zusammenfassen;
  const [f, setF] = useState({ titel: '', autor: '', textsorte: 'Kommentar', quelle: '', text: '', muster: '' });
  const [fehler, setFehler] = useState<string | null>(null);
  const [loeschen, setLoeschen] = useState<string | null>(null);
  const speichern = async () => {
    if (!f.titel.trim() || !f.autor.trim() || woerter(f.text) < 40) {
      setFehler('Titel, Verfasser und der Text (mindestens 40 Wörter) werden gebraucht.');
      return;
    }
    setFehler(null);
    const neu = { titel: f.titel.trim(), autor: f.autor.trim(), textsorte: f.textsorte, quelle: f.quelle.trim(), text: f.text.trim(), muster: f.muster.trim() || undefined };
    setF({ titel: '', autor: '', textsorte: 'Kommentar', quelle: '', text: '', muster: '' });
    await eigenenTextSpeichern(neu);
    toast('Text gespeichert.');
  };
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Eigene Texte</h1>
          <p className="lead">Füge Texte aus dem Unterricht ein, etwa ein Arbeitsblatt zur Textwiedergabe. Wenn du die Musterlösung deiner Lehrerin hast, füge sie dazu; sie erscheint beim Vergleich neben deiner Fassung.</p>
        </div>
      </div>
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void speichern();
        }}
      >
        <div className="grid-2" style={{ gap: 16 }}>
          <div className="field">
            <label htmlFor="ze-titel">Titel</label>
            <input id="ze-titel" className="input" value={f.titel} onChange={(e) => setF({ ...f, titel: e.target.value })} placeholder="Erst muss alles zerfallen" />
          </div>
          <div className="field">
            <label htmlFor="ze-autor">Verfasser</label>
            <input id="ze-autor" className="input" value={f.autor} onChange={(e) => setF({ ...f, autor: e.target.value })} placeholder="Thomas Mayer" />
          </div>
          <div className="field">
            <label htmlFor="ze-sorte">Textsorte</label>
            <select id="ze-sorte" className="select" value={f.textsorte} onChange={(e) => setF({ ...f, textsorte: e.target.value })}>
              {[...TEXTSORTEN, 'Monografie (Auszug)', 'Rede', 'Interview'].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="ze-quelle">Erschienen (Ort, Datum)</label>
            <input id="ze-quelle" className="input" value={f.quelle} onChange={(e) => setF({ ...f, quelle: e.target.value })} placeholder="Die Weltwoche, 24.09.2025" />
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="ze-text">Text (Absätze durch eine Leerzeile trennen)</label>
          <textarea id="ze-text" className="textarea read" rows={10} value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="ze-muster">Musterlösung (freiwillig)</label>
          <textarea id="ze-muster" className="textarea read" rows={6} value={f.muster} onChange={(e) => setF({ ...f, muster: e.target.value })} />
        </div>
        {fehler ? (
          <div className="notice error" style={{ marginTop: 14 }} role="alert">
            <Icon name="alert" />
            <span>{fehler}</span>
          </div>
        ) : null}
        <div className="actions">
          <button type="submit" className="btn primary">
            Speichern
          </button>
        </div>
      </form>
      <div className="section">
        <h2>Gespeicherte Texte</h2>
        {s.eigeneTexte.length ? (
          <div className="list" data-eigene={s.eigeneTexte.length}>
            {[...s.eigeneTexte].reverse().map((t) => (
              <div key={t.id} className="list-item">
                <span className="grow">
                  <span className="title-line">{typo(t.titel)}</span>
                  <span className="sub-line">
                    {t.autor} · {t.textsorte} · {eigeneAbsaetze(t).length} Absätze{t.muster ? ' · mit Musterlösung' : ''}
                  </span>
                </span>
                <button className="btn small" onClick={() => void volltextStarten(t.id, eigeneAbsaetze(t).length, true)}>
                  Zusammenfassen
                </button>
                <button className="btn icon small ghost" onClick={() => setLoeschen(t.id)} aria-label="Text löschen" title="Text löschen">
                  <Icon name="trash" />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="small muted">Noch keine eigenen Texte.</p>
        )}
      </div>
      {loeschen ? (
        <Confirm
          title="Text löschen?"
          text="Der Text wird gelöscht. Deine Zusammenfassungen dazu bleiben in der Liste, aber ohne Text."
          confirmLabel="Löschen"
          danger
          onCancel={() => setLoeschen(null)}
          onConfirm={async () => {
            const id = loeschen;
            setLoeschen(null);
            await eigenenTextLoeschen(id);
          }}
        />
      ) : null}
    </div>
  );
}

// ---------- KI ----------

function KiSeite() {
  const data = useApp();
  const ki = data.zusammenfassen.ki;
  const [f, setF] = useState(ki);
  const [test, setTest] = useState<string | null>(null);
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>KI-Rückmeldung (optional)</h1>
          <p className="lead">
            Eine lokale KI kann deine ganze Zusammenfassung nach den Kategorien der Checkliste prüfen. Sie nennt Stelle und Fehlerart, aber keine fertige Lösung und kein Lob. Sie läuft auf deinem Rechner; nichts wird ins Internet geschickt.
          </p>
        </div>
      </div>
      <div className="grid-2" style={{ alignItems: 'start' }}>
        <div className="card">
          <div className="card-title">
            <h3>Einrichten unter Windows</h3>
          </div>
          <ol className="zs-schrittliste">
            <li>
              Ollama von <strong>ollama.com</strong> herunterladen und installieren.
            </li>
            <li>
              PowerShell öffnen und ein Modell laden, zum Beispiel: <code>ollama pull qwen2.5:7b</code> (etwa 5 GB, einmalig).
            </li>
            <li>Hier „KI verwenden“ einschalten, speichern und „Verbindung testen“ drücken.</li>
          </ol>
          <p className="small muted" style={{ marginTop: 10 }}>
            Gut sind Rechner mit mindestens 16 GB Arbeitsspeicher. Kleine Modelle irren sich bei Grammatik öfter. Die KI ersetzt die Checkliste und die Musterlösung nicht; nimm ihre Hinweise als zweite Meinung.
          </p>
        </div>
        <form
          className="card"
          onSubmit={async (e) => {
            e.preventDefault();
            await kiSpeichern({ ...f, url: f.url.trim() || 'http://localhost:11434', modell: f.modell.trim() || 'qwen2.5:7b' });
            toast('Gespeichert.');
          }}
        >
          <label className="check">
            <input type="checkbox" checked={f.aktiv} onChange={(e) => setF({ ...f, aktiv: e.target.checked })} />
            KI verwenden
          </label>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="ki-url">Adresse</label>
            <input id="ki-url" className="input" value={f.url} onChange={(e) => setF({ ...f, url: e.target.value })} />
          </div>
          <div className="field" style={{ marginTop: 12 }}>
            <label htmlFor="ki-modell">Modell</label>
            <input id="ki-modell" className="input" value={f.modell} onChange={(e) => setF({ ...f, modell: e.target.value })} />
          </div>
          <div className="actions">
            <button
              type="button"
              className="btn"
              onClick={async () => {
                setTest('Teste …');
                setTest((await kiTesten(f)).text);
              }}
            >
              Verbindung testen
            </button>
            <button type="submit" className="btn primary">
              Speichern
            </button>
          </div>
          {test ? (
            <p className="small" style={{ marginTop: 10 }} data-kitest>
              {test}
            </p>
          ) : null}
        </form>
      </div>
      <details className="zs-details section">
        <summary>Anweisung an die KI ansehen</summary>
        <pre className="zs-prompt">{kiSystemPrompt()}</pre>
      </details>
    </div>
  );
}
