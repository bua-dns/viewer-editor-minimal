# Technical Documentation

## Projektueberblick

`viewer-editor-minimal-version` ist eine Vue-3-Einzelansicht, mit der JSON- und CSV-Dateien geladen, gefiltert, bearbeitet, zurueckgesetzt und wieder exportiert werden koennen.

Kernfunktionen:

- JSON-Datei importieren und validieren
- CSV-Datei importieren und validieren
- Beispieldaten passend zum aktiven Datenmodus laden
- Volltextsuche ueber alle Feldwerte
- Auswahl und Bearbeitung einfacher Feldtypen (`string`, `number`, `boolean`, `null`)
- Dirty-State inkl. Warnung beim Verlassen der Seite
- Reset auf Import-Snapshot
- Export der bearbeiteten Daten als neue JSON- oder CSV-Datei
- Bildvorschau fuer `scan`-URLs inkl. Lightbox und Fullscreen
- App-weites Wording ueber Handles + Sprachumschalter (DE/EN)
- Minimale User-Config-GUI pro Datenfeld mit Anwenden
- Session-persistente User-Config (via `sessionStorage`)
- Session-persistenter Datenmodus JSON/CSV (via `sessionStorage`)
- Optionaler Timestamp im Export-Dateinamen
- Keyboard-Shortcuts mit `Escape` (Lightbox schliessen / Sidebar-Auswahl aufheben)
- Tab-Navigation mit zwei Bereichen (`Editieren`, `Info`)
- Desktop-Sticky-Layout: Tabs + Edit-Header bleiben beim Scrollen sichtbar; Sidebar bleibt separat sticky

## Tech Stack

- Framework: Vue 3 (`script setup`, Composition API)
- Build Tool: Vite
- Tests: Vitest
- Sprache: JavaScript (ESM)
- Deployment Base Path: `/viewer-editor/` (gesetzt in `vite.config.js`)

Abhaengigkeiten stehen in `package.json`.

## Projektstruktur

- `index.html` - Einstiegspunkt mit Mount-Node `#app`
- `src/main.js` - Bootstrapping (`createApp(App).mount('#app')`)
- `src/App.vue` - Haupt-UI und Interaktionen
- `src/components/InfoPanel.vue` - rendert den Info-Bereich aus Markdown-Inhalt
- `src/components/footer/Identity.vue` - Footer-Identity; Text und ARIA-Labels aus dem zentralen Wording
- `src/components/UserConfigPanel.vue` - ausgelagerte User-Config-Oberflaeche
- `src/components/DataTransferControls.vue` - ausgelagerte Upload/Download-Oberflaeche
- `src/components/ItemFieldEditor.vue` - ausgelagerte Sidebar-Feldeditor-Oberflaeche
- `src/components/ListPanel.vue` - Kartenliste inkl. optional getrenntem Kopf-/Body-Rendering fuer sticky Header
- `src/composables/useFieldMapping.js` - Mapping-Helpers fuer Feldlabel/Typ/Placeholder/Sortierung
- `src/composables/useViewerData.js` - Datenmodell, Validierung, Such-/Edit-Logik
- `src/composables/useDataImportExport.js` - Import/Export-Flow inkl. Dateimodus-Validierung und Download-Ausleitung
- `src/composables/useSelectionNavigation.js` - Auswahlindex-Berechnung und Vor/Zurueck-Navigation
- `src/composables/useViewerData.test.js` - Unit-Tests fuer Helpers und Kern-Flow
- `src/composables/userConfigValidation.test.js` - Unit-Tests fuer JSON-Config-Validierung
- `src/stores/useAppConfigStore.js` - globaler App-Config-Store (Sprache, Wording-Aufloesung, Primary Color)
- `src/stores/useUserConfigStore.js` - User-Config-Store (State, Session, Add/Remove, Reorder, Apply)
- `src/stores/useDataTransferStore.js` - Data-Transfer-Store (Modus, Session, Dateinamenlogik)
- `src/composables/userConfigValidation.js` - zentraler Validator fuer importierte JSON-Config
- `src/assets/styles/index.scss` - globaler Styling-Einstieg (Tokens, Base, Layout, Komponenten-Layer)
- `src/assets/texts/info.md` - editierbare Markdown-Inhalte fuer den Info-Tab
- `src/components/footer/Identity.vue` - Footer-Identity mit externen Projektlinks
- `config/app.config.js` - App-Konfiguration (Default-Sprache, Primary Color, Wording-Handles)
- `config/wording.js` - uebersetzte Textvarianten je Handle
- `vite.config.js` - Vite-Konfiguration mit Vue-Plugin

