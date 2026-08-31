# Viewer Editor Minimal

Kleine Vue-3-Webapp zum Laden, Durchsuchen, Bearbeiten und Exportieren von JSON- und CSV-Listen mit Objektkarten (inkl. Scan-Vorschau).

> Diese README ist die kurze Einstiegs- und Setup-Beschreibung.
> Die maßgebliche Implementierungs- und Architekturreferenz ist
> [`docs/technical-documentation.md`](docs/technical-documentation.md).

## Features

- Lokales Bearbeiten von JSON- und CSV-Daten inkl. Validierung, Reset und Export
- Online-Betrieb gegen Strapi: Login (FE-Users), Laden der Konfiguration und Items, feldgenaues Speichern
- Anlegen neuer Items im Online-Modus (lokaler Entwurf, Persistenz beim Speichern)
- Hierarchische Navigation (Level-1-Boxen, einklappbare Level-2-Gruppen) mit bedarfsgesteuertem Nachladen
- Konfigurierbare Feldtypen: `normal`, `text`, `integer`, `checkbox`, `candidate`, `wikidata-autosuggest`
- Wikidata-Autosuggest inkl. Priorisierung, Statement-Nachladen und mehrsprachigen Labels
- User-Config-GUI pro Feld (Typ, Beschriftung, Hinweis, Breite, Reihenfolge per Drag-and-Drop)
- Volltextsuche über alle Felder sowie Sortierung nach Bearbeitungsstand und `suspendEditing`
- Ersetzungslisten je Feld (werden gesammelt und exportiert, nicht automatisch angewendet)
- Kartenansicht mit Bildvorschau (`scan`-URL) inkl. Lightbox; ohne `scan` automatische Listenansicht
- Lokalisierung über Wording-Handles (DE/EN), optional aus dem Backend überschreibbar
- Tab `Einstellungen` für Strapi-Verbindungsprofile und zur Laufzeit editierbare App-Settings
- Tab-Navigation: `Editieren`, `Konfiguration`, `Ersetzungen`, `Einstellungen`, `Info`
- Responsives Editor-Layout mit sticky Kopfbereich und erweitertem Vollbreiten-Modus

Details zu jedem Punkt stehen in der [Technischen Dokumentation](docs/technical-documentation.md).

## Tech Stack

- Vue 3, Vite, Vitest
- Sass (SCSS)
- `markdown-it` + `highlight.js` (Info-Tab)

## Voraussetzungen

- Node.js 18+ (empfohlen: aktuelle LTS)
- pnpm (im Repository liegt ausschließlich `pnpm-lock.yaml`)

## Lokale Entwicklung

```bash
pnpm install
pnpm dev
```

Danach im Browser die von Vite ausgegebene URL öffnen (meist `http://localhost:5173`).

## Build und Preview

```bash
pnpm build
pnpm preview
```

Deploy-Hinweis:
- Der Vite-Build ist auf den Subpfad `/viewer-editor-strapi/` konfiguriert (`base` in `vite.config.js`).

## Tests

```bash
pnpm test
```

## Erwartetes JSON-Format

Beim Import werden zwei JSON-Formate akzeptiert:

1) Top-Level-Array (kompatibel zum bisherigen Verhalten):

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

2) Objekt mit eingebettetem Nutzdaten- und Konfigurationsblock:

```json
{
  "data": [
    {
      "inventory_number": "A.51-98-6-778",
      "species": "Cedrus atlantica",
      "scan": "https://example.org/card-1.jpg"
    }
  ],
  "config": {
    "version": 1,
    "fields": {
      "species": {
        "type": "normal",
        "label": "",
        "order": 0,
        "placeholder": ""
      }
    }
  },
  "replacements": {
    "abbreviations": { "Berl.": "Berlin" }
  }
}
```

Beim JSON-Export nutzt die App immer das kanonische Format `{ data, config, suspendedItems, replacements }`. `suspendedItems` ist ein Array von Item-Indizes und darf auch beim Import mitgegeben werden; `replacements` wird unverändert durchgereicht.
Wenn beim Download noch nicht angewendete Konfigurationsänderungen vorhanden sind, werden diese vor dem Export automatisch angewendet. Dadurch passen exportierte Daten und exportierte Konfiguration immer zusammen.

### Feldtyp `candidate` in `config.fields`

`candidate` ist ein regulärer Feldtyp in `config.fields` und speichert den Vorschlagswert selbst als String im Item.

