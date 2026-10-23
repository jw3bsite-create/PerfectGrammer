# Sprachrichtigkeit

Lern-App für Rechtschreibung, Zeichensetzung und Grammatik auf Abiturniveau (Baden-Württemberg, Abitur 2027). Für jeden Fehlertyp gibt es genau eine Probe; die App lehrt nur diese Probe und übt sie, bis sie sitzt.

- **Zehn Kurse, 53 Lektionen, 1128 geprüfte Aufgaben**, darunter 12 Korrekturtexte und 12 Sachtextabsätze zur Textwiedergabe
- **Tägliche Wiederholung** in wachsenden Abständen (1, 3, 7, 16, 35 Tage), gemischt aus allen Kursen
- **Fehlerbuch** mit Fehlern aus der App und aus korrigierten Klausuren, Fehlerprofil, Verlauf, Export als CSV und PDF
- **Zusammenfassen**: strukturierte Textwiedergabe von Sachtexten an über 60 kurzen Übungstexten (Literaturepochen, Philosophie, Geschichte, Sprache, Politik, Technik, Schule). Teilübungen zu Einleitung, Hauptteil und Schluss im Wechsel, ganze Zusammenfassungen mit Schreibplan, Timer, Checkliste, Musterlösung und einer Überarbeitung; eigene Texte aus dem Unterricht; optional Rückmeldung einer lokalen KI
- **Meine Schwächen**: eigener Bereich in einem eigenen Fenster für die persönlichen Fehler – zwölf Kategorien mit je einer Methode und 25 bis 37 Aufgaben, dazu Transfer-Absätze. Jede Antwort wird mit einer Regel begründet; gemeistert ist eine Kategorie nach drei bestandenen Prüfungen (90 Prozent) nach 1, 3 und 7 Tagen
- **Vollständig auf dem Gerät:** kein Konto, kein Server, kein Tracking, offline nutzbar, als App installierbar

## Starten

```bash
npm install
npm run dev        # Entwicklung unter http://localhost:5173
npm run build      # fertige App in dist/
npm run preview    # gebaute App lokal ansehen
```

`dist/` ist eine statische Website mit relativen Pfaden. Sie läuft auf jedem Webserver mit HTTPS, auch in einem Unterordner (etwa GitHub Pages). Installation auf dem iPad: Seite in Safari öffnen, „Teilen“ → „Zum Home-Bildschirm“. Danach startet die App ohne Netz.

## Unter Windows mit automatischen Updates

