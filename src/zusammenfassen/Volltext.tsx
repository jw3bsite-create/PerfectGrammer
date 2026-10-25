// Ganze Zusammenfassung: Schreibplan, Text mit Timer und Wortzähler, Selbstprüfung, Musterlösung daneben, eine Überarbeitung.

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Confirm, Empty } from '../components/ui';
import { NO_AUTOCORRECT } from '../exercises/common';
import { typo } from '../lib/normalize';
import { navigate } from '../lib/router';
import { getState, useApp } from '../lib/store';
import { checklisteSpeichern, volltextAendern, volltextLoeschen, volltextStarten } from './aktionen';
import { eigeneAbsaetze, FUNKTIONEN, FUNKTIONSVERBEN, funktionLabel, KATEGORIEN, musterGesamt, musterSaetze, quellenzeile, text as textVon, woerter } from './daten';
import { KiBlock } from './KiBlock';
import { naechsterVolltext } from './logik';
import { hinweiseZusammenfassung, type Hinweis } from './pruefen';
import { Block, HinweisListe, JaNein } from './Teile';
import type { Funktion, ZPlanAbschnitt, ZText, ZVolltext } from './typen';

interface Quelle {
  titel: string;
  autor: string;
  quellenzeile: string;
  textsorte: string;
  absaetze: string[];
  zText?: ZText;
  muster?: { label: string; text: string }[];
  musterWoerter?: number;
}

function quelleVon(v: ZVolltext, eigene: ReturnType<typeof useApp>['zusammenfassen']['eigeneTexte']): Quelle | null {
  if (v.eigen) {
    const e = eigene.find((x) => x.id === v.textId);
    if (!e) return null;
    return {
      titel: e.titel,
      autor: e.autor,
      quellenzeile: `${e.autor}: ${e.titel}. ${e.quelle}`,
      textsorte: e.textsorte,
      absaetze: eigeneAbsaetze(e),
      muster: e.muster ? [{ label: 'Musterlösung (eingefügt)', text: e.muster }] : undefined,
      musterWoerter: e.muster ? woerter(e.muster) : undefined,
    };
  }
  const t = textVon(v.textId);
  if (!t) return null;
  return {
    titel: t.titel,
    autor: t.autor,
    quellenzeile: quellenzeile(t),
    textsorte: t.textsorte,
    absaetze: t.absaetze.map((a) => a.join(' ')),
    zText: t,
    muster: musterSaetze(t),
    musterWoerter: woerter(musterGesamt(t)),
  };
}

function Quelltext({ q, theseAbsatz, onThese, offen = true }: { q: Quelle; theseAbsatz?: number | null; onThese?: (i: number) => void; offen?: boolean }) {
  return (
    <details className="zs-details" open={offen}>
      <summary>Text „{typo(q.titel)}“</summary>
      <div className="zs-text">
        <h3 className="zs-titel">{typo(q.titel)}</h3>
        {q.absaetze.map((a, i) => (
          <div key={i} className={`zs-planabsatz${theseAbsatz === i ? ' these' : ''}`}>
            <p className="zs-absatz">
              <span className="zs-nr">{i + 1}</span>
              {typo(a)}
            </p>
            {onThese ? (
              <button type="button" className={`zs-these-knopf${theseAbsatz === i ? ' an' : ''}`} aria-pressed={theseAbsatz === i} onClick={() => onThese(i)} data-these={i}>
                <Icon name="flag" /> {theseAbsatz === i ? 'These' : 'These hier?'}
              </button>
            ) : theseAbsatz === i ? (
              <span className="zs-these-knopf an">
                <Icon name="flag" /> These
              </span>
            ) : null}
          </div>
        ))}
        <p className="zs-quelle">Quelle: {typo(q.quellenzeile)}</p>
      </div>
    </details>
  );
}

function abschnitteAusMerge(n: number, merge: boolean[]): { von: number; bis: number }[] {
  const out: { von: number; bis: number }[] = [];
  for (let i = 0; i < n; i++) {
    if (i > 0 && merge[i]) out[out.length - 1].bis = i;
    else out.push({ von: i, bis: i });
  }
  return out;
}

// ---------- Schreibplan ----------