## App-Konfiguration und Wording

- `config/app.config.js` definiert die app-weiten Handles (z. B. `title`, `itemLabel`) und Basiswerte wie `language` und `primaryColor`.
- `config/wording.js` enthaelt die Sprachvarianten pro Handle (`de`, `en`).
- `src/stores/useAppConfigStore.js` loest Handles gegen die aktuell aktive Sprache auf und stellt die Werte als `computed` bereit.
- Sprachwechsel passiert in `App.vue` per einfachem `DE | EN`-Schalter in der Topbar.
- Tab-Beschriftungen (`Editieren`/`Info`) sowie Footer-Credit und zugehoerige ARIA-Labels werden ebenfalls ueber Wording-Handles lokalisiert.

## User-Config-GUI (minimal)

Die User-Config ist modularisiert:

- `UserConfigPanel.vue` kapselt die GUI.
- `useUserConfigStore.js` kapselt den zugehoerigen State und die Aktionen.
- `App.vue` orchestriert nur noch (Apply, Datenmodus-Wechsel, Datenfluss).

Im UI gibt es einen einklappbaren Bereich "Konfiguration", der nach Datei-Upload verfuegbar ist.

Pro erkanntem Feld (ohne `scan`) kann gesetzt werden:

- `type`: `normal`, `text`, `integer`, `checkbox`
- `label`: alternative Feldbeschriftung
- `placeholder`: Eingabehinweis
- Reihenfolge via Drag-and-Drop

Zusaetzlich:

- neue Felder koennen manuell angelegt werden
- vorhandene Felder koennen aus der Konfiguration entfernt werden

Verhalten:

- `Konfiguration anwenden` uebernimmt die aktuelle Konfiguration in die Darstellung der Sidebar-Felder.
- Falls beim Anwenden der Konfiguration der Datenmodus auf `CSV` steht, schaltet die App automatisch auf `JSON` um.
- Bei `type = text` wird ein `textarea` gerendert, sonst entsprechend `input`/`checkbox`.
- Entfernte Felder werden beim Anwenden auch aus den geladenen Datensaetzen entfernt.
- Hinzugefuegte Felder werden beim Anwenden in allen Datensaetzen initialisiert (`''` bzw. `false` bei `checkbox`).
- Konfigurationszustand (`fields`, `appliedFields`) wird unter `viewerEditor.userConfig.v1` in `sessionStorage` gespeichert.

## Datenmodell und State

Die zentrale Logik liegt in `useViewerData()` (`src/composables/useViewerData.js`).

### Reaktive States

- `rawItems`: aktuell bearbeitete Datensaetze
- `viewItems`: abgeleitete Liste mit UI-Metadaten
  - `_uid`: stabile Identifikation in der UI
  - `_index`: Verweis auf Index in `rawItems`
  - `_searchText`: normalisierter Suchtext je Datensatz
- `importSnapshot`: unveraenderte Kopie des letzten gueltigen Imports
- `selectedUid`: aktuell ausgewaehlter UI-Eintrag
- `searchQuery`: Suchfeldinhalt
- `isDirty`: ungespeicherte Aenderungen vorhanden
- `importFileName`: Name der importierten Datei
- `importedConfig`: optional eingebettete JSON-Config aus dem letzten JSON-Import
- `errorMessage`: Validierungs- oder Parse-Fehler

### Computed Values

- `hasData`: `rawItems.length > 0`
- `selectedViewItem`: aktueller UI-Eintrag aus `viewItems`
- `selectedRawItem`: aktuelles Rohobjekt aus `rawItems`
- `filteredViewItems`: Suchergebnis (AND-Verknuepfung aller Tokens)