Beispiel:

```json
{
  "fields": {
    "title": {
      "type": "normal"
    },
    "title_candidate": {
      "type": "candidate",
      "candidate": {
        "targetField": "title",
        "inputType": "normal"
      }
    }
  }
}
```

Hinweise:
- `candidate.targetField` ist Pflicht und muss auf ein vorhandenes, nicht-`candidate` Feld zeigen.
- Gültige Zieltypen: `normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`.
- `candidate.inputType` ist optional und kann `normal` (Default) oder `text` sein.
- In der Sidebar ist pro Candidate-Feld ein Inline-Button verfügbar: Klick übernimmt den Vorschlag in das Ziel-Feld.
- Bei Zieltyp `wikidata-autosuggest` wird der Wert als Such-Query vorbefüllt und die Suche direkt gestartet (ohne Auto-Selektion).

Hinweise:
- Nicht-Objekte im Array werden abgewiesen.
- Falls `data` vorhanden ist, muss `data` ein Array sein.
- Falls `config` vorhanden ist, muss `config` ein valides Objekt mit `fields` sein.
- Falls `replacements` vorhanden ist, muss `replacements` ein Objekt sein. Inhalt wird derzeit nicht weiter validiert und beim Export unverändert durchgereicht.
- Bei ungültigem JSON oder falscher Struktur zeigt die App eine Fehlermeldung.
- Für die Bildvorschau muss `scan` eine direkt ladbare Bild-URL sein (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`).

## Erwartetes CSV-Format

CSV erwartet eine Header-Zeile und danach Datensätze:

```csv
inventory_number,species,collector,scan
A.51-98-6-778,Cedrus atlantica,Georg August Schweinfurth,https://example.org/card-1.jpg
```

Hinweise:
- Das Feld `scan` wird automatisch als Digitalisat-URL interpretiert und für die Scan-Anzeige genutzt.
- Headernamen müssen eindeutig sein (keine doppelten Spaltennamen).
- Leere Spaltennamen sind unzulässig.
- Führende/nachgestellte Leerzeichen in CSV-Werten bleiben beim Import erhalten (auch in unquoted Feldern).
- CRLF-Zeilenenden werden unterstützt; nur der Zeilenumbruch selbst wird entfernt.

## Projektstruktur (Überblick)

- `src/App.vue` – UI-Composition-Root (Verdrahtung von Komponenten, Stores und Composables)
- `src/components/` – SFCs für Liste, Sidebar-Editor, Konfiguration, Ersetzungen, Einstellungen, Modals
- `src/composables/` – Datenlogik, Import/Export, Feld-Mapping, Navigation, Wikidata-Suche, Validierung
- `src/stores/` – App-Config, User-Config, Datenmodus, Ersetzungen, Auth, Online-Modus/-Settings/-Items/-Updates
- `src/fields/` – zentrale Feldtypen-Registry
- `src/services/strapiApi.js` – gesamter Strapi-HTTP-Zugriff
- `src/assets/` – Styles (Tokens/Base/Layout/Components/Legacy), Info-Texte, Icons, Logos
- `config/` – `app.config.js` (App-Defaults) und `wording.json` (Sprachvarianten)
- `public/` – Beispieldaten, Beispielscans, optionales Default-Verbindungsprofil
- Tests liegen als `*.test.js` neben ihrem jeweiligen Modul

Die vollständige Dateiliste mit Verantwortlichkeiten steht in der
[Technischen Dokumentation, Kapitel 3](docs/technical-documentation.md#3-projektstruktur).

## Styling-Architektur

- Zentral in `src/assets/styles/`: Tokens, Base, Layout, Components und ein Legacy-Layer.
- Das Farbthema basiert auf semantischen Root-Tokens (`--color-*`), die auf die bestehenden `--ve-*` Tokens gemappt werden.
- `--color-primary` wird zur Laufzeit aus der App-Config (`primaryColor`) überschrieben.
- Komponenten-spezifische Styles gehören in die jeweiligen SFCs (`<style scoped lang="scss">`);
  `components/_index.scss` nur für Ausnahmen mit notwendiger globaler Wirkung.

Details: [Technische Dokumentation, Kapitel 15](docs/technical-documentation.md#15-styling-und-responsiveness).

## Lizenz

MIT License - Copyright (c) 2026 Michael Müller, Digitales Netzwerk Sammlungen.
Siehe `LICENSE`.