1. [Node.js](https://nodejs.org) (Version „LTS“) installieren.
2. Den Branch als ZIP herunterladen, entpacken und im Ordner mit `package.json` die Datei **`Windows einrichten.bat`** doppelklicken.
3. Auf dem Desktop liegt danach die Verknüpfung **„Sprachrichtigkeit“**. Sie prüft bei jedem Start, ob es auf GitHub eine neue Version gibt, lädt sie bei Bedarf und öffnet die App unter `http://localhost:5173`.

Verknüpfung neu anlegen (ohne ZIP): PowerShell öffnen und diese Zeile einfügen. Sie erzwingt beim nächsten Start auch die neueste Version.

```powershell
irm https://raw.githubusercontent.com/jw3bsite-create/PerfectGrammer/claude/sprachrichtigkeit-app-xzd9cl/windows/einrichten-online.ps1 | iex
```

Läuft die App beim Klick schon und gibt es eine neue Version, beendet die Verknüpfung die laufende App, aktualisiert sie und startet sie neu. Die App liegt danach in `%USERPROFILE%\Sprachrichtigkeit`; der entpackte Download-Ordner kann gelöscht werden. Die Lerndaten liegen im Browser und bleiben bei Updates erhalten. Ohne Internet startet die zuletzt geladene Version.

## Prüfen

```bash
npm test               # Unit-Tests: Auswertung, Lernlogik, Speicher, gesamte Aufgabenbank
npm run check:content  # nur die Aufgabenbank
npm run e2e            # Browser-Prüfung mit Chromium (baut vorher die App)
```

`npm run e2e` braucht ein Chromium. Standard ist `/opt/pw-browsers/chromium`; ein anderer Pfad wird über `CHROMIUM_PATH` gesetzt. Die Prüfung löst Aufgaben aller zehn Typen nur mit der Tastatur, erfasst Klausurfehler, spielt eine Sicherung ein, schreibt den Einstufungstest, startet die App ohne Netz, trainiert in „Meine Schwächen“ mit Regelwahl, Kontrollaufgabe und Checkliste und prüft Handy, Tablet und Desktop in hellem und dunklem Design. Die Bildschirmfotos liegen danach in `e2e/screenshots/`.

## Bedienung mit der Tastatur

| Taste | Wirkung |
| --- | --- |
| Enter | prüft die Antwort, danach weiter zur nächsten Aufgabe |
| ← → | wählt Wort oder Lücke (Probe, Komma setzen, Fehler finden, Korrekturlesen) |
| Leertaste | markiert das Verb, setzt oder löscht das Komma, öffnet die Korrektur einer Stelle |
| Alt + → | nimmt beim Korrigieren das nächste Wort dazu (zum Zusammenschreiben) |
| 1, 2, 3 … | wählt eine Option (Entscheiden, Fehlertyp bestimmen) |
| R | öffnet die Regelkarte der Lektion |
| Strg + . | spielt das Wort in „Wort tippen“ noch einmal vor |
| Esc | schließt Regelkarte, Dialog oder Korrekturfeld |

Alles ist ebenso per Antippen bedienbar. In „Meine Schwächen“ wählen die Ziffern nach jeder Antwort die Regel, die sie begründet.

## Zusammenfassen

Der Bereich `#/zusammenfassen` trainiert die strukturierte Textwiedergabe nach den Erwartungen der Lehrkraft: Einleitung mit Verfasser, Titel, Textsorte, Erscheinungsort und -datum, Thema und Kernaussage in höchstens zwei Sätzen; im Hauptteil etwa ein Satz pro Sinnabschnitt mit Funktionsverb, Präsens und Konjunktiv für Behauptungen (Singular Konjunktiv I, Plural würden + Infinitiv außer seien/hätten, nach „dass“ auch Indikativ); Schluss mit der Gesamtaussage; insgesamt etwa zehn Sätze, ohne Zeilenangaben.

- **Teilübungen** (je ein bis drei Minuten, jede zu einem anderen Text): Textsorte bestimmen, Einleitung prüfen, Einleitung schreiben, Struktur erkennen (Sinnabschnitte und ihre Funktion), These finden, Kern oder Beispiel, Funktionsverb, Fingertest (dazugedichtetes Wort markieren), Bedeutungsgleich, Konjunktiv im Rahmen (mit Begründung), Verdichten (höchstens 30 Wörter), Gesamtaussage wählen, Schluss schreiben. Übungsarten zu den häufigsten Fehlerkategorien kommen öfter.
- **Ganzer Text:** Schreibplan (Funktion, Funktionsverb, höchstens fünf Schlüsselwörter je Abschnitt, These am Rand), Text mit Timer und Wortzähler, Selbstprüfung mit zwölf Ja/Nein-Fragen und automatischen Hinweisen (Umgangssprache, Zeilenangaben, mögliche Präteritumformen, Abschwächung, Abdrift-Fallen, Länge), Musterlösung Abschnitt für Abschnitt neben der eigenen Fassung, eine Überarbeitung, dann der nächste Text.
- **Fehlerkategorien:** Einleitung unvollständig, Struktur nicht erkennbar, These fehlt, Dazugedichtet, Beispiel statt Kern, Rahmen fehlt, Konjunktiv Singular/Plural, Modusmischung, Präteritum, Abschwächung, Umgangssprache, zu lang. Jedes „Nein“ der Checkliste und jeder Fehler in einer Teilübung zählt; die Übersicht zeigt eine Ampel je Kategorie und den Verlauf.
- **Stufen:** zuerst kurze, klar gegliederte Texte; nach vier ganzen Zusammenfassungen (oder sicheren Teilübungen) mittellange, nach zehn längere mit versteckter These. Die Stufe lässt sich auch selbst wählen.
- **Eigene Texte:** Texte aus dem Unterricht einfügen, auf Wunsch mit der Musterlösung der Lehrkraft.
- **KI (optional):** Rückmeldung eines lokalen Modells über [Ollama](https://ollama.com) (`ollama pull qwen2.5:7b`, Adresse `http://localhost:11434`). Die KI nennt Stelle, Kategorie und Fehlerart, aber keine Lösung; ohne KI bleibt es bei Checkliste und Musterlösung. Es werden keine Daten ins Internet geschickt.

Inhalte: `src/content/zusammenfassen.json`. Jeder Text hat Absätze (als Einzelsätze), Sinnabschnitte mit Funktion, Funktionsverb, Falschverben samt Begründung und Musterlösung, den These-Satz, Einleitung und Schluss, Schlüsselbegriffe, Abdrift-Fallen sowie die Daten für Fingertest, Kern/Beispiel, Bedeutungsgleich, Konjunktiv und Schluss-Auswahl. Alle Texte sind selbst geschrieben, mit erfundenen Verfassern und Medien; die Sachinformationen sind echt. `tests/zusammenfassen.test.ts` prüft jeden Text: Längen je Stufe, lückenlose Abschnitte, These im These-Abschnitt, Musterlösung ohne Präteritum, Umgangssprache und Fallen, Einleitung besteht die automatische Prüfung.

## Meine Schwächen

Der Bereich öffnet aus der Seitenleiste (oder unter „Heute → Schnellstart“) in einem eigenen Fenster, `#/schwaechen`. Kurse und Üben bleiben im Hauptfenster; Verweise wie „3.4 Zeitstufen“ öffnen die Lektion dort. Beide Fenster teilen den Speicher und gleichen sich beim Wechsel ab.

- **Übersicht:** Ampel je Kategorie (Rot: übt noch, Gelb: in Prüfung, Grün: gemeistert), nächste fällige Prüfung, Wiederholungstäter (Regeln mit mindestens zwei Fehlern), Anteil richtiger Antworten je Woche.
- **Training:** zehn Aufgaben einer Kategorie in allen Übungsformen (Entscheiden, Lückentext, Umformen, Fehlerjagd mit genau einem Fehler, Komma setzen, Selbst schreiben). Nach jeder Antwort wird die Regel gewählt; richtig ist eine Aufgabe nur mit richtiger Antwort und richtiger Begründung. Die Rückmeldung erklärt immer mit der Methode der Kategorie. Nach einem Fehler folgt sofort eine ähnliche Kontrollaufgabe.
- **Stufen:** Ein Training mit mindestens 90 Prozent führt auf Stufe 1. Prüfungen folgen nach 1, 3 und 7 Tagen; jede bestandene hebt eine Stufe, eine nicht bestandene senkt eine. Nach der dritten ist die Kategorie gemeistert. Ein Fehler in einer gemeisterten Kategorie stuft sie eine Stufe zurück.
- **Gemischt und Transfer:** fünfzehn Aufgaben aus allen Kategorien, gewichtet nach den Fehlern der letzten 14 Tage, dazu Absätze mit zwei bis drei Fehlern aus verschiedenen Kategorien. Dort werden die Kategorien der Fehler gewählt.
- **Fehler erfassen:** falsch, richtig, Kategorie und Regel eintragen; daraus entstehen eine Fehlerjagd und, wo möglich, eine Entscheiden-Aufgabe.
- **Vor der Abgabe:** Checkliste mit den drei häufigsten Fehlerkategorien und je einer Prüffrage, nach jedem Text abzuhaken.

Inhalte: `src/content/schwaechen.json` (Kategorien mit Methode, Regeln, Fehlregeln als Ablenker, Kursverweisen, Prüffrage, Beispielen; Aufgaben mit `kat` und `regel`). Selbst geschriebene Sätze prüft `src/schwaechen/pruefen.ts` mit Mustern (`pruefungen`: `muss` und `nicht`), jedes mit Beispiel und Gegenbeispiel in den Tests.

## Aufbau

```
src/
  content/        Aufgabenbank: kurs-01.json … kurs-10.json, varianten.json, schwaechen.json, zusammenfassen.json
  lib/            Logik ohne Oberfläche
    evaluate.ts   Auswertung aller Übungstypen
    markup.ts     Notationen der Aufgabentexte
    mastery.ts    Beherrschungsgrade, Rückstufung, Test- und Kursabschluss
    srs.ts        Wiederholung in wachsenden Abständen
    errorbook.ts  Status, Fehlerprofil und Typvorschlag im Fehlerbuch
    sessions.ts   Zusammenstellung aller Sitzungen (Lektion, Wiederholung 60/30/10, Einstufung …)
    store.ts      Zustand, Speichern, Sicherung
    db.ts         IndexedDB, Datenversion und Migration
  schwaechen/     Bereich „Meine Schwächen“: Daten, Stufenlogik, Aktionen, Oberfläche
  zusammenfassen/ Bereich „Zusammenfassen“: Textbank, Prüfhinweise, Lernlogik, KI-Anbindung, Oberfläche
  exercises/      eine Komponente je Übungstyp
  views/          Seiten: Heute, Kurse, Üben, Fehlerbuch, Statistik, Einstellungen
  styles/app.css  Gestaltung: Farben, Schriften, helles und dunkles Design
tests/            Unit-Tests
e2e/              Browser-Prüfung
docs/             Plan, Annahmen, Zweifelsfälle
```

## Die Aufgabenbank erweitern

Jeder Kurs ist eine Datei `src/content/kurs-NN.json`. Neue Aufgaben werden dort angehängt; die App erkennt sie ohne Codeänderung. Danach `npm run check:content` ausführen: Die Prüfung meldet jede Aufgabe, deren Lösung nicht als richtig erkannt wird, deren Original nicht als falsch gilt oder deren Typografie nicht stimmt.

Jede Aufgabe trägt diese Felder:

| Feld | Inhalt |
| --- | --- |
| `id` | Kennung, eindeutig, etwa `4.1-33` |
| `kurs`, `lektion` | Zuordnung, etwa `4` und `"4.1"` |
| `typ` | `probe`, `komma`, `eintippen`, `entscheiden`, `umformen`, `fehler`, `wort`, `textwiedergabe`, `korrektur` |
| `fehlertyp` | eine Kennung aus `src/lib/fehlertypen.ts`, etwa `r-dasdass` |
| `stufe` | Schwierigkeit 1 bis 3 |
| `begruendung` | höchstens zwei Sätze, nennt die Probe am konkreten Satz |

Dazu kommen je Typ:

| Typ | Felder | Notation |
| --- | --- | --- |
| `probe`, `komma` | `text` | `{Verb}` markiert ein gebeugtes Verb, `,` am Wortende ein Pflichtkomma, `(,)` ein freigestelltes Komma |
| `eintippen` | `text`, `hinweis`, `loesungen` | `___` markiert die Lücke; `loesungen` enthält alle gültigen Formen |
| `entscheiden` | `text`, `optionen`, `loesungen` | `___` markiert die Lücke |
| `umformen` | `vorlage`, `loesungen`, `kern` | `loesungen` mit und ohne dass; `kern` sind die Verbformen für die Rückmeldung |
| `fehler` | `text` | `[[falsch=>richtig\|fehlertyp\|Begründung]]`; `[[x=>x,\|frei]]` erlaubt beide Fassungen; ein Satz ohne Markierung ist fehlerfrei |
| `wort` | `wort`, `umschreibung`, `varianten` | die Umschreibung darf das Wort nicht enthalten |
| `textwiedergabe` | `quelle`, `vorlage`, `muster`, `pruefungen` | jede Prüfung nennt erwartete und zu vermeidende Formen; `…` steht für beliebige Wörter |
| `korrektur` | `titel`, `aufgabe`, `text` | wie `fehler`, 150 bis 250 Wörter, mindestens sechs Stellen, jede mit Fehlertyp |

Gleichwertige Schreibungen nach dem Regelwerk (etwa *aufgrund* und *auf Grund*) stehen in `src/content/varianten.json` und werden überall als richtig gewertet.

Ein Sprachmodell ist in einer reinen Offline-App nicht verfügbar; deshalb gibt es keinen Knopf „Neue Aufgaben“. Eigene Aufgaben entstehen aus dem Fehlerbuch und der eigenen Wortliste in Lektion 7.5. Sie sind als ungeprüft markiert und löschbar.

## Daten und Sicherung

Alle Daten liegen in der IndexedDB des Browsers (Datenbank `sprachrichtigkeit`). Unter „Einstellungen → Sicherung“ wird der vollständige Stand als JSON-Datei gespeichert und wieder eingespielt:

```json
{ "app": "sprachrichtigkeit", "datenversion": 3, "exportiert": "…", "daten": { "settings": {}, "attempts": [], "reviews": {}, "errors": [], "lessons": {}, "courses": {}, "customTasks": [], "schwaechen": {}, "zusammenfassen": {} } }
```

Das Datenmodell ist versioniert (`DATA_VERSION` in `src/lib/db.ts`). Ändert sich das Modell, wird die Version erhöht und in `MIGRATIONS` ein Schritt von der alten zur neuen Fassung ergänzt. Er läuft beim Öffnen der App und beim Einspielen älterer Sicherungen. Version 2 ergänzt den Stand von „Meine Schwächen“ (`meta.schwaechen`), Version 3 den von „Zusammenfassen“ (`meta.zusammenfassen`); ältere Sicherungen erhalten jeweils einen leeren Stand.

## Annahmen und Zweifelsfälle

- Annahmen zur Umsetzung: [docs/PLAN.md](docs/PLAN.md)
- Inhaltliche Zweifelsfälle und wie die App sie wertet: [docs/ZWEIFELSFAELLE.md](docs/ZWEIFELSFAELLE.md)
