# Umsetzungsplan „Sprachrichtigkeit“

Stand: 10. Oktober 2026

## Aufbau

- **Technik:** React 19 mit TypeScript, gebaut mit Vite. Speicherung in IndexedDB (Bibliothek `idb`), installierbar als PWA mit Service Worker (`vite-plugin-pwa`), vollständig offline. Kein Konto, kein Server, kein Tracking.
- **Schriften:** Literata (Leseschrift für Übungssätze), Inter (Bedienelemente). Beide werden mitgeliefert, damit die App offline gleich aussieht.
- **Navigation:** Hash-Routen. Seitenleiste ab 768 px Breite, darunter Tableiste unten. Die Übungsansicht blendet die Navigation aus.
- **Inhalte:** je Kurs eine JSON-Datei in `src/content/` mit Kurs, Lektionen, Regelkarten und Aufgaben. Neue Dateien und neue Aufgaben werden ohne Codeänderung erkannt.

## Datenmodell (Version 2)

| Objekt | Ort |
| --- | --- |
| Kurs, Lektion, Aufgabe (Bank) | JSON-Dateien je Kurs |
| eigene Aufgaben (aus dem Fehlerbuch, eigene Wörter) | IndexedDB `eigeneAufgaben` |
| Versuch | IndexedDB `versuche` |
| Wiederholungsstand | IndexedDB `wiederholung` |
| Fehlereintrag | IndexedDB `fehlerbuch` |
| Lektionsstand (Beherrschungsgrad, Rückstufung) | IndexedDB `lektionen` |
| Kursstand (Kurstest, Einstufung) | IndexedDB `kurse` |
| Einstellungen, laufende Sitzung, Datenversion | IndexedDB `meta` |
| Meine Schwächen: Stufen je Kategorie, Antworten mit Regelwahl, erfasste Fehler, eigene Aufgaben, laufendes Training, Checklisten | IndexedDB `meta`, Schlüssel `schwaechen` |

Die Datenversion steht in `meta`; Migrationen laufen beim Öffnen und beim Import.

## Reihenfolge

1. Gerüst, Datenmodell, Navigation, Übungsansicht mit allen Übungstypen
2. Kurs 1 und Kurs 3 vollständig, Fehlerbuch mit beiden Quellen
3. Übrige Kurse, tägliche Wiederholung, Einstufungstest
4. Statistik, Export, Sicherung, Feinschliff
5. Inhaltsprüfung (automatische Prüfung der Bank und Liste der Zweifelsfälle)
6. Prüfung im Browser (`npm run e2e`) und Feinschliff nach den Bildschirmfotos

Alle Schritte sind umgesetzt. Stand der Bank: 10 Kurse, 51 Lektionen, 1083 Aufgaben; dazu „Meine Schwächen“ mit 12 Kategorien und 351 Aufgaben.

## Offene Annahmen

1. Die Übersicht „Sprachrichtigkeit fürs Abitur“ und die Screenshots von Anchor lagen nicht bei. Regelquelle sind die Tabellen im Auftrag; die Gestaltung folgt den dort genannten Grundsätzen.
2. Ein Sprachmodell steht in einer reinen Offline-Web-App ohne Server nicht zur Verfügung. Der Knopf „Neue Aufgaben“ entfällt; das Datenmodell kennt aber das Feld „geprüft“, und ungeprüfte Aufgaben sind löschbar.
3. Lektion 3.7 besteht aus Absätzen, Kurs 10 aus ganzen Texten. Für beide gelten eigene Ablaufgrößen; der Test zählt dort jede geprüfte Verbform bzw. jede Fehlerstelle als Einzelaufgabe (bestanden ab 90 %).
4. „In der Wiederholung“ umfasst tägliche Wiederholung, Mischtraining, gezieltes Üben und die Sitzung vor der Klausur.
5. Ein Übungstag ist ein Tag mit mindestens einer beantworteten Aufgabe.
6. PDF-Export erfolgt über eine eigene Druckansicht („Als PDF sichern“ im Druckdialog).
7. „Gemeistert“ setzt „Sicher“ voraus: Erst der bestandene Lektionstest macht eine Lektion sicher, danach zählen 19 der letzten 20 Aufgaben an mindestens drei Tagen.
8. Rückstufung: Gezählt werden die letzten höchstens zehn Aufgaben der Lektion in der Wiederholung seit dem Sicher-Werden oder der letzten Rückstufung. Drei falsche darunter heißen unter 80 Prozent, auch wenn noch keine zehn beantwortet sind, denn die Quote der zehn kann dann 80 Prozent nicht mehr erreichen.
9. Aufgaben aus einem Klausurfehler (die eigene Aufgabe und fünf verwandte) sind sofort fällig, nicht erst am nächsten Tag; falsche Antworten in der App sind am nächsten Tag fällig.
10. „Meine Fassung ist auch richtig“: Bei Umformen und Textwiedergabe, wo ganze Sätze frei formuliert werden, kann eine als falsch gewertete Fassung nachträglich als richtig gewertet werden; Fehlerbucheintrag und Wiederholung werden zurückgenommen. Das fängt gleichwertige Fassungen ab, die die Bank nicht kennt.
11. Der Kurstest von Kurs 10 besteht aus zwei Korrekturtexten, die am längsten nicht bearbeitet wurden; bestanden ab 90 Prozent der Stellen.
12. Die CSV-Datei nutzt Semikolon und UTF-8 mit BOM, damit Excel sie mit Umlauten öffnet.
13. Safari auf dem iPad konnte hier nicht getestet werden; geprüft wurde mit Chromium in Tablet-Größe mit Touch-Emulation.
12. „Meine Schwächen“ läuft in einem eigenen Fenster (Fenstername `sr-schwaechen`); das Hauptfenster heißt `sr-haupt`, damit Kursverweise dort öffnen. Beide Fenster lesen beim Wechsel den Speicher neu.
13. Prüfung einer Kategorie: Ein vollständiges Training an einem Tag, an dem die Prüfung fällig ist. Gezählt werden alle Antworten des Trainings, auch Kontrollaufgaben; richtig heißt Antwort und Regel richtig. Ein Training vor dem Fälligkeitstag zählt als Übung und ändert die Stufe nicht.
14. Rückstufung bei Fehlern: Ein Fehler stuft nur eine gemeisterte Kategorie zurück (auf Stufe 3, Prüfung am nächsten Tag). In Stufe 1 bis 3 entscheidet allein die nächste Prüfung.
15. Kontrollaufgabe: höchstens zwei in Folge, damit ein Training nicht endlos wächst; sie stammt aus derselben Kategorie und möglichst zur selben Regel.
16. Transfer-Absätze gehören zu keiner Kategorie und ändern keine Stufe; Fehler darin zählen aber für Gewichtung, Wiederholungstäter und Checkliste und stufen eine gemeisterte Kategorie zurück.
