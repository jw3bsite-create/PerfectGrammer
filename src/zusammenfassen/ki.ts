// Optionale KI-Bewertung eigener Texte: Einleitung, Abschnitt, Schluss oder ganze Zusammenfassung.
// Anbieter: Claude über die Anthropic-API (eigener API-Schlüssel, kostet pro Anfrage ein paar Cent)
// oder eine lokale KI (kostenlos, die Daten bleiben auf dem Rechner): Ollama oder ein Programm mit
// OpenAI-Schnittstelle wie LM Studio, Jan oder llama.cpp.
// Die KI ist eine zweite Meinung; Checkliste und Musterlösung bleiben maßgeblich.

import { KATEGORIEN } from './daten';
import type { ZKi } from './typen';

export type KiTeil = 'einleitung' | 'abschnitt' | 'schluss' | 'volltext';

export interface KiKriterium {
  kriterium: string;
  erfuellt: boolean;
  begruendung: string;
}

export interface KiFehler {
  kategorie: string;
  stelle: string;
  art: string;
}

export interface KiBewertung {
  kriterien: KiKriterium[];
  fehler: KiFehler[];
  gesamt: string;
  tipp: string;
}

export interface KiAntwort extends KiBewertung {
  roh: string;
}

export interface KiAnfrage {
  teil: KiTeil;
  /** Autor, Titel, Textsorte, Medium und Datum als Zeile. */
  angaben: string;
  /** Der Originaltext (oder bei „abschnitt“ nur der Abschnitt). */
  original: string;
  /** Musterlösung der Lehrkraft, nur zur Orientierung. */
  muster?: string;
  /** Der Text der Schülerin oder des Schülers. */
  eigen: string;
}

export const CLAUDE_STANDARD = 'claude-opus-5-5';
export const OLLAMA_STANDARD = 'qwen2.5:7b';

// ---------- Erwartungen und Kriterien ----------

export const KI_REGELN = [
  'Einleitung: Textsorte, Titel, Autor, Erscheinungsort und -datum, Thema und Kernaussage in höchstens zwei Sätzen.',
  'Hauptteil: etwa ein Satz pro Sinnabschnitt in der Reihenfolge des Textes, eigene Satzbauweise, Funktionsverben (stellt dar, kritisiert, widerspricht, schlägt vor, fordert, beruft sich auf), Präsens.',
  'Behauptungen des Autors in indirekter Rede: Singular Konjunktiv I (sei, habe, müsse); Plural würden + Infinitiv, außer seien und hätten. Handlungen des Autors (fordert, kritisiert) im Indikativ. Nach „dass“ ist der Indikativ erlaubt. Jeder Konjunktiv braucht einen Rahmen wie „Der Autor behauptet, …“.',
  'Keine Zeilenangaben, keine Umgangssprache, keine Zeichen wie % oder &, keine eigene Wertung, nichts dazudichten, Kern statt Beispiel, keine Abschwächung (ein „muss“ wird nicht zu „sollte“, „fordert“ nicht zu „empfiehlt“).',
  'Schluss: Gesamtaussage des ganzen Textes in ein bis zwei Sätzen, ohne neue Inhalte und ohne Stellungnahme. Insgesamt knapp, etwa zehn Sätze; die Musterlösung ist höchstens 80 Prozent so lang wie der Text.',
];

export const KI_KRITERIEN: Record<KiTeil, string[]> = {
  einleitung: [
    'Textsorte genannt und zutreffend',
    'Titel genannt',
    'Autor genannt',
    'Erscheinungsort und Erscheinungsdatum genannt',
    'Thema treffend benannt',
    'Kernaussage (These) erfasst, nicht nur das Thema',
    'Höchstens zwei Sätze, Präsens, sachlich, ohne Wertung und Zeilenangabe',
  ],
  abschnitt: [
    'Kern des Abschnitts getroffen, nicht nur ein Beispiel oder Detail',
    'Nichts dazugedichtet, nichts verfälscht',
    'Stärke der Aussage genau wiedergegeben (keine Abschwächung, keine Verstärkung)',
    'Funktionsverb, das trifft, was der Autor im Abschnitt tut',
    'Indirekte Rede richtig: Konjunktiv I im Singular, würden + Infinitiv im Plural (außer seien/hätten), Handlungen des Autors im Indikativ, Rahmen vorhanden',
    'Eigene Formulierung statt abgeschriebener Sätze',
    'Knapp, Präsens, sachlich, ohne Umgangssprache, Wertung und Zeilenangabe',
  ],
  schluss: [
    'Gesamtaussage des ganzen Textes getroffen, nicht nur ein Teilaspekt',
    'Keine neuen Inhalte, nichts dazugedichtet',
    'Keine eigene Wertung oder Stellungnahme',
    'Ein bis zwei Sätze',
    'Präsens, sachlich, indirekte Rede richtig',
  ],
  volltext: [
    'Einleitung vollständig (Textsorte, Titel, Autor, Ort, Datum, Thema, Kernaussage)',
    'Struktur erkennbar: Abschnitte in der Reihenfolge des Textes, jeweils mit Funktionsverb',
    'These enthalten',
    'Kern statt Beispiel',
    'Nichts dazugedichtet, keine Abschwächung',
    'Indirekte Rede richtig (Konjunktiv, Rahmen, keine Modusmischung)',
    'Präsens, kein Präteritum',
    'Sachliche Sprache ohne Umgangssprache, Zeichen und Zeilenangaben',
    'Länge angemessen (knapp, etwa zehn Sätze)',
    'Schluss gibt die Gesamtaussage wieder, ohne Wertung',
  ],
};

