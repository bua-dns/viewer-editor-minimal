# Viewer Editor Minimal

Kleine Vue-3-Webapp zum Laden, Durchsuchen, Bearbeiten und Exportieren von JSON- und CSV-Listen mit Objektkarten (inkl. Scan-Vorschau).

## Features

- Datenmodus-Umschalter in der Topbar (`JSON | CSV`)
- Tab-Navigation mit Bereichen `Editieren` und `Info`
- JSON-Datei lokal hochladen (Top-Level-Array oder Objekt mit `data`-Array)
- CSV-Datei lokal hochladen (erste Zeile = Header, danach Datensaetze)
- Beispieldaten laden (`sample-data.json` / `sample-data.csv`) passend zum aktiven Datenmodus
- Volltextsuche über alle Felder
- Kartenansicht mit Bildvorschau (`scan`-URL)
- Detail-Editor für einfache Feldtypen (`string`, `number`, `boolean`, `null`)
- App-Config für Wording/Farbe (`config/app.config.js`, `config/wording.js`)
- Sprachumschalter (DE/EN) in der Topbar
- Dirty-State mit Reset auf den importierten Stand
- Export als neue `*-edited.json` (Format: `{ data, config }`)
- Minimale User-Config-GUI pro Feld (Typ, Beschriftung, Eingabehinweis, Reihenfolge per Drag-and-Drop)
- Felder koennen in der User-Config hinzugefuegt und entfernt werden
- User-Config anwenden auf die Felddarstellung in der Sidebar
- Bei aktivem CSV-Modus wechselt `Konfiguration anwenden` automatisch auf JSON-Modus
- User-Config bleibt in `sessionStorage` ueber Reloads erhalten
- Datenmodus bleibt in `sessionStorage` ueber Reloads erhalten
- Optionaler Timestamp im Export-Dateinamen (aktivierbar/deaktivierbar)
- Lightbox für größere Scan-Ansicht
- Keyboard-Shortcuts: `Escape` schliesst Lightbox bzw. Sidebar-Selektion
- Footer-Identity mit Links zu GitHub-Repository und Berlin University Collections

Hinweis zur Bedienung:
- Datenmodus- und Sprach-Umschalter sind als aktive/inaktive Segmented Controls dargestellt.

## Tech Stack

- Vue 3
- Vite
- Vitest
- Sass (SCSS)

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

Deploy-Hinweis:
- Der Vite-Build ist auf den Subpfad `/viewer-editor/` konfiguriert (`base` in `vite.config.js`).

## Tests

```bash
npm run test
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
  }
}
```

Beim JSON-Export nutzt die App immer das kanonische Format mit `data` und `config`.

Hinweise:
- Nicht-Objekte im Array werden abgewiesen.
- Falls `data` vorhanden ist, muss `data` ein Array sein.
- Falls `config` vorhanden ist, muss `config` ein valides Objekt mit `fields` sein.
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

- `src/App.vue` – UI-Composition-Root (Orchestrierung von Komponenten, Stores und Composables)
- `src/components/InfoPanel.vue` - rendert den Info-Tab aus `src/assets/texts/info.md`
- `src/composables/useViewerData.js` – Datenlogik (Import, Suche, Editieren, Export)
- `src/composables/useFieldMapping.js` - Mapping-Helpers fuer Sidebar-Feldrendering
- `src/composables/useDataImportExport.js` - Import/Export-Orchestrierung inkl. Dateimodus-Pruefung und Download-Flow
- `src/composables/useSelectionNavigation.js` - Navigation der gefilterten Auswahl (vor/zurueck/clear)
- `src/composables/useViewerData.test.js` – Unit-Tests für Kernfunktionen
- `src/composables/userConfigValidation.test.js` – Unit-Tests für die JSON-Config-Validierung
- `src/stores/useAppConfigStore.js` - App-weite Konfiguration (Sprache/Wording/Farbe)
- `src/stores/useUserConfigStore.js` - User-Config-State und Aktionen (Session, Apply, Add/Remove, Reorder)
- `src/stores/useDataTransferStore.js` - Datenmodus-UI-State und Dateinamenlogik (inkl. Session)
- `src/composables/userConfigValidation.js` - zentraler Validator fuer eingebettete JSON-Config
- `src/components/UserConfigPanel.vue` - User-Config-GUI als eigenstaendige SFC
- `src/components/DataTransferControls.vue` - Upload/Download-Controls als eigenstaendige SFC
- `src/components/ItemFieldEditor.vue` - Sidebar-Feldeditor als eigenstaendige SFC
- `src/components/ToolbarPanel.vue` - Toolbar-Bereich (Hinweise, Dirty-Hinweis) als eigenstaendige SFC
- `src/components/LightboxModal.vue` - Lightbox fuer grosse Scan-Ansicht als eigenstaendige SFC
- `src/components/ListPanel.vue` - Kartenliste inkl. Ergebniszustaende und Auswahlinteraktionen als eigenstaendige SFC
- `src/components/footer/Identity.vue` - Footer mit Projekt-/Institutions-Links
- `src/assets/texts/info.md` - Markdown-Quelle fuer den Info-Tab
- `src/assets/styles/index.scss` - zentraler Styling-Einstieg
- `src/assets/styles/tokens/_index.scss` - globale Design-Tokens als CSS-Variablen (`--ve-*`)
- `src/assets/styles/base/_index.scss` - Base-Layer (Reset, Elemente, globale Utilities)
- `src/assets/styles/layout/_index.scss` - Layout-Layer (App-Shell, Grid, responsive Struktur)
- `src/assets/styles/legacy.scss` - temporaerer Migrations-Layer fuer bestehende globale Styles
- `src/assets/styles/components/_index.scss` - optionaler Ausnahme-Layer fuer globale Sonderfaelle
- `config/app.config.js` - App-Konfiguration (Wording-Handles, Primärfarbe, Default-Sprache)
- `config/wording.js` - Sprachvarianten je Wording-Handle

## Styling-Architektur

- Zentral in `src/assets/styles/`: Tokens, Base, Layout und globale Utilities.
- Farbthema basiert auf semantischen Root-Tokens (`--color-*`) in `src/assets/styles/tokens/_index.scss` und wird auf bestehende `--ve-*` Tokens gemappt, damit Alt-Styles stabil bleiben.
- Aktuelle Theme-Palette: Primary `#0066CC`, Primary Hover `#004F99`, Secondary `#FF8C42`, Background `#EEF1F5`, Surface `#FFFFFF`, Border `#D6DCE5`, Text `#1F2937`/`#5B6575`.
- Globaler App-Hintergrund ist ein radialer Verlauf in `src/assets/styles/base/_index.scss` (`#F8FAFC -> #EEF1F5 -> #E7ECF2`).
- Komponenten-spezifische Styles gehoeren in die jeweiligen SFCs (`<style scoped lang="scss">`).
- `components/_index.scss` nur fuer Ausnahmen mit notwendiger globaler Wirkung (z. B. Third-Party-Overrides).
- Fuer kritische UI-Steuerungen (Tabs, Modus-Switch, Transfer-Buttons, Karten) sind lokale `:hover`-Regeln gesetzt, damit globale `button:hover`-Styles keine unerwuenschten Farbwechsel erzeugen.

## Lizenz

MIT License - Copyright (c) 2026 Michael Müller, Digitales Netzwerk Sammlungen.
Siehe `LICENSE`.
