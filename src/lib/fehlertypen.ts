// Die feste Liste der Fehlertypen. Jeder Typ gehört zu genau einer Lektion.

export type Bereich = 'komma' | 'fall' | 'konjunktiv' | 'rechtschreibung' | 'zeichen' | 'wortsatz';

export interface Fehlertyp {
  id: string;
  bereich: Bereich;
  label: string;
  lektion: string;
  /** Durchgang beim Korrekturlesen (Kurs 10): 1 Komma, 2 Formen, 3 Wörter. */
  durchgang: 1 | 2 | 3;
  hinweis: string;
}

export const BEREICHE: { id: Bereich; label: string }[] = [
  { id: 'komma', label: 'Komma' },
  { id: 'fall', label: 'Fall' },
  { id: 'konjunktiv', label: 'Konjunktiv' },
  { id: 'rechtschreibung', label: 'Rechtschreibung' },
  { id: 'zeichen', label: 'Zeichen' },
  { id: 'wortsatz', label: 'Wort und Satz' },
];

export const FEHLERTYPEN: Fehlertyp[] = [
  { id: 'k-nebensatz', bereich: 'komma', label: 'Nebensatz', lektion: '1.2', durchgang: 1, hinweis: 'Komma am Nebensatz fehlt oder steht falsch.' },
  { id: 'k-reihe', bereich: 'komma', label: 'Hauptsatzreihe', lektion: '1.3', durchgang: 1, hinweis: 'Komma zwischen Hauptsätzen oder vor aber, sondern, doch, jedoch.' },
  { id: 'k-aufzaehlung', bereich: 'komma', label: 'Aufzählung', lektion: '1.4', durchgang: 1, hinweis: 'Komma zwischen gleichrangigen Gliedern und Adjektiven.' },
  { id: 'k-infinitiv', bereich: 'komma', label: 'Infinitivgruppe', lektion: '1.5', durchgang: 1, hinweis: 'Komma bei der Infinitivgruppe mit zu.' },
  { id: 'k-einschub', bereich: 'komma', label: 'Einschub nicht paarig', lektion: '1.6', durchgang: 1, hinweis: 'Einschub, Beisatz, Nachtrag oder Anrede nicht vollständig abgetrennt.' },
  { id: 'k-ueberfluessig', bereich: 'komma', label: 'überflüssiges Komma', lektion: '1.8', durchgang: 1, hinweis: 'Komma, wo kein eigenes gebeugtes Verb und keine Fügung es verlangt.' },

  { id: 'f-praeposition', bereich: 'fall', label: 'nach Präposition', lektion: '2.2', durchgang: 2, hinweis: 'Falscher Fall nach einer Präposition.' },
  { id: 'f-ndeklination', bereich: 'fall', label: 'n-Deklination', lektion: '2.6', durchgang: 2, hinweis: 'Endung -(e)n fehlt oder ist zu viel.' },
  { id: 'f-beisatz', bereich: 'fall', label: 'Beisatz', lektion: '2.7', durchgang: 2, hinweis: 'Beisatz, Glied mit als oder wie oder Ergänzung eines Verbs im falschen Fall.' },
  { id: 'f-genitiv', bereich: 'fall', label: 'Genitiv und Ausweichform', lektion: '2.5', durchgang: 2, hinweis: 'Genitiv nicht gebildet oder ohne Grund ausgewichen.' },
  { id: 'f-adjektiv', bereich: 'fall', label: 'Adjektivendung', lektion: '2.8', durchgang: 2, hinweis: 'Falsche Endung am Adjektiv.' },

  { id: 'kj-indikativ', bereich: 'konjunktiv', label: 'Indikativ statt Konjunktiv', lektion: '3.1', durchgang: 2, hinweis: 'Wiedergegebene Aussage steht im Indikativ.' },
  { id: 'kj-form', bereich: 'konjunktiv', label: 'falsche Form', lektion: '3.2', durchgang: 2, hinweis: 'Konjunktivform falsch gebildet oder falsch gewählt.' },
  { id: 'kj-ausweich', bereich: 'konjunktiv', label: 'Ausweichform fehlt', lektion: '3.3', durchgang: 2, hinweis: 'Konjunktiv I gleicht dem Indikativ, die Ausweichkette wurde nicht angewendet.' },
  { id: 'kj-zeit', bereich: 'konjunktiv', label: 'Zeitstufe', lektion: '3.4', durchgang: 2, hinweis: 'Falsche Zeitstufe in der indirekten Rede.' },
  { id: 'kj-pronomen', bereich: 'konjunktiv', label: 'Pronomen oder Zeitangabe', lektion: '3.5', durchgang: 2, hinweis: 'Pronomen, Zeit- oder Ortsangabe nicht verschoben.' },

  { id: 'r-dasdass', bereich: 'rechtschreibung', label: 'das oder dass', lektion: '4.1', durchgang: 3, hinweis: 'das und dass verwechselt.' },
  { id: 'r-gross', bereich: 'rechtschreibung', label: 'groß oder klein', lektion: '5.1', durchgang: 3, hinweis: 'Groß- und Kleinschreibung.' },
  { id: 'r-getrennt', bereich: 'rechtschreibung', label: 'getrennt oder zusammen', lektion: '6.1', durchgang: 3, hinweis: 'Getrennt- und Zusammenschreibung.' },
  { id: 'r-s', bereich: 'rechtschreibung', label: 's, ss, ß', lektion: '7.1', durchgang: 3, hinweis: 's, ss oder ß verwechselt.' },
  { id: 'r-dehnung', bereich: 'rechtschreibung', label: 'Dehnung und Schärfung', lektion: '7.3', durchgang: 3, hinweis: 'Doppelkonsonant, ck, tz, ie oder Dehnungs-h.' },
  { id: 'r-stamm', bereich: 'rechtschreibung', label: 'Stammwort und Verlängerung', lektion: '7.4', durchgang: 3, hinweis: 'ä/e, äu/eu, d/t, b/p, g/k, end-/ent-, tod-/tot-.' },
  { id: 'r-fremdwort', bereich: 'rechtschreibung', label: 'Fach- und Fremdwort', lektion: '7.5', durchgang: 3, hinweis: 'Fachwort oder Fremdwort falsch geschrieben.' },

  { id: 'z-rede', bereich: 'zeichen', label: 'wörtliche Rede', lektion: '8.1', durchgang: 1, hinweis: 'Zeichen bei wörtlicher Rede.' },
  { id: 'z-zitat', bereich: 'zeichen', label: 'Zitat', lektion: '8.2', durchgang: 1, hinweis: 'Zitat falsch eingebaut oder belegt.' },
  { id: 'z-apostroph', bereich: 'zeichen', label: 'Apostroph', lektion: '8.4', durchgang: 3, hinweis: 'Apostroph fehlt oder steht ohne Grund.' },
  { id: 'z-bindestrich', bereich: 'zeichen', label: 'Bindestrich', lektion: '8.5', durchgang: 3, hinweis: 'Bindestrich, Ergänzungsstrich oder Abkürzung.' },
  { id: 'z-doppelpunkt', bereich: 'zeichen', label: 'Doppelpunkt und Semikolon', lektion: '8.3', durchgang: 1, hinweis: 'Doppelpunkt oder Semikolon falsch gesetzt oder falsch fortgesetzt.' },

  { id: 'w-verwechslung', bereich: 'wortsatz', label: 'Verwechslungspaar', lektion: '9.1', durchgang: 3, hinweis: 'Gleich klingende oder ähnliche Wörter verwechselt.' },
  { id: 'w-kongruenz', bereich: 'wortsatz', label: 'Kongruenz', lektion: '9.3', durchgang: 2, hinweis: 'Verb passt nicht zum Kern des Subjekts.' },
  { id: 'w-relativ', bereich: 'wortsatz', label: 'Relativpronomen', lektion: '9.3', durchgang: 2, hinweis: 'das, was, dessen oder deren falsch gewählt.' },
  { id: 'w-tempus', bereich: 'wortsatz', label: 'Tempus', lektion: '9.4', durchgang: 2, hinweis: 'Falsche Zeitform oder Zeitenfolge.' },
  { id: 'w-satzbau', bereich: 'wortsatz', label: 'Satzbau', lektion: '9.4', durchgang: 2, hinweis: 'Wortstellung oder Form im Satz falsch.' },
];

