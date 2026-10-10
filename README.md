# Sprachrichtigkeit

Lern-App für Rechtschreibung, Zeichensetzung und Grammatik auf Abiturniveau (Baden-Württemberg, Abitur 2027). Für jeden Fehlertyp gibt es genau eine Probe; die App lehrt nur diese Probe und übt sie, bis sie sitzt.

- **Zehn Kurse, 50 Lektionen, 1058 geprüfte Aufgaben**, darunter 12 Korrekturtexte und 12 Sachtextabsätze zur Textwiedergabe
- **Tägliche Wiederholung** in wachsenden Abständen (1, 3, 7, 16, 35 Tage), gemischt aus allen Kursen
- **Fehlerbuch** mit Fehlern aus der App und aus korrigierten Klausuren, Fehlerprofil, Verlauf, Export als CSV und PDF
- **Vollständig auf dem Gerät:** kein Konto, kein Server, kein Tracking, offline nutzbar, als App installierbar

## Starten

```bash
npm install
npm run dev        # Entwicklung unter http://localhost:5173
npm run build      # fertige App in dist/
npm run preview    # gebaute App lokal ansehen
```

`dist/` ist eine statische Website mit relativen Pfaden. Sie läuft auf jedem Webserver mit HTTPS, auch in einem Unterordner (etwa GitHub Pages). Installation auf dem iPad: Seite in Safari öffnen, „Teilen“ → „Zum Home-Bildschirm“. Danach startet die App ohne Netz.

## Prüfen

```bash
npm test               # Unit-Tests: Auswertung, Lernlogik, Speicher, gesamte Aufgabenbank
npm run check:content  # nur die Aufgabenbank
npm run e2e            # Browser-Prüfung mit Chromium (baut vorher die App)
```

`npm run e2e` braucht ein Chromium. Standard ist `/opt/pw-browsers/chromium`; ein anderer Pfad wird über `CHROMIUM_PATH` gesetzt. Die Prüfung löst Aufgaben aller zehn Typen nur mit der Tastatur, erfasst Klausurfehler, spielt eine Sicherung ein, schreibt den Einstufungstest, startet die App ohne Netz und prüft Handy, Tablet und Desktop in hellem und dunklem Design. Die Bildschirmfotos liegen danach in `e2e/screenshots/`.

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

Alles ist ebenso per Antippen bedienbar.

## Aufbau

```
src/
  content/        Aufgabenbank: kurs-01.json … kurs-10.json, varianten.json
  lib/            Logik ohne Oberfläche
    evaluate.ts   Auswertung aller Übungstypen
    markup.ts     Notationen der Aufgabentexte
    mastery.ts    Beherrschungsgrade, Rückstufung, Test- und Kursabschluss
    srs.ts        Wiederholung in wachsenden Abständen
    errorbook.ts  Status, Fehlerprofil und Typvorschlag im Fehlerbuch
    sessions.ts   Zusammenstellung aller Sitzungen (Lektion, Wiederholung 60/30/10, Einstufung …)
    store.ts      Zustand, Speichern, Sicherung
    db.ts         IndexedDB, Datenversion und Migration
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
{ "app": "sprachrichtigkeit", "datenversion": 1, "exportiert": "…", "daten": { "settings": {}, "attempts": [], "reviews": {}, "errors": [], "lessons": {}, "courses": {}, "customTasks": [] } }
```

Das Datenmodell ist versioniert (`DATA_VERSION` in `src/lib/db.ts`). Ändert sich das Modell, wird die Version erhöht und in `MIGRATIONS` ein Schritt von der alten zur neuen Fassung ergänzt. Er läuft beim Öffnen der App und beim Einspielen älterer Sicherungen.

## Annahmen und Zweifelsfälle

- Annahmen zur Umsetzung: [docs/PLAN.md](docs/PLAN.md)
- Inhaltliche Zweifelsfälle und wie die App sie wertet: [docs/ZWEIFELSFAELLE.md](docs/ZWEIFELSFAELLE.md)
