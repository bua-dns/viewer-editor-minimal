# Viewer Editor Minimal

Kleine Vue-3-Webapp zum Laden, Durchsuchen, Bearbeiten und Exportieren von JSON- und CSV-Listen mit Objektkarten (inkl. Scan-Vorschau).

## Features

- Datenmodus-Umschalter in der Topbar (`JSON | CSV`)
- JSON-Datei lokal hochladen (Top-Level muss ein Array von Objekten sein)
- CSV-Datei lokal hochladen (erste Zeile = Header, danach Datensaetze)
- Volltextsuche über alle Felder
- Kartenansicht mit Bildvorschau (`scan`-URL)
- Detail-Editor für einfache Feldtypen (`string`, `number`, `boolean`, `null`)
- App-Config für Wording/Farbe (`config/app.config.js`, `config/wording.js`)
- Sprachumschalter (DE/EN) in der Topbar
- Dirty-State mit Reset auf den importierten Stand
- Export als neue `*-edited.json`
- Minimale User-Config-GUI pro Feld (Typ, Beschriftung, Eingabehinweis, Reihenfolge per Drag-and-Drop)
- Felder koennen in der User-Config hinzugefuegt und entfernt werden
- User-Config anwenden auf die Felddarstellung in der Sidebar
- User-Config als JSON herunterladen
- User-Config bleibt in `sessionStorage` ueber Reloads erhalten
- Datenmodus bleibt in `sessionStorage` ueber Reloads erhalten
- Lightbox für größere Scan-Ansicht

## Tech Stack

- Vue 3
- Vite
- Vitest

## Voraussetzungen

- Node.js 18+ (empfohlen: aktuelle LTS)
- npm

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Danach im Browser die von Vite ausgegebene URL öffnen (meist `http://localhost:5173`).

## Build und Preview

```bash
npm run build
npm run preview
```

## Tests

```bash
npm run test
```

## Erwartetes JSON-Format

Die App erwartet ein JSON-Array mit Objekten als Top-Level:

```json
[
  {
    "inventory_number": "A.51-98-6-778",
    "species": "Cedrus atlantica",
    "collector": "Georg August Schweinfurth",
    "location": "Tugurt bei Batna",
    "date": "3.6.1898",
    "scan": "https://example.org/card-1.jpg"
  }
]
```

Hinweise:
- Nicht-Objekte im Array werden abgewiesen.
- Bei ungültigem JSON oder falscher Struktur zeigt die App eine Fehlermeldung.
- Für die Bildvorschau muss `scan` eine direkt ladbare Bild-URL sein (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`).

## Erwartetes CSV-Format

CSV erwartet eine Header-Zeile und danach Datensaetze:

```csv
inventory_number,species,collector,scan
A.51-98-6-778,Cedrus atlantica,Georg August Schweinfurth,https://example.org/card-1.jpg
```

Hinweise:
- Das Feld `scan` wird automatisch als Digitalisat-URL interpretiert und fuer die Scan-Anzeige genutzt.
- Headernamen muessen eindeutig sein (keine doppelten Spaltennamen).
- Leere Spaltennamen sind unzulaessig.

## Projektstruktur

- `src/App.vue` – UI, Interaktionen, Layout
- `src/composables/useViewerData.js` – Datenlogik (Import, Suche, Editieren, Export)
- `src/composables/useViewerData.test.js` – Unit-Tests für Kernfunktionen
- `src/stores/useAppConfigStore.js` - App-weite Konfiguration (Sprache/Wording/Farbe)
- `src/assets/styles.css` – Styling
- `config/app.config.js` - App-Konfiguration (Wording-Handles, Primärfarbe, Default-Sprache)
- `config/wording.js` - Sprachvarianten je Wording-Handle

## Lizenz

Aktuell keine Lizenzdatei hinterlegt. Falls das Projekt öffentlich genutzt werden soll, ergänze eine passende `LICENSE`.
