# Umsetzungsplan „Sprachrichtigkeit“

Stand: 10. Oktober 2026

## Aufbau

- **Technik:** React 19 mit TypeScript, gebaut mit Vite. Speicherung in IndexedDB (Bibliothek `idb`), installierbar als PWA mit Service Worker (`vite-plugin-pwa`), vollständig offline. Kein Konto, kein Server, kein Tracking.
- **Schriften:** Literata (Leseschrift für Übungssätze), Inter (Bedienelemente). Beide werden mitgeliefert, damit die App offline gleich aussieht.
- **Navigation:** Hash-Routen. Seitenleiste ab 768 px Breite, darunter Tableiste unten. Die Übungsansicht blendet die Navigation aus.
- **Inhalte:** je Kurs eine JSON-Datei in `src/content/` mit Kurs, Lektionen, Regelkarten und Aufgaben. Neue Dateien und neue Aufgaben werden ohne Codeänderung erkannt.

## Datenmodell (Version 1)

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

Die Datenversion steht in `meta`; Migrationen laufen beim Öffnen und beim Import.

## Reihenfolge

1. Gerüst, Datenmodell, Navigation, Übungsansicht mit allen Übungstypen
2. Kurs 1 und Kurs 3 vollständig, Fehlerbuch mit beiden Quellen
3. Übrige Kurse, tägliche Wiederholung, Einstufungstest
4. Statistik, Export, Sicherung, Feinschliff
5. Inhaltsprüfung (automatische Prüfung der Bank und Liste der Zweifelsfälle)

## Offene Annahmen

1. Die Übersicht „Sprachrichtigkeit fürs Abitur“ und die Screenshots von Anchor lagen nicht bei. Regelquelle sind die Tabellen im Auftrag; die Gestaltung folgt den dort genannten Grundsätzen.
2. Ein Sprachmodell steht in einer reinen Offline-Web-App ohne Server nicht zur Verfügung. Der Knopf „Neue Aufgaben“ entfällt; das Datenmodell kennt aber das Feld „geprüft“, und ungeprüfte Aufgaben sind löschbar.
3. Lektion 3.7 besteht aus Absätzen, Kurs 10 aus ganzen Texten. Für beide gelten eigene Ablaufgrößen; der Test zählt dort jede geprüfte Verbform bzw. jede Fehlerstelle als Einzelaufgabe (bestanden ab 90 %).
4. „In der Wiederholung“ umfasst tägliche Wiederholung, Mischtraining, gezieltes Üben und die Sitzung vor der Klausur.
5. Ein Übungstag ist ein Tag mit mindestens einer beantworteten Aufgabe.
6. PDF-Export erfolgt über eine eigene Druckansicht („Als PDF sichern“ im Druckdialog).