const TEIL_NAME: Record<KiTeil, string> = {
  einleitung: 'die Einleitung einer Textwiedergabe',
  abschnitt: 'die Zusammenfassung eines einzelnen Sinnabschnitts (ein Satz des Hauptteils)',
  schluss: 'den Schluss einer Textwiedergabe',
  volltext: 'eine vollständige strukturierte Textwiedergabe (Einleitung, Hauptteil, Schluss)',
};

const ORIGINAL_NAME: Record<KiTeil, string> = {
  einleitung: 'ORIGINALTEXT',
  abschnitt: 'ABSCHNITT DES ORIGINALTEXTES',
  schluss: 'ORIGINALTEXT',
  volltext: 'ORIGINALTEXT',
};

/** Anweisung an die KI für einen Teil. */
export function kiSystemPrompt(teil: KiTeil = 'volltext'): string {
  const kriterien = KI_KRITERIEN[teil];
  return [
    `Du bist eine erfahrene Deutschlehrkraft der gymnasialen Oberstufe in Baden-Württemberg und bewertest ${TEIL_NAME[teil]} zu einem Sachtext, geschrieben von einer Schülerin oder einem Schüler, die sich auf das Abitur vorbereiten.`,
    '',
    'Es gelten die Erwartungen der Lehrkraft:',
    ...KI_REGELN.map((r) => `- ${r}`),
    '',
    'Prüfe genau diese Kriterien, in dieser Reihenfolge, und gib für jedes an, ob es erfüllt ist:',
    ...kriterien.map((k, i) => `${i + 1}. ${k}`),
    '',
    'So gehst du vor:',
    '- Vergleiche den Schülertext Satz für Satz mit dem Original. Die Musterlösung dient nur zur Orientierung: Andere Formulierungen sind richtig, wenn sie dasselbe sagen.',
    '- Sei streng wie im Abitur, aber gerecht: Werte nur echte Fehler, keine Geschmacksfragen. Wenn du unsicher bist, ob etwas ein Fehler ist, werte es nicht als Fehler.',
    '- Eine Begründung ist ein kurzer Satz. Bei nicht erfüllten Kriterien nennst du, was genau fehlt oder falsch ist.',
    `- Liste jeden einzelnen Fehler unter „fehler“: die Stelle als wörtliches Zitat aus dem Schülertext (höchstens zwölf Wörter), die Kategorie (genau eine dieser Bezeichnungen: ${KATEGORIEN.map((k) => `„${k.label}“`).join(', ')}) und die Fehlerart in einem kurzen Satz.`,
    '- „gesamt“: ein Satz mit deinem Gesamturteil, sachlich und ohne Lob.',
    '- „tipp“: der eine wichtigste nächste Schritt zum Üben, als Arbeitsauftrag formuliert.',
    '- Schreib keine verbesserte Fassung, keine Musterlösung und keine fertigen Formulierungen. Die Schülerin oder der Schüler soll selbst verbessern.',
    '- Sprich die Person mit „du“ an. Antworte auf Deutsch und ausschließlich mit JSON nach dem vorgegebenen Schema: {"kriterien":[{"kriterium":"…","erfuellt":true,"begruendung":"…"}],"fehler":[{"kategorie":"…","stelle":"…","art":"…"}],"gesamt":"…","tipp":"…"}.',
  ].join('\n');
}

