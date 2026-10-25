// Erklärungen zu jeder Teilübung, jederzeit abrufbar über „Erklärung“ oben rechts.
// Grundlage sind das Merkblatt und die Erwartungen der Lehrkraft.

import type { ZArt } from './typen';

export interface ZErklaerung {
  /** Worum es geht, in einem Satz. */
  kern: string;
  /** So gehst du vor. */
  schritte: string[];
  /** Beispiele: falsch → richtig, mit kurzer Begründung. */
  beispiele?: { falsch?: string; richtig: string; warum: string }[];
}

const EINLEITUNG_BAUPLAN = 'In dem [Textsorte] „[Titel]“ von [Autor], erschienen am [Datum] in [Medium], geht es um [Thema]. [Autor] vertritt die Auffassung, dass [Kernaussage].';

export const ERKLAERUNGEN: Record<ZArt, ZErklaerung> = {
  textsorte: {
    kern: 'Die Textsorte gehört in die Einleitung. Du erkennst sie daran, ob und wie der Autor Stellung bezieht.',
    schritte: [
      'Bericht: informiert sachlich, ohne eigene Meinung.',
      'Kommentar: bezieht klar Stellung zu einem aktuellen Thema, oft mit Forderung.',
      'Essay: denkt frei und abwägend über ein grundsätzliches Thema nach, oft mit Ich und Fragen.',
      'Sachbuchauszug: erklärt ein Thema ausführlich und belehrend, stammt aus einem Buch.',
    ],
  },
  einleitungPruefen: {
    kern: 'Eine vollständige Einleitung hat sieben Bausteine in höchstens zwei Sätzen.',
    schritte: [
      'Textsorte, Titel (in Anführungszeichen), Autor.',
      'Erscheinungsort (Zeitung, Verlag) und Erscheinungsdatum.',
      'Thema: worum es geht.',
      'Kernaussage: was der Autor dazu meint, also die These, nicht nur das Thema.',
      'Präsens, keine Wertung, keine Zeilenangaben.',
    ],
    beispiele: [{ richtig: EINLEITUNG_BAUPLAN, warum: 'Bauplan mit allen Angaben in zwei Sätzen.' }],
  },
  einleitungSchreiben: {
    kern: 'Höchstens zwei Sätze: alle Angaben aus der Quellenzeile, dazu Thema und Kernaussage.',
    schritte: [
      'Aus der Quellenzeile abschreiben: Autor, Titel, Medium, Datum.',
      'Textsorte bestimmen: Kommentar, Bericht, Essay oder Sachbuchauszug.',
      'Thema in wenigen Wörtern: Worum geht es?',
      'Kernaussage: Was meint der Autor dazu? Das steht im Abschnitt mit der These.',
      'Präsens, sachlich, keine eigene Wertung.',
    ],
    beispiele: [
      { richtig: EINLEITUNG_BAUPLAN, warum: 'Bauplan, den du füllen kannst.' },
      { falsch: 'Im Text geht es um Handys.', richtig: 'In dem Kommentar „…“ von …, erschienen am … in …, geht es um Handyverbote an Schulen. Die Autorin fordert, …', warum: 'Es fehlen Angaben und die Kernaussage.' },
    ],
  },
  struktur: {
    kern: 'Ein Sinnabschnitt endet dort, wo der Autor etwas Neues tut: Er wechselt etwa vom Problem zur Ursache oder vom Beispiel zur Forderung.',
    schritte: [
      'Lies Absatz für Absatz und frag: Was tut der Autor hier (darstellen, begründen, fordern …)?',
      'Absätze mit derselben Funktion gehören zu einem Abschnitt.',
      'Gib jedem Abschnitt seine Funktion. Daraus wird im Hauptteil je ein Satz mit Funktionsverb.',
    ],
  },
  these: {
    kern: 'Die These ist der Satz, in dem der Autor selbst Stellung bezieht. Sie gehört in jede Zusammenfassung.',
    schritte: [
      'Achte auf Signale wie „muss“, „sollte“, „falsch“, „richtig ist“, „ich halte“.',
      'Die These ist eine Meinung, keine Information und kein Beispiel.',
      'Sie steht oft am Ende der Einleitung oder am Schluss, manchmal mitten im Text.',
    ],
  },
  kernBeispiel: {
    kern: 'In die Zusammenfassung gehört der Kern, nicht das Beispiel.',
    schritte: [
      'Frag beim Beispiel: Was soll es belegen? Das ist der Kern.',
      'Namen, Zahlen und Einzelfälle sind fast immer Beispiele.',
      'Ein guter Satz würde auch ohne das Beispiel stimmen.',
    ],
    beispiele: [{ falsch: 'Der Autor erzählt von seiner Nichte, die nachts chattet.', richtig: 'Der Autor führt an, dass Jugendliche wegen ihres Handys zu wenig schliefen.', warum: 'Die Nichte ist nur ein Beispiel; der Kern ist der Schlafmangel.' }],
  },
  funktionsverb: {
    kern: 'Das Funktionsverb sagt, was der Autor im Abschnitt tut. Es muss genauso stark sein wie der Text.',
    schritte: [
      'Stellt er nur dar oder fordert er? Kritisiert er oder räumt er ein?',
      'Nicht abschwächen: Ein „muss“ ist eine Forderung, kein Vorschlag.',
      'Nicht verstärken: Wer etwas erwägt, fordert es noch nicht.',
    ],
    beispiele: [{ falsch: 'Die Autorin empfiehlt, das Verbot abzuschaffen.', richtig: 'Die Autorin fordert, das Verbot abzuschaffen.', warum: 'Im Text steht „muss“: Das ist eine Forderung.' }],
  },
  fingertest: {
    kern: 'Fingertest: Zu jedem Wort deiner Zusammenfassung musst du die Stelle im Text zeigen können.',
    schritte: [
      'Lies den Satz Wort für Wort und such die Stelle im Text.',
      'Findest du ein Wort nicht, ist es dazugedichtet: streichen.',
      'Besonders verdächtig: „immer“, „alle“, „nur“, „sehr“, eigene Gründe und Wertungen.',
    ],
  },
  synonym: {
    kern: 'Eigene Wörter sind gut, aber sie müssen genau dasselbe sagen.',
    schritte: [
      'Vergleiche Stärke und Umfang: „einige“ ist nicht „viele“, „kritisieren“ ist nicht „ablehnen“.',
      'Achte auf Wertungen, die das Ersatzwort mitbringt.',
      'Im Zweifel das neutrale Wort wählen.',
    ],
  },
  konjunktiv: {
    kern: 'Was der Autor behauptet, steht im Konjunktiv. Was der Autor tut, steht im Indikativ.',
    schritte: [
      'Rahmen im Indikativ: „Der Autor behauptet, …“, „Die Autorin fordert, …“.',
      'Singular: Konjunktiv I (er sei, sie habe, es müsse, er gehe).',
      'Plural: würden + Infinitiv (sie würden fehlen), weil der Konjunktiv I dem Indikativ gleicht.',
      'Ausnahme im Plural: seien und hätten.',
      'Nach „dass“ ist der Indikativ erlaubt.',
    ],
    beispiele: [
      { falsch: 'Der Autor meint, die Schule ist zu streng.', richtig: 'Der Autor meint, die Schule sei zu streng.', warum: 'Singular: Konjunktiv I.' },
      { falsch: 'Sie behauptet, Schüler lernen zu wenig.', richtig: 'Sie behauptet, Schüler würden zu wenig lernen.', warum: 'Plural: „lernen“ gleicht dem Indikativ, also würden + Infinitiv.' },
      { falsch: 'Er behauptet, viele würden überfordert sein.', richtig: 'Er behauptet, viele seien überfordert.', warum: 'Plural von sein: seien.' },
      { falsch: 'Der Autor fordere, …', richtig: 'Der Autor fordert, …', warum: 'Handlung des Autors: Indikativ.' },
    ],
  },
  verdichten: {
    kern: 'Fass den Abschnitt in einem eigenen Satz zusammen: Was tut der Autor hier, und was ist der Kern?',
    schritte: [
      'Frag: Was tut der Autor in diesem Abschnitt? Daraus wird das Funktionsverb (stellt dar, kritisiert, fordert …).',
      'Frag: Was ist der Kern? Beispiele, Zahlen und Namen lässt du weg.',
      'Bau den Satz: Rahmen im Indikativ, Behauptung im Konjunktiv. „Der Autor kritisiert, die Schule sei …“',
      'Fingertest: Steht jedes Wort so im Text? Nichts abschwächen, nichts dazudichten.',
      'Knapp: meist ein Satz, ohne Zeilenangabe.',
    ],
    beispiele: [{ falsch: 'Der Autor sagt, dass seine Nichte nachts chattet und morgens müde ist.', richtig: 'Der Autor veranschaulicht, dass Jugendliche wegen ihres Handys zu wenig schliefen.', warum: 'Funktionsverb statt „sagt“, Kern statt Beispiel.' }],
  },
  schlussWaehlen: {
    kern: 'Der Schluss gibt die Gesamtaussage des ganzen Textes wieder, ohne neue Inhalte und ohne Wertung.',
    schritte: [
      'Ein Teilaspekt reicht nicht: Der Satz muss für den ganzen Text gelten.',
      'Keine eigene Meinung („überzeugend“, „ich finde“).',
      'Nichts dazudichten, was der Text nicht sagt.',
    ],
  },
  schlussSchreiben: {
    kern: 'Ein bis zwei Sätze: die Gesamtaussage des Textes, ohne neue Inhalte, ohne Wertung.',
    schritte: [
      'Frag: Was will der Autor insgesamt erreichen oder zeigen?',
      'Meist hängt das mit der These zusammen, ist aber kein Abschnitt allein.',
      'Einstieg zum Beispiel: „Insgesamt macht der Autor deutlich, dass …“',
      'Keine eigene Stellungnahme; die gehört nicht in die Textwiedergabe.',
    ],
  },
};