const BY_ID = new Map(FEHLERTYPEN.map((t) => [t.id, t]));

export function fehlertyp(id: string): Fehlertyp | undefined {
  return BY_ID.get(id);
}

export function fehlertypLabel(id: string): string {
  return BY_ID.get(id)?.label ?? id;
}

export function bereichLabel(b: Bereich): string {
  return BEREICHE.find((x) => x.id === b)?.label ?? b;
}

export const DURCHGAENGE: { nr: 1 | 2 | 3; titel: string; punkte: string[] }[] = [
  {
    nr: 1,
    titel: 'Kommadurchgang',
    punkte: [
      'Gebeugte Verben unterstreichen, Teilsatzgrenzen prüfen',
      'Jedes dass und jedes Einleitewort: Komma davor?',
      'Jede Infinitivgruppe mit zu abgetrennt?',
      'Jeder Einschub paarig abgetrennt?',
      'Wörtliche Rede, Zitate, Doppelpunkt und Semikolon',
    ],
  },
  {
    nr: 2,
    titel: 'Formendurchgang',
    punkte: [
      'Fall nach jeder Präposition: maskulines Nomen einsetzen',
      'n-Deklination: den Protagonisten, dem Autor',
      'Konjunktiv in jeder wiedergegebenen Aussage, Ausweichkette',
      'Tempus: Präsens als Grundzeit, Vorzeitiges im Perfekt',
    ],
  },
  {
    nr: 3,
    titel: 'Wortdurchgang',
    punkte: [
      'Jedes das und dass: Ersatzprobe mit dieses, jenes, welches',
      'Groß oder klein: Begleiterprobe',
      's, ss oder ß: Vokallänge hören',
      'Getrennt oder zusammen: Betonungsprobe',
      'wider und wieder, seit und seid: Bedeutung prüfen',
    ],
  },
];