export function kiNachricht(a: KiAnfrage): string {
  return [
    `TEXTANGABEN:\n${a.angaben}`,
    `${ORIGINAL_NAME[a.teil]}:\n${a.original}`,
    a.muster ? `MUSTERLÖSUNG DER LEHRKRAFT (nur zur Orientierung):\n${a.muster}` : '',
    `SCHÜLERTEXT (zu bewerten):\n${a.eigen}`,
  ]
    .filter(Boolean)
    .join('\n\n');
}

/** JSON-Schema der Antwort; Claude und Ollama halten sich damit an die Form. */
export const KI_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['kriterien', 'fehler', 'gesamt', 'tipp'],
  properties: {
    kriterien: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kriterium', 'erfuellt', 'begruendung'],
        properties: { kriterium: { type: 'string' }, erfuellt: { type: 'boolean' }, begruendung: { type: 'string' } },
      },
    },
    fehler: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['kategorie', 'stelle', 'art'],
        properties: { kategorie: { type: 'string' }, stelle: { type: 'string' }, art: { type: 'string' } },
      },
    },
    gesamt: { type: 'string' },
    tipp: { type: 'string' },
  },
} as const;

// ---------- Antwort lesen ----------

export function kiAntwortLesen(roh: string): KiBewertung {
  const leer: KiBewertung = { kriterien: [], fehler: [], gesamt: '', tipp: '' };
  // Denkende lokale Modelle schreiben vorher „<think>…</think>“; das gehört nicht zur Antwort.
  const m = roh.replace(/<think>[\s\S]*?<\/think>/g, '').match(/\{[\s\S]*\}/);
  if (!m) return leer;
  try {
    const j = JSON.parse(m[0]) as Record<string, unknown>;
    const liste = (x: unknown) => (Array.isArray(x) ? x.filter((f): f is Record<string, unknown> => !!f && typeof f === 'object') : []);
    return {
      kriterien: liste(j.kriterien)
        .map((k) => ({ kriterium: String(k.kriterium ?? ''), erfuellt: k.erfuellt === true || k.erfuellt === 'true', begruendung: String(k.begruendung ?? '') }))
        .filter((k) => k.kriterium),
      fehler: liste(j.fehler)
        .map((f) => ({ kategorie: String(f.kategorie ?? ''), stelle: String(f.stelle ?? ''), art: String(f.art ?? '') }))
        .filter((f) => f.art || f.stelle),
      gesamt: typeof j.gesamt === 'string' ? j.gesamt : '',
      tipp: typeof j.tipp === 'string' ? j.tipp : '',
    };
  } catch {
    return leer;
  }
}

// ---------- API-Schlüssel ----------
// Der Schlüssel liegt nur im Browser dieses Rechners, nicht in der Datensicherung.

const SCHLUESSEL = 'perfectgrammar-claude-key';

export function kiSchluessel(): string {
  try {
    return localStorage.getItem(SCHLUESSEL) ?? '';
  } catch {
    return '';
  }
}

export function kiSchluesselSetzen(k: string) {
  try {
    if (k.trim()) localStorage.setItem(SCHLUESSEL, k.trim());
    else localStorage.removeItem(SCHLUESSEL);
  } catch {
    /* privater Modus: dann eben nicht gespeichert */
  }
}

// ---------- Anfragen ----------

async function claudeClient(apiKey: string) {
  if (!apiKey) throw new Error('Es ist noch kein API-Schlüssel eingetragen.');
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  // Die App läuft nur auf dem eigenen Rechner und mit dem eigenen Schlüssel; deshalb ist der Aufruf aus dem Browser hier vertretbar.
  return new Anthropic({ apiKey, dangerouslyAllowBrowser: true, maxRetries: 1 });
}

function claudeFehler(e: unknown): Error {
  const status = (e as { status?: number })?.status;
  const text = e instanceof Error ? e.message : String(e);
  if (status === 401) return new Error('Der API-Schlüssel wird nicht angenommen. Prüfe ihn unter „KI“.');
  if (status === 403) return new Error('Der API-Schlüssel hat keine Berechtigung für dieses Modell.');
  if (status === 404) return new Error('Das Modell gibt es nicht. Prüfe den Modellnamen unter „KI“.');
  if (status === 429) return new Error('Zu viele Anfragen. Warte eine Minute und versuch es dann noch einmal.');
  if (status === 400 && /credit|balance|billing/i.test(text)) return new Error('Das Guthaben des API-Kontos ist aufgebraucht. Lade es in der Claude Console auf.');
  if (status && status >= 500) return new Error('Der KI-Dienst ist gerade überlastet. Versuch es gleich noch einmal.');
  if (/fetch|network|Failed/i.test(text)) return new Error('Keine Verbindung zum KI-Dienst. Bist du online?');
  return new Error(text);
}

