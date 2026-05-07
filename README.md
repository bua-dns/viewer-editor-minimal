# Viewer Editor Minimal

Kleine Vue-3-Webapp zum Laden, Durchsuchen, Bearbeiten und Exportieren von JSON-Listen mit Objektkarten (inkl. Scan-Vorschau).

## Features

- JSON-Datei lokal hochladen (Top-Level muss ein Array von Objekten sein)
- Volltextsuche über alle Felder
- Kartenansicht mit Bildvorschau (`scan`-URL)
- Detail-Editor für einfache Feldtypen (`string`, `number`, `boolean`, `null`)
- Dirty-State mit Reset auf den importierten Stand
- Export als neue `*-edited.json`
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

## Projektstruktur

- `src/App.vue` – UI, Interaktionen, Layout
- `src/composables/useViewerData.js` – Datenlogik (Import, Suche, Editieren, Export)
- `src/composables/useViewerData.test.js` – Unit-Tests für Kernfunktionen
- `src/assets/styles.css` – Styling

## Lizenz

Aktuell keine Lizenzdatei hinterlegt. Falls das Projekt öffentlich genutzt werden soll, ergänze eine passende `LICENSE`.