## Import-, Validierungs- und Parsing-Logik

Die Data-Transfer-Funktion ist modularisiert:

- `DataTransferControls.vue` kapselt die Header-Controls fuer Upload/Download/Reset/Modus.
- `useDataTransferStore.js` kapselt Datenmodus, Session-Persistenz und Dateinamenslogik.
- Upload/Download-Verarbeitung liegt in `useDataImportExport.js`, waehrend Parsing/Serialisierung in `useViewerData` und User-Config-Store aufgeteilt ist.
- `App.vue` orchestriert die Integrationspunkte (Import-Funktionen aus `useViewerData`, User-Config-Reset bei Moduswechsel) und bindet die Composable-Handler in die UI ein.

### Datenmodus im Header

- In der Topbar kann zwischen `JSON` und `CSV` umgeschaltet werden.
- Der gewaehlte Modus wird unter `viewerEditor.dataMode.v1` in `sessionStorage` gespeichert.
- Upload-Button-Label und `accept`-Filter passen sich an den Modus an.
- Solange keine Daten geladen sind, ist zusaetzlich ein Button fuer passende Beispieldaten sichtbar.
- Dateityp-Mismatch wird mit Fehlermeldung blockiert.
- Die Umschalter fuer Datenmodus und Sprache sind als visuell aktive/inaktive Segmented Controls umgesetzt.
- Download-Dateinamen koennen optional einen Timestamp enthalten (UI-Checkbox in `DataTransferControls.vue`).

### JSON-Import

Importweg:

1. Datei wird in `App.vue` per `<input type="file">` geladen.
2. Text wird an `importFromJsonText(text, fileName)` uebergeben.
3. `parseJsonPayload` validiert:
   - gueltiges JSON
   - entweder Top-Level-Array, oder Objekt mit `data`-Array
   - jedes Datenelement ist ein Plain Object
   - falls vorhanden: `config` ist Objekt
4. Bei Erfolg initialisiert `initializeFromJsonArray` alle States neu und uebernimmt optionale `config` in `importedConfig`.
5. `App.vue` validiert und appliziert eingebettete `config` strikt (bei Fehler harter Abbruch mit Fehlermeldung).
6. Bei Fehler wird `errorMessage` gesetzt und der alte Stand bleibt erhalten.

Kopierstrategie:

- Daten werden via `cloneData` (`JSON.parse(JSON.stringify(...))`) tief kopiert.
- Vorteil: einfacher, stabiler Snapshot fuer Reset/Export.
- Einschraenkung: nicht geeignet fuer nicht-JSON-Typen (z. B. `Date`, `Map`, Funktionen).

### CSV-Import

- CSV-Import nutzt `parseCsvText` in `src/composables/useViewerData.js`.
- Erste Zeile wird als Header interpretiert, danach folgt zeilenweise Mapping auf Objekte.
- CSV-Header wird validiert:
  - keine leeren Spaltennamen
  - keine doppelten Spaltennamen
- Datenzeilen werden validiert:
  - mehr Spalten als im Header fuehren zu einem Parse-Fehler
  - fehlende trailing Spalten werden mit leerem String (`''`) aufgefuellt
- Das Feld `scan` wird bei Header-Normalisierung explizit auf `scan` gesetzt (case-insensitive), damit die bestehende Scan-UI automatisch greift.

## Suche

- `toSearchText(item)` kombiniert alle Feldwerte als lowercase String.
- `tokenize(query)` normalisiert und splittet die Suchanfrage.
- Filter: Ein Datensatz matcht nur, wenn **alle** Tokens enthalten sind.

Beispiel:

- Query `"oak berlin"` liefert nur Items, deren `_searchText` sowohl `oak` als auch `berlin` enthaelt.

## Bearbeitungslogik

`updateField(key, nextRawValue)` bearbeitet nur einfache Typen:

- `number`: String-Input wird mit `Number(...)` geparst; `NaN` wird verworfen
- `boolean`: Wert wird auf `Boolean(...)` normalisiert
- `null`: leerer String wird wieder `null`, sonst String
- `string`: direkte Uebernahme

Nach erfolgreicher Aenderung:

