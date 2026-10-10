import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { Confirm, Empty, toast } from '../components/ui';
import { NO_AUTOCORRECT } from '../exercises/common';
import { getLesson } from '../lib/content';
import { addDays, dayKey, diffDays, formatDay, formatRelative, weekKey } from '../lib/dates';
import { allStatuses, arbeiten, knownSources, STATUS_LABEL, suggestType, weakestTypes, type EntryStatus, type StatusInfo } from '../lib/errorbook';
import { download, errorsToCsv } from '../lib/exporter';
import { BEREICHE, FEHLERTYPEN, fehlertyp, type Bereich } from '../lib/fehlertypen';
import { typo } from '../lib/normalize';
import { navigate } from '../lib/router';
import { startKlausur, startTargeted } from '../lib/start';
import { addManualError, deleteError, updateError, useApp } from '../lib/store';
import type { ErrorEntry } from '../lib/types';

/** Zeitachsen beginnen links; beim Öffnen steht die jüngste Woche im Blick. */
const scrollToEnd = (el: HTMLElement | null) => {
  if (el) el.scrollLeft = el.scrollWidth;
};

export interface EntryFilter {
  zeitraum: string;
  bereich: string;
  typ: string;
  quelle: string;
  status: string;
  q: string;
  woche?: string;
}

export function filterFromQuery(q: URLSearchParams): EntryFilter {
  return {
    zeitraum: q.get('zeitraum') ?? 'alle',
    bereich: q.get('bereich') ?? '',
    typ: q.get('typ') ?? '',
    quelle: q.get('quelle') ?? '',
    status: q.get('status') ?? '',
    q: q.get('q') ?? '',
    woche: q.get('woche') ?? undefined,
  };
}

export function filterToQuery(f: EntryFilter): string {
  const p = new URLSearchParams();
  if (f.zeitraum !== 'alle') p.set('zeitraum', f.zeitraum);
  if (f.bereich) p.set('bereich', f.bereich);
  if (f.typ) p.set('typ', f.typ);
  if (f.quelle) p.set('quelle', f.quelle);
  if (f.status) p.set('status', f.status);
  if (f.q) p.set('q', f.q);
  if (f.woche) p.set('woche', f.woche);
  const s = p.toString();
  return s ? `?${s}` : '';
}