async function claudeBewerten(ki: ZKi, a: KiAnfrage, signal?: AbortSignal): Promise<string> {
  const client = await claudeClient(kiSchluessel());
  try {
    const msg = await client.messages.create(
      {
        model: ki.claudeModell || CLAUDE_STANDARD,
        max_tokens: 16000,
        system: kiSystemPrompt(a.teil),
        messages: [{ role: 'user', content: kiNachricht(a) }],
        output_config: { format: { type: 'json_schema', schema: KI_SCHEMA as unknown as Record<string, unknown> } },
      },
      { signal },
    );
    if (msg.stop_reason === 'refusal') throw new Error('Die KI hat die Bewertung abgelehnt.');
    return msg.content.map((b) => (b.type === 'text' ? b.text : '')).join('');
  } catch (e) {
    throw claudeFehler(e);
  }
}

/** Adresse ohne Schrägstrich und ohne „/v1“ am Ende (LM Studio zeigt die Adresse mit „/v1“ an). */
function basis(ki: Pick<ZKi, 'url'>): string {
  return ki.url.trim().replace(/\/+$/, '').replace(/\/v1$/, '');
}

async function ollamaBewerten(ki: ZKi, a: KiAnfrage, signal?: AbortSignal): Promise<string> {
  let res: Response;
  try {
    res = await fetch(`${basis(ki)}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: ki.modell,
        stream: false,
        format: KI_SCHEMA,
        // Ohne größeres Kontextfenster schneidet Ollama lange Texte stillschweigend ab.
        options: { temperature: 0.1, num_ctx: 8192 },
        messages: [
          { role: 'system', content: kiSystemPrompt(a.teil) },
          { role: 'user', content: kiNachricht(a) },
        ],
      }),
    });
  } catch {
    throw new Error('Keine Verbindung zu Ollama. Läuft Ollama auf diesem Rechner?');
  }
  if (!res.ok) throw new Error(`Ollama antwortet mit Fehler ${res.status}.`);
  const j = (await res.json()) as { message?: { content?: string } };
  return j.message?.content ?? '';
}

const OPENAI_HILFE = 'Läuft der Server? In LM Studio: links „Developer“, dann „Start Server“ und in den Einstellungen „Enable CORS“ einschalten.';

async function openaiBewerten(ki: ZKi, a: KiAnfrage, signal?: AbortSignal): Promise<string> {
  const anfrage = (mitSchema: boolean) =>
    fetch(`${basis(ki)}/v1/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal,
      body: JSON.stringify({
        model: ki.modell,
        stream: false,
        temperature: 0.1,
        messages: [
          { role: 'system', content: kiSystemPrompt(a.teil) },
          { role: 'user', content: kiNachricht(a) },
        ],
        ...(mitSchema ? { response_format: { type: 'json_schema', json_schema: { name: 'bewertung', strict: true, schema: KI_SCHEMA } } } : {}),
      }),
    });
  let res: Response;
  try {
    res = await anfrage(true);
    // Nicht jeder Server kennt „json_schema“: dann ohne, die Anweisung verlangt JSON ohnehin.
    if (res.status === 400 || res.status === 422) res = await anfrage(false);
  } catch (e) {
    if (signal?.aborted) throw e;
    throw new Error(`Keine Verbindung zur lokalen KI unter ${basis(ki)}. ${OPENAI_HILFE}`);
  }
  if (!res.ok) throw new Error(`Die lokale KI antwortet mit Fehler ${res.status}. Ist das Modell „${ki.modell}“ geladen?`);
  const j = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return j.choices?.[0]?.message?.content ?? '';
}

export async function kiBewerten(ki: ZKi, a: KiAnfrage, signal?: AbortSignal): Promise<KiAntwort> {
  const roh = ki.anbieter === 'claude' ? await claudeBewerten(ki, a, signal) : ki.anbieter === 'openai' ? await openaiBewerten(ki, a, signal) : await ollamaBewerten(ki, a, signal);
  const b = kiAntwortLesen(roh);
  if (!b.kriterien.length && !b.fehler.length && !b.gesamt) throw new Error('Die Antwort der KI war nicht lesbar. Versuch es noch einmal.');
  return { ...b, roh };
}