- Feldwert in `rawItems` wird aktualisiert
- `_searchText` wird fuer das Item neu berechnet
- `isDirty` wird auf `true` gesetzt

Nicht editierbare komplexe Werte (Objekte/Arrays) werden in der UI als JSON in `<pre>` angezeigt.

## Sidebar Field Editor Modularization

- `ItemFieldEditor.vue` kapselt das Rendering der Datenfelder in der Sidebar.
- `useFieldMapping.js` kapselt die Mapping-Regeln fuer:
  - Feldlabel
  - Input-Typ (`text`, `textarea`, `checkbox`, `number`)
  - Placeholder
  - Feldreihenfolge
- `App.vue` orchestriert nur noch die Feld-Update-Events und reicht sie an `useViewerData` weiter.

## UI-Architektur (`App.vue`)

Die Seite ist in mehrere Bereiche gegliedert:

- Oberhalb des Inhalts: sticky Tab-Leiste fuer `Editieren` und `Info` inkl. Tastatursteuerung (Left/Right/Home/End/Enter/Space)
- Im Edit-Tab: sticky Header-Stack mit Titel/Transfer-Controls, Konfiguration und Listenkopf (`Digitalisate` + Suche)
- Upload/Download-Buttons behalten feste Breiten je Aktionstyp, damit beim Moduswechsel kein Layout-Springen entsteht.
- Toolbar: Dateiname-Hinweis und Dirty-Hinweis
- Liste: Kartenansicht der gefilterten Items inkl. Scan-Vorschau (scrollbarer Hauptbereich)
- Sidebar: Felder des selektierten Items und groessere Scan-Vorschau (desktop sticky mit internem Scroll)
- Erweiterter Edit-Modus: Sidebar kann auf volle Inhaltsbreite umgeschaltet werden (eigener Expand/Collapse-Button mit SVG-Icons)
- Statusbereich: Datei-/Fehlerstatus
- Footer im Statusbereich: Identity-Links (GitHub, Berlin University Collections)

Zusatzfunktionen:

- Lightbox fuer `scan`-Bild mit Fullscreen-Umschaltung
- Fallback-UI bei Bildladefehlern (Liste, Sidebar, Lightbox)
- `beforeunload`-Warnung bei `isDirty` oder nicht angewendeten User-Config-Aenderungen
- `Escape` schliesst die Lightbox; bei offener Sidebar hebt `Escape` die aktuelle Auswahl auf

Interne Script-Aufteilung:

- `useSelectionNavigation.js` kapselt `selectedFilteredIndex`, `canGoPrevious`, `canGoNext` sowie die Aktionen fuer vorheriges/naechstes Item und Selektion aufheben.
- `useDataImportExport.js` kapselt Dateityp-Mismatch-Checks, Datei-Importpfad (`csv/json`), optionales Anwenden eingebetteter JSON-Config sowie Download/Reset-Handler.
- `App.vue` bleibt damit der Composition-Root und konzentriert sich auf Verdrahtung von Komponenten, Stores, Watchern und Lifecycle-Events.

## Export und Reset

- `createExportPayload()` liefert eine tiefe Kopie von `rawItems`.
- JSON-Export schreibt immer das kanonische Format `{ data: <items>, config: <user-config> }`.
- CSV-Export schreibt nur Nutzdaten (ohne Config).
- Download wird in `useDataImportExport.js` ueber eine zentrale Helper-Funktion (`triggerBrowserDownload`) mit `Blob` + temporaerem Link ausgelagert.
- Dateiname: `<importName>-edited.<json|csv>` bzw. `data-edited.<json|csv>`.
- Falls aktiviert: Dateiname mit Timestamp im Format `<importName>-edited-YYYY-MM-DD_hh-mm-ss.<json|csv>`.
- Reset nutzt `importSnapshot` und stellt den Zustand des letzten gueltigen Imports wieder her.

## Styling und Responsiveness

Die Styles sind in Layer aufgeteilt (`src/assets/styles/index.scss`):