function Plan({ v, q }: { v: ZVolltext; q: Quelle }) {
  const n = q.absaetze.length;
  const [merge, setMerge] = useState<boolean[]>(() => {
    const m = Array(n).fill(false);
    for (const p of v.plan) for (let i = p.von + 1; i <= p.bis; i++) m[i] = true;
    return m;
  });
  const [felder, setFelder] = useState<Record<number, { funktion: Funktion | ''; verb: string; woerter: string }>>(() =>
    Object.fromEntries(v.plan.map((p) => [p.von, { funktion: p.funktion, verb: p.verb, woerter: p.woerter.join(', ') }])),
  );
  const [these, setThese] = useState<number | null>(v.theseAbsatz);
  const abschnitte = abschnitteAusMerge(n, merge);
  const feld = (von: number) => felder[von] ?? { funktion: '' as const, verb: '', woerter: '' };
  const wliste = (s: string) => s.split(/[,;]/).map((x) => x.trim()).filter(Boolean);
  const zuViele = abschnitte.some((a) => wliste(feld(a.von).woerter).length > 5);

  const weiter = async () => {
    const plan: ZPlanAbschnitt[] = abschnitte.map((a) => ({ ...a, funktion: feld(a.von).funktion, verb: feld(a.von).verb.trim(), woerter: wliste(feld(a.von).woerter).slice(0, 5) }));
    await volltextAendern(v.id, { plan, theseAbsatz: these, phase: 'schreiben' });
    window.scrollTo(0, 0);
  };

  return (
    <div>
      <p className="task-instruction">
        Schritt 1: Schreibplan. Lies den Text, markiere die These am Rand und notiere je Sinnabschnitt Funktion, Funktionsverb und höchstens fünf Schlüsselwörter.
      </p>
      <div className="zs-zwei">
        <Quelltext q={q} theseAbsatz={these} onThese={(i) => setThese(these === i ? null : i)} />
        <div className="zs-plan" aria-label="Schreibplan">
          {abschnitte.map((a, k) => {
            const f = feld(a.von);
            const w = wliste(f.woerter);
            return (
              <div key={a.von} className="card zs-planzeile" data-plan={k}>
                <div className="row between wrap" style={{ gap: 8 }}>
                  <strong>
                    Abschnitt {k + 1} · Absatz {a.von + 1}
                    {a.bis > a.von ? `–${a.bis + 1}` : ''}
                  </strong>
                  {these !== null && a.von <= these && these <= a.bis ? <span className="badge">These</span> : null}
                </div>
                <div className="zs-planfelder">
                  <label className="field">
                    <span className="label">Funktion</span>
                    <select className="select" value={f.funktion} onChange={(e) => setFelder({ ...felder, [a.von]: { ...f, funktion: e.target.value as Funktion } })}>
                      <option value="">bitte wählen</option>
                      {FUNKTIONEN.map((x) => (
                        <option key={x.id} value={x.id}>
                          {x.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field">
                    <span className="label">Funktionsverb</span>
                    <input className="input" list="zs-verben" value={f.verb} onChange={(e) => setFelder({ ...felder, [a.von]: { ...f, verb: e.target.value } })} placeholder="z. B. stellt dar" />
                  </label>
                  <label className="field">
                    <span className="label">Schlüsselwörter (höchstens fünf, mit Komma)</span>
                    <input className="input" value={f.woerter} onChange={(e) => setFelder({ ...felder, [a.von]: { ...f, woerter: e.target.value } })} />
                    {w.length > 5 ? <span className="small bad-ink">{w.length} Wörter: Beschränke dich auf fünf.</span> : null}
                  </label>
                </div>
              </div>
            );
          })}
          <datalist id="zs-verben">
            {FUNKTIONSVERBEN.map((x) => (
              <option key={x} value={x} />
            ))}
          </datalist>
          <details className="zs-details">
            <summary>Absätze zu Sinnabschnitten zusammenfassen</summary>
            <div className="stack-sm" style={{ paddingTop: 8 }}>
              {q.absaetze.map((_, i) =>
                i === 0 ? null : (
                  <label key={i} className="check">
                    <input type="checkbox" checked={merge[i]} onChange={(e) => setMerge(merge.map((m, k) => (k === i ? e.target.checked : m)))} />
                    Absatz {i + 1} gehört zum Abschnitt davor
                  </label>
                ),
              )}
            </div>
          </details>
          <div className="actions">
            <button className="btn primary" onClick={() => void weiter()} disabled={zuViele}>
              Weiter zum Schreiben
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------- Schreiben ----------

function Schreiben({ v, q, runde }: { v: ZVolltext; q: Quelle; runde: 1 | 2 }) {
  const [text, setText] = useState(runde === 1 ? v.fassung1 : (v.fassung2 ?? v.fassung1));
  const start = useRef(Date.now());
  const [jetzt, setJetzt] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setJetzt(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  // Entwurf regelmäßig sichern, damit nach einem Neustart nichts verloren geht
  const textRef = useRef(text);
  textRef.current = text;
  useEffect(() => {
    const t = setInterval(() => void volltextAendern(v.id, runde === 1 ? { fassung1: textRef.current } : { fassung2: textRef.current }), 5000);
    return () => clearInterval(t);
  }, [v.id, runde]);
  const sek = Math.floor((jetzt - start.current) / 1000);
  const n = woerter(text);
  const ziel = q.musterWoerter;
  const fertig = async () => {
    const dauer = Math.floor((Date.now() - start.current) / 1000);
    await volltextAendern(v.id, runde === 1 ? { fassung1: text, dauer1: dauer, phase: 'pruefen' } : { fassung2: text, dauer2: dauer, phase: 'pruefen2' });
    window.scrollTo(0, 0);
  };
  return (
    <div>
      <p className="task-instruction">
        {runde === 1
          ? 'Schritt 2: Schreib die Zusammenfassung. Einleitung, etwa ein Satz pro Sinnabschnitt, Schluss; Präsens, Funktionsverben, Behauptungen im Konjunktiv.'
          : 'Überarbeitung: Verbessere deine Fassung einmal. Danach geht es mit dem nächsten Text weiter.'}
      </p>
      <div className="zs-zwei">
        <div>
          <Quelltext q={q} theseAbsatz={v.theseAbsatz} offen={runde === 1} />
          {runde === 1 && v.plan.some((p) => p.funktion || p.verb || p.woerter.length) ? (
            <div className="card zs-planmini">
              <div className="fb-label">Dein Schreibplan</div>
              <ol>
                {v.plan.map((p, k) => (
                  <li key={k}>
                    <strong>{p.funktion ? funktionLabel(p.funktion) : '–'}</strong>
                    {p.verb ? ` · ${p.verb}` : ''}
                    {p.woerter.length ? <span className="muted"> · {p.woerter.join(', ')}</span> : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
          {runde === 2 && q.muster ? (
            <details className="zs-details">
              <summary>Musterlösung einblenden</summary>
              <div className="stack-sm" style={{ paddingTop: 8 }}>
                {q.muster.map((m, i) => (
                  <p key={i} className="small">
                    {typo(m.text)}
                  </p>
                ))}
              </div>
            </details>
          ) : null}
        </div>
        <div>
          <div className="row between wrap zs-leiste" style={{ gap: 8 }}>
            <span className="zs-timer" role="timer" aria-label="Schreibzeit">
              <Icon name="timer" /> {String(Math.floor(sek / 60)).padStart(2, '0')}:{String(sek % 60).padStart(2, '0')}
            </span>
            <WortZ n={n} ziel={ziel} />
          </div>
          <textarea className="textarea read zs-schreibfeld" value={text} onChange={(e) => setText(e.target.value)} aria-label="Deine Zusammenfassung" rows={18} autoFocus {...NO_AUTOCORRECT} />
          {ziel && n > ziel * 1.35 ? (
            <div className="notice error" style={{ marginTop: 10 }} data-zulang>
              <Icon name="alert" />
              <span>Deutlich länger als die Musterlösung (etwa {ziel} Wörter). Kürze Beispiele und Details.</span>
            </div>
          ) : null}
          <div className="actions">
            <button className="btn primary" disabled={n < 20} onClick={() => void fertig()}>
              Fertig, zur Selbstprüfung
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function WortZ({ n, ziel }: { n: number; ziel?: number }) {
  return (
    <span className={`zs-zaehler${ziel && n > ziel * 1.35 ? ' bad' : ''}`} aria-live="polite" data-woerter={n}>
      {n} Wörter{ziel ? ` · Musterlösung etwa ${ziel}` : ''}
    </span>
  );
}

// ---------- Selbstprüfung ----------

function Pruefen({ v, q, runde }: { v: ZVolltext; q: Quelle; runde: 1 | 2 }) {
  const fassung = runde === 1 ? v.fassung1 : (v.fassung2 ?? '');
  const hinweise = useMemo(() => hinweiseZusammenfassung(fassung, q.zText, q.musterWoerter, q.absaetze.join(' ')), [fassung, q]);
  const jeKat = (k: string) => hinweise.filter((h) => h.kat === k);
  return (
    <div>
      <p className="task-instruction">Schritt 3: Prüf deine Fassung Punkt für Punkt. Jedes „Nein“ wird als Fehler in seiner Kategorie gezählt.</p>
      <div className="zs-zwei">
        <div className="card">
          <div className="fb-label">Deine Fassung{runde === 2 ? ' (überarbeitet)' : ''}</div>
          <div className="zs-fassung">
            {fassung.split(/\n+/).map((p, i) => (
              <p key={i}>{typo(p)}</p>
            ))}
          </div>
          <p className="small muted">{woerter(fassung)} Wörter{q.musterWoerter ? ` · Musterlösung etwa ${q.musterWoerter}` : ''}</p>
          <KiBlock
            anfrage={{ teil: 'volltext', angaben: `${q.quellenzeile} Textsorte: ${q.textsorte}.`, original: q.absaetze.join('\n\n'), muster: q.muster?.map((m) => m.text).join('\n'), eigen: fassung }}
            key={runde}
            gespeichert={runde === 1 ? v.ki : undefined}
            onBewertet={(j) => void volltextAendern(v.id, { ki: j })}
          />
        </div>
        <div>
          <JaNein
            fragen={KATEGORIEN.map((k) => ({ id: k.id, frage: k.frage }))}
            hinweise={Object.fromEntries(KATEGORIEN.filter((k) => jeKat(k.id).length).map((k) => [k.id, <HinweisListe key={k.id} hinweise={jeKat(k.id) as Hinweis[]} />]))}
            knopf={q.muster ? 'Weiter zur Musterlösung' : 'Selbstprüfung speichern'}
            onFertig={async (a) => {
              await checklisteSpeichern(v.id, runde, a);
              window.scrollTo(0, 0);
            }}
          />
        </div>
      </div>
    </div>
  );
}

// ---------- Vergleich ----------

function Vergleich({ v, q, abschluss }: { v: ZVolltext; q: Quelle; abschluss: boolean }) {
  const fassung = abschluss && v.fassung2 ? v.fassung2 : v.fassung1;
  const t = q.zText;
  const nein = (c?: Record<string, boolean>) => KATEGORIEN.filter((k) => c && c[k.id] === false);
  const naechster = async () => {
    if (!abschluss) await volltextAendern(v.id, { phase: 'fertig', ende: Date.now() });
    if (v.eigen) navigate('/zusammenfassen/eigene');
    else {
      const n = naechsterVolltext(getState().zusammenfassen);
      await volltextStarten(n.id, n.absaetze.length);
      window.scrollTo(0, 0);
    }
  };
  return (
    <div>
      <p className="task-instruction">{abschluss ? 'Fertig. Hier noch einmal beide Fassungen und die Musterlösung.' : 'Schritt 4: Vergleiche Abschnitt für Abschnitt mit der Musterlösung.'}</p>
      <div className="zs-zwei">
        <div className="card">
          <div className="fb-label">Deine Fassung{abschluss && v.fassung2 ? ' (überarbeitet)' : ''}</div>
          <div className="zs-fassung" data-fassung>
            {fassung.split(/\n+/).map((p, i) => (
              <p key={i}>{typo(p)}</p>
            ))}
          </div>
          <p className="small muted">{woerter(fassung)} Wörter</p>
          {nein(v.check1).length ? (
            <Block label="Bei der Selbstprüfung verneint">
              <p className="small">{nein(v.check1).map((k) => k.label).join(', ')}</p>
            </Block>
          ) : null}
          {abschluss && v.check2 ? (
            <Block label="Nach der Überarbeitung verneint">
              <p className="small">{nein(v.check2).map((k) => k.label).join(', ') || 'nichts'}</p>
            </Block>
          ) : null}
        </div>
        <div className="card">
          <div className="fb-label">Musterlösung</div>
          {q.muster ? (
            <div className="zs-muster" data-muster>
              {q.muster.map((m, i) => (
                <div key={i} className="zs-musterblock">
                  <div className="eyebrow">{m.label}</div>
                  <p>{typo(m.text)}</p>
                  {t && i > 0 && i <= t.abschnitte.length ? <PlanVergleich v={v} t={t} k={i - 1} /> : null}
                </div>
              ))}
            </div>
          ) : (
            <p className="small muted">Für diesen Text ist keine Musterlösung hinterlegt. Du kannst sie beim eigenen Text nachtragen.</p>
          )}
        </div>
      </div>
      <div className="actions" style={{ justifyContent: 'flex-start' }}>
        {!abschluss ? (
          <button className="btn" onClick={() => void volltextAendern(v.id, { phase: 'ueberarbeiten', fassung2: v.fassung1 }).then(() => window.scrollTo(0, 0))}>
            Einmal überarbeiten
          </button>
        ) : null}
        <button className="btn primary" onClick={() => void naechster()}>
          {v.eigen ? 'Zurück zu den eigenen Texten' : 'Nächster Text'}
        </button>
      </div>
    </div>
  );
}

/** Gegenüberstellung: Abschnitt der Musterlösung und eigene Planung. */
function PlanVergleich({ v, t, k }: { v: ZVolltext; t: ZText; k: number }) {
  const a = t.abschnitte[k];
  const p = v.plan.find((x) => x.von === a.von && x.bis === a.bis);
  if (!p) return null;
  const ok = p.funktion === a.funktion || !!a.auch?.includes(p.funktion as Funktion);
  return (
    <p className={`small ${ok ? 'ok-ink' : 'muted'}`}>
      Dein Plan: {p.funktion ? funktionLabel(p.funktion) : 'keine Funktion'}
      {p.verb ? ` · ${p.verb}` : ''} {ok ? '✓' : ''}
    </p>
  );
}

// ---------- Seite ----------

export function ZVolltextSeite({ id }: { id: string }) {
  const data = useApp();
  const s = data.zusammenfassen;
  const v = s.volltexte.find((x) => x.id === id);
  const [loeschen, setLoeschen] = useState(false);
  const q = v ? quelleVon(v, s.eigeneTexte) : null;
  if (!v || !q) {
    return (
      <div className="practice">
        <main className="practice-body">
          <Empty icon="text" title="Zusammenfassung nicht gefunden" action={<a className="btn primary" href="#/zusammenfassen">Zur Übersicht</a>} />
        </main>
      </div>
    );
  }
  const schritte = ['Plan', 'Schreiben', 'Prüfen', 'Vergleich'];
  const schritt = { plan: 0, schreiben: 1, pruefen: 2, vergleich: 3, ueberarbeiten: 1, pruefen2: 2, fertig: 3 }[v.phase];
  return (
    <div className="practice zs-volltext">
      <header className="practice-head">
        <div className="practice-head-inner">
          <a className="btn icon small ghost" href={v.eigen ? '#/zusammenfassen/eigene' : '#/zusammenfassen/texte'} aria-label="Zurück" title="Zurück">
            <Icon name="close" />
          </a>
          <ol className="zs-schritte" aria-label="Schritte">
            {schritte.map((x, i) => (
              <li key={x} aria-current={i === schritt ? 'step' : undefined} className={i < schritt ? 'erledigt' : undefined}>
                {x}
              </li>
            ))}
          </ol>
          {v.phase === 'plan' ? (
            <button className="btn small ghost" onClick={() => setLoeschen(true)}>
              Verwerfen
            </button>
          ) : null}
        </div>
      </header>
      <main className="practice-body zs-breit" data-phase={v.phase}>
        <div className="task-meta">
          <span>
            {typo(q.titel)} · {q.autor}
          </span>
          {q.zText ? <span className="badge outline">Stufe {q.zText.stufe}</span> : <span className="badge outline">eigener Text</span>}
        </div>
        {v.phase === 'plan' ? <Plan v={v} q={q} /> : null}
        {v.phase === 'schreiben' ? <Schreiben v={v} q={q} runde={1} /> : null}
        {v.phase === 'pruefen' ? <Pruefen v={v} q={q} runde={1} /> : null}
        {v.phase === 'vergleich' ? <Vergleich v={v} q={q} abschluss={false} /> : null}
        {v.phase === 'ueberarbeiten' ? <Schreiben v={v} q={q} runde={2} /> : null}
        {v.phase === 'pruefen2' ? <Pruefen v={v} q={q} runde={2} /> : null}
        {v.phase === 'fertig' ? <Vergleich v={v} q={q} abschluss /> : null}
      </main>
      {loeschen ? (
        <Confirm
          title="Zusammenfassung verwerfen?"
          text="Plan und Entwurf werden gelöscht."
          confirmLabel="Verwerfen"
          danger
          onCancel={() => setLoeschen(false)}
          onConfirm={async () => {
            setLoeschen(false);
            await volltextLoeschen(v.id);
            navigate(v.eigen ? '/zusammenfassen/eigene' : '/zusammenfassen/texte');
          }}
        />
      ) : null}
    </div>
  );
}