export function applyFilter(entries: ErrorEntry[], statuses: Map<string, StatusInfo>, f: EntryFilter, today = dayKey()): ErrorEntry[] {
  const q = f.q.trim().toLowerCase();
  return entries.filter((e) => {
    if (f.zeitraum !== 'alle' && diffDays(today, e.tag) >= Number(f.zeitraum)) return false;
    const ft = fehlertyp(e.fehlertyp);
    if (f.bereich && ft?.bereich !== f.bereich) return false;
    if (f.typ && e.fehlertyp !== f.typ) return false;
    if (f.quelle === 'app' && e.herkunft !== 'app') return false;
    if (f.quelle && f.quelle !== 'app' && e.quelle !== f.quelle) return false;
    if (f.status && statuses.get(e.id)?.status !== f.status) return false;
    if (f.woche && weekKey(e.tag) !== f.woche) return false;
    if (q) {
      const hay = `${e.original} ${e.korrektur} ${e.quelle} ${e.notiz ?? ''} ${e.begruendung ?? ''} ${ft?.label ?? ''} ${e.aufgabe ?? ''}`.toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}

function Tabs({ tab }: { tab: string }) {
  const items = [
    { key: 'liste', label: 'Liste', href: '#/fehlerbuch' },
    { key: 'neu', label: 'Erfassen', href: '#/fehlerbuch/neu' },
    { key: 'auswertung', label: 'Auswertung', href: '#/fehlerbuch/auswertung' },
  ];
  return (
    <nav className="subnav" aria-label="Fehlerbuch">
      {items.map((i) => (
        <a key={i.key} href={i.href} aria-current={tab === i.key ? 'page' : undefined}>
          {i.label}
        </a>
      ))}
    </nav>
  );
}

export function Fehlerbuch({ tab, id, query }: { tab: string; id?: string; query: URLSearchParams }) {
  return (
    <div>
      <div className="page-head">
        <div>
          <h1>Fehlerbuch</h1>
          <p className="lead">Jeder Fehler wird festgehalten, einem Typ zugeordnet und in gezielte Übung verwandelt.</p>
        </div>
      </div>
      <Tabs tab={tab === 'eintrag' ? 'liste' : tab} />
      {tab === 'neu' ? <Erfassen /> : tab === 'auswertung' ? <Auswertung /> : tab === 'eintrag' && id ? <Bearbeiten id={id} /> : <Liste query={query} />}
    </div>
  );
}

// ---------- Liste ----------

function StatusBadge({ info }: { info?: StatusInfo }) {
  const s: EntryStatus = info?.status ?? 'offen';
  const cls = s === 'behoben' ? 'ok' : s === 'inUebung' ? 'sicher' : 'outline';
  return (
    <span className={`badge ${cls}`} title={info?.wiedereroeffnet ? 'wieder geöffnet' : undefined}>
      {s === 'behoben' ? <Icon name="check" /> : null}
      {STATUS_LABEL[s]}
      {info?.wiedereroeffnet && s !== 'behoben' ? ' · wieder geöffnet' : ''}
    </span>
  );
}

function Liste({ query }: { query: URLSearchParams }) {
  const data = useApp();
  const [f, setF] = useState<EntryFilter>(() => filterFromQuery(query));
  const [limit, setLimit] = useState(60);
  const [open, setOpen] = useState<string | null>(null);
  const [del, setDel] = useState<ErrorEntry | null>(null);
  const statuses = useMemo(() => allStatuses(data.attempts, data.errors), [data.attempts, data.errors]);
  const sources = useMemo(() => knownSources(data.errors), [data.errors]);
  const filtered = useMemo(() => applyFilter(data.errors, statuses, f).slice().reverse(), [data.errors, statuses, f]);

  useEffect(() => {
    setF(filterFromQuery(query));
  }, [query.toString()]);

  const update = (patch: Partial<EntryFilter>) => {
    const next = { ...f, ...patch };
    if (patch.bereich !== undefined && patch.bereich !== f.bereich) next.typ = '';
    setF(next);
    navigate(`/fehlerbuch${filterToQuery(next)}`, true);
  };

  if (!data.errors.length) {
    return (
      <Empty icon="fehlerbuch" title="Noch keine Einträge" action={<a className="btn primary" href="#/fehlerbuch/neu">Ersten Fehler eintragen</a>}>
        Falsche Antworten aus der App landen hier automatisch. Fehler aus korrigierten Klausuren trägst du selbst ein.
      </Empty>
    );
  }

  const typen = FEHLERTYPEN.filter((t) => !f.bereich || t.bereich === f.bereich);
  const active = f.zeitraum !== 'alle' || f.bereich || f.typ || f.quelle || f.status || f.q || f.woche;

  return (
    <div>
      <div className="filters">
        <div className="search">
          <Icon name="search" />
          <input className="input" type="search" placeholder="Volltextsuche" value={f.q} onChange={(e) => update({ q: e.target.value })} aria-label="Volltextsuche" />
        </div>
        <select className="select" value={f.zeitraum} onChange={(e) => update({ zeitraum: e.target.value })} aria-label="Zeitraum">
          <option value="alle">Gesamter Zeitraum</option>
          <option value="7">Letzte 7 Tage</option>
          <option value="30">Letzte 30 Tage</option>
          <option value="90">Letzte 90 Tage</option>
          <option value="365">Letztes Jahr</option>
        </select>
        <select className="select" value={f.bereich} onChange={(e) => update({ bereich: e.target.value })} aria-label="Bereich">
          <option value="">Alle Bereiche</option>
          {BEREICHE.map((b) => (
            <option key={b.id} value={b.id}>
              {b.label}
            </option>
          ))}
        </select>
        <select className="select" value={f.typ} onChange={(e) => update({ typ: e.target.value })} aria-label="Fehlertyp">
          <option value="">Alle Fehlertypen</option>
          {typen.map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </select>
        <select className="select" value={f.quelle} onChange={(e) => update({ quelle: e.target.value })} aria-label="Quelle">
          <option value="">Alle Quellen</option>
          <option value="app">Aus der App</option>
          {sources.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
        <select className="select" value={f.status} onChange={(e) => update({ status: e.target.value })} aria-label="Status">
          <option value="">Jeder Status</option>
          <option value="offen">offen</option>
          <option value="inUebung">in Übung</option>
          <option value="behoben">behoben</option>
        </select>
      </div>

      <div className="row between wrap" style={{ margin: '18px 0 12px' }}>
        <span className="small muted">
          {filtered.length === 1 ? 'Ein Eintrag' : `${filtered.length} Einträge`}
          {f.woche ? ` · Woche ab ${formatDay(f.woche, true)}` : ''}
          {active ? (
            <>
              {' · '}
              <button className="linklike small" onClick={() => update({ zeitraum: 'alle', bereich: '', typ: '', quelle: '', status: '', q: '', woche: undefined })}>
                Filter zurücksetzen
              </button>
            </>
          ) : null}
        </span>
        <div className="row">
          <button className="btn small" onClick={() => download(`fehlerbuch-${dayKey()}.csv`, errorsToCsv(filtered.slice().reverse(), statuses), 'text/csv')} disabled={!filtered.length}>
            <Icon name="download" /> CSV
          </button>
          <a className="btn small" href={`#/fehlerbuch/druck${filterToQuery(f)}`}>
            <Icon name="print" /> PDF
          </a>
        </div>
      </div>

      {filtered.length ? (
        <div className="list" style={{ display: 'block' }}>
          {filtered.slice(0, limit).map((e) => {
            const ft = fehlertyp(e.fehlertyp);
            const isOpen = open === e.id;
            return (
              <div key={e.id} className="entry">
                <div className="entry-head">
                  <span className="num">{formatRelative(e.tag)}</span>
                  <span>·</span>
                  <strong style={{ color: 'var(--text)' }}>{ft?.label ?? e.fehlertyp}</strong>
                  <span>·</span>
                  <span>{e.herkunft === 'app' ? e.quelle.replace(/^App · /, 'App: ') : e.quelle || 'Arbeit'}</span>
                  <span style={{ flex: 1 }} />
                  <StatusBadge info={statuses.get(e.id)} />
                </div>
                <button
                  className="entry-text"
                  style={{ background: 'none', border: 0, padding: 0, textAlign: 'left', cursor: 'pointer', color: 'inherit', width: '100%' }}
                  onClick={() => setOpen(isOpen ? null : e.id)}
                  aria-expanded={isOpen}
                >
                  <span className="falsch">{typo(e.original)}</span>
                  <span className="arrow">→</span>
                  <span>{typo(e.korrektur)}</span>
                </button>
                {isOpen ? (
                  <div className="entry-details">
                    {e.aufgabe && e.herkunft === 'app' ? <span>Aufgabe: {typo(e.aufgabe)}</span> : null}
                    {e.begruendung ? <span>Begründung: {typo(e.begruendung)}</span> : null}
                    {e.notiz ? <span>Notiz: {e.notiz}</span> : null}
                    <span>
                      Lektion{' '}
                      <a href={`#/lektion/${e.lektion}`}>
                        {e.lektion} {getLesson(e.lektion)?.titel}
                      </a>{' '}
                      · {formatDay(e.tag)}
                    </span>
                    <div className="row" style={{ marginTop: 8 }}>
                      <button className="btn small" onClick={() => startTargeted([e.fehlertyp])}>
                        <Icon name="target" /> Typ üben
                      </button>
                      <a className="btn small ghost" href={`#/fehlerbuch/eintrag/${e.id}`}>
                        <Icon name="edit" /> Bearbeiten
                      </a>
                      <button className="btn small ghost danger" onClick={() => setDel(e)}>
                        <Icon name="trash" /> Löschen
                      </button>
                    </div>
                  </div>
                ) : null}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card flat">
          <p className="muted">Keine Einträge für diese Auswahl.</p>
        </div>
      )}
      {filtered.length > limit ? (
        <div className="actions" style={{ justifyContent: 'center' }}>
          <button className="btn" onClick={() => setLimit(limit + 100)}>
            Weitere anzeigen ({filtered.length - limit})
          </button>
        </div>
      ) : null}

      {del ? (
        <Confirm
          title="Eintrag löschen?"
          text={del.herkunft === 'arbeit' ? 'Der Eintrag und die daraus erzeugte Aufgabe werden gelöscht.' : 'Der Eintrag wird gelöscht. Die Antwort bleibt in der Statistik.'}
          confirmLabel="Löschen"
          danger
          onCancel={() => setDel(null)}
          onConfirm={async () => {
            await deleteError(del.id);
            setDel(null);
            toast('Eintrag gelöscht.');
          }}
        />
      ) : null}
    </div>
  );
}

// ---------- Erfassen ----------

function TypeSelect({ value, onChange, id }: { value: string; onChange: (v: string) => void; id: string }) {
  return (
    <select id={id} className="select" value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">Fehlertyp wählen …</option>
      {BEREICHE.map((b) => (
        <optgroup key={b.id} label={b.label}>
          {FEHLERTYPEN.filter((t) => t.bereich === b.id).map((t) => (
            <option key={t.id} value={t.id}>
              {t.label}
            </option>
          ))}
        </optgroup>
      ))}
    </select>
  );
}

function Erfassen() {
  const data = useApp();
  const sources = useMemo(() => knownSources(data.errors), [data.errors]);
  const [tag, setTag] = useState(dayKey());
  const [quelle, setQuelle] = useState(sources[0] ?? '');
  const [original, setOriginal] = useState('');
  const [korrektur, setKorrektur] = useState('');
  const [typ, setTyp] = useState('');
  const [typManuell, setTypManuell] = useState(false);
  const [notiz, setNotiz] = useState('');
  const [saved, setSaved] = useState<ErrorEntry[]>([]);
  const [fehler, setFehler] = useState<string | null>(null);
  const origRef = useRef<HTMLTextAreaElement>(null);
  const korrRef = useRef<HTMLTextAreaElement>(null);

  const vorschlag = useMemo(() => (original.trim() && korrektur.trim() ? suggestType(original, korrektur) : undefined), [original, korrektur]);
  useEffect(() => {
    if (!typManuell) setTyp(vorschlag ?? '');
  }, [vorschlag, typManuell]);

  const save = async (weiter: boolean) => {
    setFehler(null);
    if (!original.trim()) return setFehler('Trag ein, was in der Arbeit stand.');
    if (!korrektur.trim()) return setFehler('Trag die korrigierte Fassung ein.');
    if (original.trim() === korrektur.trim()) return setFehler('Die korrigierte Fassung gleicht dem Original. Ändere die fehlerhafte Stelle.');
    if (!typ) return setFehler('Wähle einen Fehlertyp.');
    const { entry, related } = await addManualError({ tag, quelle, original, korrektur, fehlertyp: typ, notiz });
    setSaved((s) => [entry, ...s]);
    const lesson = getLesson(entry.lektion);
    toast(`Gespeichert · Lektion ${lesson?.id ?? entry.lektion} · eigene Aufgabe angelegt · ${related} verwandte Aufgaben in der Wiederholung`);
    setOriginal('');
    setKorrektur('');
    setNotiz('');
    setTyp('');
    setTypManuell(false);
    if (weiter) origRef.current?.focus();
    else navigate('/fehlerbuch');
  };

  return (
    <div className="stack">
      <form
        className="card"
        onSubmit={(e) => {
          e.preventDefault();
          void save(true);
        }}
      >
        <div className="grid-2">
          <div className="field">
            <label htmlFor="e-datum">Datum</label>
            <input id="e-datum" type="date" className="input" value={tag} onChange={(e) => setTag(e.target.value || dayKey())} max={addDays(dayKey(), 0)} />
          </div>
          <div className="field">
            <label htmlFor="e-quelle">Quelle</label>
            <input
              id="e-quelle"
              className="input"
              list="e-quellen"
              value={quelle}
              onChange={(e) => setQuelle(e.target.value)}
              placeholder="z. B. Deutschklausur 2, Textanalyse"
            />
            <datalist id="e-quellen">
              {sources.map((s) => (
                <option key={s} value={s} />
              ))}
            </datalist>
            {sources.length ? (
              <div className="source-chips">
                {sources.slice(0, 3).map((s) => (
                  <button type="button" key={s} className="chip" aria-pressed={quelle === s} onClick={() => setQuelle(s)}>
                    {s}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="e-orig">So stand es da</label>
          <textarea
            id="e-orig"
            ref={origRef}
            className="textarea read"
            rows={2}
            style={{ minHeight: 72 }}
            value={original}
            onChange={(e) => setOriginal(e.target.value)}
            onBlur={() => {
              if (original.trim() && !korrektur.trim()) setKorrektur(original);
            }}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                if (original.trim() && !korrektur.trim()) setKorrektur(original);
                korrRef.current?.focus();
              }
            }}
            placeholder="Der fehlerhafte Satz oder Ausdruck"
            autoFocus
            {...NO_AUTOCORRECT}
          />
        </div>
        <div className="field" style={{ marginTop: 16 }}>
          <label htmlFor="e-korr">Richtig</label>
          <textarea
            id="e-korr"
            ref={korrRef}
            className="textarea read"
            rows={2}
            style={{ minHeight: 72 }}
            value={korrektur}
            onChange={(e) => setKorrektur(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void save(true);
              }
            }}
            placeholder="Die korrigierte Fassung"
            {...NO_AUTOCORRECT}
          />
          <span className="hint">Wird mit dem Original vorbelegt – ändere nur die fehlerhafte Stelle.</span>
        </div>
        <div className="grid-2" style={{ marginTop: 16 }}>
          <div className="field">
            <label htmlFor="e-typ">Fehlertyp</label>
            <TypeSelect
              id="e-typ"
              value={typ}
              onChange={(v) => {
                setTyp(v);
                setTypManuell(true);
              }}
            />
            {vorschlag ? (
              <span className="hint">
                Vorschlag nach der Abweichung: {fehlertyp(vorschlag)?.label}
                {typManuell && typ !== vorschlag ? (
                  <>
                    {' · '}
                    <button
                      type="button"
                      className="linklike small"
                      onClick={() => {
                        setTyp(vorschlag);
                        setTypManuell(false);
                      }}
                    >
                      übernehmen
                    </button>
                  </>
                ) : null}
              </span>
            ) : (
              <span className="hint">Die App schlägt einen Typ vor, sobald beide Fassungen eingetragen sind.</span>
            )}
          </div>
          <div className="field">
            <label htmlFor="e-notiz">Notiz (freiwillig)</label>
            <input id="e-notiz" className="input" value={notiz} onChange={(e) => setNotiz(e.target.value)} placeholder="z. B. Anmerkung der Lehrkraft" />
          </div>
        </div>
        {fehler ? (
          <div className="notice error" style={{ marginTop: 16 }} role="alert">
            <Icon name="alert" />
            <span>{fehler}</span>
          </div>
        ) : null}
        <div className="actions">
          <button type="button" className="btn" onClick={() => void save(false)}>
            Speichern und fertig
          </button>
          <button type="submit" className="btn primary">
            Speichern, nächster Fehler <span className="kbd">↵</span>
          </button>
        </div>
      </form>

      <div className="card flat">
        <p className="small muted">
          Nach dem Speichern verknüpft die App den Eintrag mit der passenden Lektion, legt den Satz als Aufgabe „Fehler finden“ an und nimmt fünf verwandte Aufgaben in die tägliche Wiederholung auf. Datum und Quelle bleiben stehen, damit du mehrere Fehler derselben Arbeit hintereinander erfasst.
        </p>
      </div>

      {saved.length ? (
        <div>
          <h3 style={{ marginBottom: 10 }}>Gerade erfasst ({saved.length})</h3>
          <div className="list" style={{ display: 'block' }}>
            {saved.map((e) => (
              <div key={e.id} className="entry">
                <div className="entry-head">
                  <strong style={{ color: 'var(--text)' }}>{fehlertyp(e.fehlertyp)?.label}</strong>
                  <span>·</span>
                  <span>{e.quelle || 'ohne Quelle'}</span>
                  <span>·</span>
                  <span>Lektion {e.lektion}</span>
                </div>
                <div className="entry-text">
                  <span className="falsch">{typo(e.original)}</span>
                  <span className="arrow">→</span>
                  <span>{typo(e.korrektur)}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

// ---------- Bearbeiten ----------

function Bearbeiten({ id }: { id: string }) {
  const data = useApp();
  const entry = data.errors.find((e) => e.id === id);
  const [draft, setDraft] = useState<ErrorEntry | null>(entry ?? null);
  const [del, setDel] = useState(false);
  if (!entry || !draft) {
    return (
      <Empty title="Eintrag nicht gefunden" action={<a className="btn" href="#/fehlerbuch">Zur Liste</a>}>
        Der Eintrag wurde gelöscht.
      </Empty>
    );
  }
  const set = (patch: Partial<ErrorEntry>) => setDraft({ ...draft, ...patch });
  return (
    <form
      className="card"
      onSubmit={async (e) => {
        e.preventDefault();
        await updateError(id, {
          tag: draft.tag,
          quelle: draft.quelle,
          original: draft.original,
          korrektur: draft.korrektur,
          fehlertyp: draft.fehlertyp,
          notiz: draft.notiz,
        });
        toast('Änderungen gespeichert.');
        navigate('/fehlerbuch');
      }}
    >
      <div className="grid-2">
        <div className="field">
          <label htmlFor="b-datum">Datum</label>
          <input id="b-datum" type="date" className="input" value={draft.tag} onChange={(e) => set({ tag: e.target.value || draft.tag })} />
        </div>
        <div className="field">
          <label htmlFor="b-quelle">Quelle</label>
          <input id="b-quelle" className="input" value={draft.quelle} onChange={(e) => set({ quelle: e.target.value })} disabled={draft.herkunft === 'app'} />
        </div>
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="b-orig">{draft.herkunft === 'app' ? 'Deine Antwort' : 'So stand es da'}</label>
        <textarea id="b-orig" className="textarea read" style={{ minHeight: 72 }} value={draft.original} onChange={(e) => set({ original: e.target.value })} {...NO_AUTOCORRECT} />
      </div>
      <div className="field" style={{ marginTop: 16 }}>
        <label htmlFor="b-korr">Richtig</label>
        <textarea id="b-korr" className="textarea read" style={{ minHeight: 72 }} value={draft.korrektur} onChange={(e) => set({ korrektur: e.target.value })} {...NO_AUTOCORRECT} />
      </div>
      <div className="grid-2" style={{ marginTop: 16 }}>
        <div className="field">
          <label htmlFor="b-typ">Fehlertyp</label>
          <TypeSelect id="b-typ" value={draft.fehlertyp} onChange={(v) => v && set({ fehlertyp: v })} />
        </div>
        <div className="field">
          <label htmlFor="b-notiz">Notiz</label>
          <input id="b-notiz" className="input" value={draft.notiz ?? ''} onChange={(e) => set({ notiz: e.target.value })} />
        </div>
      </div>
      <div className="actions">
        <button type="button" className="btn ghost danger" onClick={() => setDel(true)}>
          <Icon name="trash" /> Löschen
        </button>
        <span className="spacer" />
        <a className="btn" href="#/fehlerbuch">
          Abbrechen
        </a>
        <button type="submit" className="btn primary">
          Speichern
        </button>
      </div>
      {del ? (
        <Confirm
          title="Eintrag löschen?"
          text="Der Eintrag wird endgültig gelöscht."
          confirmLabel="Löschen"
          danger
          onCancel={() => setDel(false)}
          onConfirm={async () => {
            await deleteError(id);
            toast('Eintrag gelöscht.');
            navigate('/fehlerbuch');
          }}
        />
      ) : null}
    </form>
  );
}

// ---------- Auswertung ----------

function heatClass(n: number, max: number): string {
  if (!n) return '';
  const r = n / Math.max(1, max);
  return r > 0.75 ? 'h4' : r > 0.5 ? 'h3' : r > 0.25 ? 'h2' : 'h1';
}

function Auswertung() {
  const data = useApp();
  const today = dayKey();
  const statuses = useMemo(() => allStatuses(data.attempts, data.errors), [data.attempts, data.errors]);
  const weakest = useMemo(() => weakestTypes(data.attempts, data.errors, today, 3, statuses), [data.attempts, data.errors, today, statuses]);
  const works = useMemo(() => arbeiten(data.errors), [data.errors]);

  // Verlauf: Häufigkeit je Fehlertyp über die letzten 8 Wochen
  const weeks = useMemo(() => {
    const w0 = weekKey(addDays(today, -7 * 7));
    return Array.from({ length: 8 }, (_, i) => addDays(w0, 7 * i));
  }, [today]);
  const verlauf = useMemo(() => {
    const m = new Map<string, Map<string, number>>();
    for (const e of data.errors) {
      const w = weekKey(e.tag);
      if (w < weeks[0]) continue;
      if (!m.has(e.fehlertyp)) m.set(e.fehlertyp, new Map());
      const r = m.get(e.fehlertyp)!;
      r.set(w, (r.get(w) ?? 0) + 1);
    }
    return [...m.entries()]
      .map(([typ, r]) => ({ typ, r, total: [...r.values()].reduce((a, b) => a + b, 0) }))
      .sort((a, b) => b.total - a.total)
      .slice(0, 8);
  }, [data.errors, weeks]);
  const maxCell = Math.max(1, ...verlauf.flatMap((v) => [...v.r.values()]));

  const counts = { offen: 0, inUebung: 0, behoben: 0 };
  for (const s of statuses.values()) counts[s.status]++;

  return (
    <div className="stack">
      <div className="card">
        <div className="card-title">
          <h2>Fehlerprofil</h2>
          <span className="small muted">die drei schwächsten Fehlertypen</span>
        </div>
        {weakest.length ? (
          <>
            <div className="bars">
              {weakest.map((w) => (
                <button key={w.typ} className="bar-row" onClick={() => navigate(`/fehlerbuch?typ=${w.typ}`)}>
                  <span>{fehlertyp(w.typ)?.label}</span>
                  <span className="bar-track">
                    <span className="bar-fill" style={{ display: 'block', width: `${Math.round(w.score * 100)}%` }} />
                  </span>
                  <span className="val">{w.falsch + w.arbeit}</span>
                </button>
              ))}
            </div>
            <p className="small muted" style={{ marginTop: 10 }}>
              Gewichtet nach Fehlerquote der letzten 30 Tage; Fehler aus echten Arbeiten zählen doppelt.
            </p>
            <button className="btn primary" style={{ marginTop: 14 }} onClick={() => startTargeted(weakest.map((w) => w.typ))}>
              <Icon name="target" /> Jetzt gezielt üben
            </button>
          </>
        ) : (
          <p className="muted">Noch keine offenen Fehler. Das Profil entsteht, sobald Fehler im Fehlerbuch stehen.</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Status</h2>
        </div>
        <div className="stat-row" style={{ gridTemplateColumns: 'repeat(3, 1fr)' }}>
          {(['offen', 'inUebung', 'behoben'] as const).map((s) => (
            <button key={s} className="stat" onClick={() => navigate(`/fehlerbuch?status=${s}`)}>
              <span className="value">{counts[s]}</span>
              <span className="label">{STATUS_LABEL[s]}</span>
            </button>
          ))}
        </div>
        <p className="small muted" style={{ marginTop: 12 }}>
          Behoben ist ein Eintrag, wenn sein Fehlertyp fünfmal in Folge an mindestens drei verschiedenen Tagen richtig beantwortet wurde. Tritt der Typ erneut auf, öffnet sich der Eintrag wieder.
        </p>
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Verlauf</h2>
          <span className="small muted">Fehler je Typ und Woche</span>
        </div>
        {verlauf.length ? (
          <div className="table-wrap heat" style={{ border: 0 }} ref={scrollToEnd}>
            <table className="data">
              <thead>
                <tr>
                  <th>Fehlertyp</th>
                  {weeks.map((w) => (
                    <th key={w} className="r">
                      {formatDay(w, true)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {verlauf.map((v) => (
                  <tr key={v.typ}>
                    <td>{fehlertyp(v.typ)?.label}</td>
                    {weeks.map((w) => {
                      const n = v.r.get(w) ?? 0;
                      return (
                        <td key={w} className="cell">
                          {n ? (
                            <button className={heatClass(n, maxCell)} onClick={() => navigate(`/fehlerbuch?typ=${v.typ}&woche=${w}`)} aria-label={`${n} Fehler in der Woche ab ${formatDay(w)}`}>
                              {n}
                            </button>
                          ) : (
                            <span className="muted">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="muted">In den letzten acht Wochen gibt es keine Einträge.</p>
        )}
      </div>

      <div className="card">
        <div className="card-title">
          <h2>Arbeiten im Vergleich</h2>
        </div>
        {works.length ? (
          <>
            <div className="table-wrap" style={{ border: 0 }}>
              <table className="data">
                <thead>
                  <tr>
                    <th>Bereich</th>
                    {works.map((w) => (
                      <th key={w.quelle} className="r" style={{ whiteSpace: 'normal', minWidth: 90 }}>
                        {w.quelle}
                        <div className="tiny muted" style={{ fontWeight: 500 }}>
                          {formatDay(w.ersterTag, true)}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {BEREICHE.map((b) => (
                    <tr key={b.id}>
                      <td>{b.label}</td>
                      {works.map((w) => {
                        const n = [...w.typen.entries()].filter(([t]) => fehlertyp(t)?.bereich === (b.id as Bereich)).reduce((a, [, c]) => a + c, 0);
                        return (
                          <td key={w.quelle} className="r">
                            {n ? (
                              <button className="linklike" onClick={() => navigate(`/fehlerbuch?quelle=${encodeURIComponent(w.quelle)}&bereich=${b.id}`)}>
                                {n}
                              </button>
                            ) : (
                              <span className="muted">–</span>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                  <tr className="total">
                    <td>Fehler gesamt</td>
                    {works.map((w) => (
                      <td key={w.quelle} className="r">
                        <button className="linklike" onClick={() => navigate(`/fehlerbuch?quelle=${encodeURIComponent(w.quelle)}`)}>
                          {w.anzahl}
                        </button>
                      </td>
                    ))}
                  </tr>
                </tbody>
              </table>
            </div>
            {works.length >= 2 ? (
              <p className="small" style={{ marginTop: 12 }}>
                {works[works.length - 1].anzahl < works[works.length - 2].anzahl
                  ? `Die letzte Arbeit hat ${works[works.length - 2].anzahl - works[works.length - 1].anzahl} Fehler weniger als die vorige.`
                  : works[works.length - 1].anzahl > works[works.length - 2].anzahl
                    ? `Die letzte Arbeit hat ${works[works.length - 1].anzahl - works[works.length - 2].anzahl} Fehler mehr als die vorige.`
                    : 'Die letzten beiden Arbeiten haben gleich viele Fehler.'}
              </p>
            ) : null}
          </>
        ) : (
          <p className="muted">Trag Fehler aus korrigierten Arbeiten ein. Dann siehst du hier, ob die Klausuren sauberer werden.</p>
        )}
      </div>

      <div className="grid-2">
        <div className="card">
          <div className="card-title">
            <h3>Vor der Klausur</h3>
            <Icon name="timer" className="muted" />
          </div>
          <p className="small muted">15 Minuten aus deinen häufigsten eigenen Fehlertypen, danach die Prüfroutine als Checkliste.</p>
          <button className="btn wide" style={{ marginTop: 14 }} onClick={() => startKlausur()}>
            Sitzung starten
          </button>
        </div>
        <div className="card">
          <div className="card-title">
            <h3>Export</h3>
            <Icon name="download" className="muted" />
          </div>
          <p className="small muted">Das ganze Fehlerbuch als Tabelle oder als druckbares PDF.</p>
          <div className="row" style={{ marginTop: 14 }}>
            <button className="btn" onClick={() => download(`fehlerbuch-${dayKey()}.csv`, errorsToCsv(data.errors, statuses), 'text/csv')} disabled={!data.errors.length}>
              <Icon name="download" /> CSV
            </button>
            <a className="btn" href="#/fehlerbuch/druck">
              <Icon name="print" /> PDF
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