/** Prüft die Verbindung: bei Claude Schlüssel und Modell, bei Ollama ob das Modell installiert ist. */
export async function kiTesten(ki: ZKi, apiKey = kiSchluessel()): Promise<{ ok: boolean; text: string }> {
  if (ki.anbieter === 'claude') {
    try {
      const client = await claudeClient(apiKey);
      const m = await client.models.retrieve(ki.claudeModell || CLAUDE_STANDARD);
      return { ok: true, text: `Verbunden. Modell „${m.display_name ?? m.id}“ ist verfügbar.` };
    } catch (e) {
      return { ok: false, text: claudeFehler(e).message };
    }
  }
  const name = ki.anbieter === 'openai' ? 'Die lokale KI' : 'Ollama';
  try {
    const modelle = await modelleLaden(ki.anbieter === 'openai' ? 'openai' : 'ollama', ki.url);
    if (!ki.modell.trim()) return { ok: false, text: `Verbunden, aber es ist kein Modell gewählt. Verfügbar: ${modelle.join(', ') || 'keins'}.` };
    const da = modelle.some((m) => m === ki.modell || m.split(':')[0] === ki.modell);
    return da
      ? { ok: true, text: `Verbunden. Modell „${ki.modell}“ ist bereit.` }
      : { ok: false, text: `Verbunden, aber das Modell „${ki.modell}“ fehlt. Verfügbar: ${modelle.join(', ') || 'keins'}.` };
  } catch (e) {
    if (e instanceof Error && e.message.startsWith('Fehler')) return { ok: false, text: `${name} antwortet mit ${e.message}.` };
    return { ok: false, text: ki.anbieter === 'openai' ? `Keine Verbindung. ${OPENAI_HILFE}` : 'Keine Verbindung. Läuft Ollama auf diesem Rechner? Unter Windows sitzt es nach dem Start als Lama-Symbol unten rechts bei der Uhr.' };
  }
}

/** Ist die KI eingeschaltet und (bei Claude) ein Schlüssel eingetragen? */
export function kiBereit(ki: ZKi): boolean {
  return ki.aktiv && (ki.anbieter !== 'claude' || !!kiSchluessel());
}

// ---------- Lokale KI finden ----------

export type LokalArt = 'ollama' | 'openai';

export interface LokalFund {
  anbieter: LokalArt;
  name: string;
  url: string;
  modelle: string[];
}

/** Übliche Adressen lokaler KI-Programme. */
export const LOKAL_KANDIDATEN: { anbieter: LokalArt; name: string; url: string }[] = [
  { anbieter: 'ollama', name: 'Ollama', url: 'http://localhost:11434' },
  { anbieter: 'openai', name: 'LM Studio', url: 'http://localhost:1234' },
  { anbieter: 'openai', name: 'Jan', url: 'http://localhost:1337' },
  { anbieter: 'openai', name: 'GPT4All', url: 'http://localhost:4891' },
  { anbieter: 'openai', name: 'llama.cpp oder LocalAI', url: 'http://localhost:8080' },
];

/** Installierte Modelle; Einbettungsmodelle (embed) können keine Texte bewerten und fallen weg. */
export async function modelleLaden(anbieter: LokalArt, url: string, signal?: AbortSignal): Promise<string[]> {
  const b = basis({ url });
  const res = await fetch(anbieter === 'ollama' ? `${b}/api/tags` : `${b}/v1/models`, { signal });
  if (!res.ok) throw new Error(`Fehler ${res.status}`);
  const j = (await res.json()) as { models?: { name: string }[]; data?: { id: string }[] };
  const namen = anbieter === 'ollama' ? (j.models ?? []).map((m) => m.name) : (j.data ?? []).map((m) => m.id);
  return namen.filter((n) => n && !/embed/i.test(n));
}

/** Sucht auf diesem Rechner nach laufenden lokalen KI-Programmen (je höchstens drei Sekunden). */
export async function lokaleKiSuchen(kandidaten = LOKAL_KANDIDATEN): Promise<LokalFund[]> {
  const funde = await Promise.all(
    kandidaten.map(async (k) => {
      const c = new AbortController();
      const timer = setTimeout(() => c.abort(), 3000);
      try {
        return { ...k, modelle: await modelleLaden(k.anbieter, k.url, c.signal) };
      } catch {
        return null;
      } finally {
        clearTimeout(timer);
      }
    }),
  );
  return funde.filter((f): f is LokalFund => !!f);
}

/** Vorschlag aus den gefundenen Modellen: bekannte Familien mit gutem Deutsch zuerst. */
export function modellVorschlag(modelle: string[]): string {
  const rang = (m: string) => {
    const i = [/qwen/i, /gemma/i, /mistral/i, /llama/i].findIndex((r) => r.test(m));
    return i < 0 ? 9 : i;
  };
  return [...modelle].sort((a, b) => rang(a) - rang(b))[0] ?? '';
}