- `tokens/_index.scss`: zentrale Farb-/Spacing-/Typo-Tokens
- `base/_index.scss`: Basiselemente, Fokuszustand, globaler Hintergrund
- `layout/_index.scss`: Grid-Layout und Responsive-Regeln
- `legacy.scss`: temporaerer Migrations-Layer fuer globale Alt-Styles
- Wichtige interaktive Controls uebersteuern `button:hover` lokal (z. B. Tabs, Datenmodus-Switch, Transfer-Buttons, Listenkarten), damit Hover-Farben konsistent mit Primary/Secondary bleiben.

Das aktuelle Farbschema nutzt semantische Root-Tokens (`--color-*`) mit Mapping auf bestehende `--ve-*` Variablen, damit bestehende Komponenten-Regeln unveraendert bleiben.

- Primary `#0066CC` / Hover `#004F99`
- Secondary `#FF8C42` / Hover `#E56E2E`
- Background `#EEF1F5`, Surface `#FFFFFF`
- Border `#D6DCE5` / Soft `#E5EAF0`
- Text `#1F2937` / Secondary `#5B6575`

Globaler Seitenhintergrund:

- `radial-gradient(circle at top, #F8FAFC 0%, #EEF1F5 60%, #E7ECF2 100%)`

Layoutverhalten:

- Grid-Layout fuer Desktop (`list/sidebar/status`)
- Desktop nutzt zusaetzlich einen sticky Header-Stack im Edit-Tab; Hoehen werden in `App.vue` per `ResizeObserver` gemessen und als CSS-Variablen fuer Sticky-Offets gesetzt
- Responsive Umschaltung auf einspaltiges Layout bei `max-width: 768px`
- Im erweiterten Modus wird die Sidebar nicht sticky gerendert, nutzt volle Inhaltsbreite und vergroessert den Scanbereich relativ zur Feldspalte
- Kartenlayout fuer Item-Vorschau (`auto-fill`, `minmax(480px, 1fr)`) 
- Lightbox mit dunklem Overlay

Hinweis:

- Sehr kleine Viewports koennen durch die grosse Karten-Mindestbreite horizontalen Druck erzeugen. Bei Bedarf kann `minmax(480px, 1fr)` reduziert werden.

## Testabdeckung

Tests in `src/composables/useViewerData.test.js` pruefen:

- Validierung von `parseJsonPayload`
- Tokenisierung via `tokenize`
- Bild-URL-Erkennung via `looksLikeImageUrl`
- CSV-Randfaelle:
  - Quotes und escaped Quotes in `splitCsvLine`
  - leere Werte und fehlende trailing Spalten in `parseCsvText`
  - Spaltenabweichung (mehr Werte als Header) mit Fehlerpfad
- End-to-End-Flow der Composable-Logik:
  - Initialisieren
  - Filtern
  - Selektieren
  - Feld aktualisieren
  - Reset

Tests in `src/composables/userConfigValidation.test.js` pruefen:

- gueltige JSON-Config-Payloads
- fehlendes/ungueltiges `fields`-Objekt
- nicht unterstuetzte Feldtypen

Testlauf:

```bash
npm run test
```

## Lokale Entwicklung

```bash
npm install
npm run dev
```

Weitere Skripte:

- `npm run build` - Produktionsbuild
- `npm run preview` - Build lokal serven

## Bekannte Grenzen

- Import akzeptiert Top-Level-Array oder `data`-Array; `data` als Objekt ist ungueltig.
- CSV-Parser ist bewusst minimal (Komplexitaet fuer exotische CSV-Formate wird noch nicht vollstaendig abgedeckt).
- Editierbar sind nur primitive/simple Felder (`string`, `number`, `boolean`, `null`).
- Deep Clone via JSON-Serialize unterstuetzt keine Spezialtypen.
- Bildvorschau basiert auf URL-Pattern und prueft keine Erreichbarkeit vor dem Laden.

## Erweiterungspunkte

Typische naechste Schritte fuer eine produktive Weiterentwicklung:

- Schema-basierte Feldvalidierung (z. B. pro Key-Regeln)
- Undo/Redo statt nur globalem Reset
- Persistente Sessions (Local Storage)
- Virtuelles Scrolling/Pagination fuer grosse Datensaetze
- Feinere i18n/Locale-Unterstuetzung
