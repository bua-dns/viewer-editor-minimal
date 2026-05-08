# Technical Documentation

## Projektueberblick

`viewer-editor-minimal-version` ist eine Vue-3-Einzelansicht, mit der JSON-Dateien (Top-Level Array aus Objekten) geladen, gefiltert, bearbeitet, zurueckgesetzt und wieder exportiert werden koennen.

Kernfunktionen:

- JSON-Datei importieren und validieren
- Volltextsuche ueber alle Feldwerte
- Auswahl und Bearbeitung einfacher Feldtypen (`string`, `number`, `boolean`, `null`)
- Dirty-State inkl. Warnung beim Verlassen der Seite
- Reset auf Import-Snapshot
- Export der bearbeiteten Daten als neue JSON-Datei
- Bildvorschau fuer `scan`-URLs inkl. Lightbox und Fullscreen
- App-weites Wording ueber Handles + Sprachumschalter (DE/EN)
- Minimale User-Config-GUI pro Datenfeld mit Anwenden/Download

## Tech Stack

- Framework: Vue 3 (`script setup`, Composition API)
- Build Tool: Vite
- Tests: Vitest
- Sprache: JavaScript (ESM)

Abhaengigkeiten stehen in `package.json`.

## Projektstruktur

- `index.html` - Einstiegspunkt mit Mount-Node `#app`
- `src/main.js` - Bootstrapping (`createApp(App).mount('#app')`)
- `src/App.vue` - Haupt-UI und Interaktionen
- `src/composables/useViewerData.js` - Datenmodell, Validierung, Such-/Edit-Logik
- `src/composables/useViewerData.test.js` - Unit-Tests fuer Helpers und Kern-Flow
- `src/stores/useAppConfigStore.js` - globaler App-Config-Store (Sprache, Wording-Aufloesung, Primary Color)
- `src/assets/styles.css` - Layout, Komponenten-Styling, Responsive Regeln
- `config/app.config.js` - App-Konfiguration (Default-Sprache, Primary Color, Wording-Handles)
- `config/wording.js` - uebersetzte Textvarianten je Handle
- `vite.config.js` - Vite-Konfiguration mit Vue-Plugin

## App-Konfiguration und Wording

- `config/app.config.js` definiert die app-weiten Handles (z. B. `title`, `itemLabel`) und Basiswerte wie `language` und `primaryColor`.
- `config/wording.js` enthaelt die Sprachvarianten pro Handle (`de`, `en`).
- `src/stores/useAppConfigStore.js` loest Handles gegen die aktuell aktive Sprache auf und stellt die Werte als `computed` bereit.
- Sprachwechsel passiert in `App.vue` per einfachem `DE | EN`-Schalter in der Topbar.

## User-Config-GUI (minimal)

In `App.vue` gibt es einen einklappbaren Bereich "Konfiguration", der nach Datei-Upload verfuegbar ist.

Pro erkanntem Feld (ohne `scan`) kann gesetzt werden:

- `type`: `normal`, `text`, `integer`, `checkbox`
- `label`: alternative Feldbeschriftung
- `placeholder`: Eingabehinweis
- Reihenfolge via Drag-and-Drop

Verhalten:

- `Konfiguration anwenden` uebernimmt die aktuelle Konfiguration in die Darstellung der Sidebar-Felder.
- `Konfiguration herunterladen` exportiert eine JSON-Datei mit `version` und `fields`.
- Bei `type = text` wird ein `textarea` gerendert, sonst entsprechend `input`/`checkbox`.

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
- `errorMessage`: Validierungs- oder Parse-Fehler

### Computed Values

- `hasData`: `rawItems.length > 0`
- `selectedViewItem`: aktueller UI-Eintrag aus `viewItems`
- `selectedRawItem`: aktuelles Rohobjekt aus `rawItems`
- `filteredViewItems`: Suchergebnis (AND-Verknuepfung aller Tokens)

## Import-, Validierungs- und Parsing-Logik

Importweg:

1. Datei wird in `App.vue` per `<input type="file">` geladen.
2. Text wird an `importFromJsonText(text, fileName)` uebergeben.
3. `parseJsonArray` validiert:
   - gueltiges JSON
   - Top-Level ist Array
   - jedes Element ist ein Plain Object
4. Bei Erfolg initialisiert `initializeFromJsonArray` alle States neu.
5. Bei Fehler wird `errorMessage` gesetzt und der alte Stand bleibt erhalten.

Kopierstrategie:

- Daten werden via `cloneData` (`JSON.parse(JSON.stringify(...))`) tief kopiert.
- Vorteil: einfacher, stabiler Snapshot fuer Reset/Export.
- Einschraenkung: nicht geeignet fuer nicht-JSON-Typen (z. B. `Date`, `Map`, Funktionen).

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

## UI-Architektur (`App.vue`)

Die Seite ist in vier Bereiche gegliedert:

- Topbar: Upload, Download, Reset
- Topbar: zusaetzlich DE/EN-Sprachumschalter
- Toolbar: Dateiname, Suche, Trefferzaehler, Dirty-Hinweis
- Konfiguration: einklappbares Panel fuer User-Config
- Liste: Kartenansicht der gefilterten Items inkl. Scan-Vorschau
- Sidebar: Felder des selektierten Items und groessere Scan-Vorschau
- Statusbereich: Datei-/Fehlerstatus

Zusatzfunktionen:

- Lightbox fuer `scan`-Bild mit Fullscreen-Umschaltung
- Fallback-UI bei Bildladefehlern (Liste, Sidebar, Lightbox)
- `beforeunload`-Warnung bei `isDirty`
- `Escape` schliesst die Lightbox

## Export und Reset

- `createExportPayload()` liefert eine tiefe Kopie von `rawItems`.
- Download wird im Browser ueber `Blob` + temporaeren Link ausgeloest.
- Dateiname: `<importName>-edited.json` bzw. `data-edited.json`.
- Reset nutzt `importSnapshot` und stellt den Zustand des letzten gueltigen Imports wieder her.

## Styling und Responsiveness

`src/assets/styles.css` verwendet:

- Grid-Layout fuer Desktop (`toolbar/list/sidebar/status`)
- Responsive Umschaltung auf einspaltiges Layout bei `max-width: 768px`
- Kartenlayout fuer Item-Vorschau (`auto-fill`, `minmax(480px, 1fr)`)
- Lightbox mit dunklem Overlay

Hinweis:

- Sehr kleine Viewports koennen durch die grosse Karten-Mindestbreite horizontalen Druck erzeugen. Bei Bedarf kann `minmax(480px, 1fr)` reduziert werden.

## Testabdeckung

Tests in `src/composables/useViewerData.test.js` pruefen:

- Validierung von `parseJsonArray`
- Tokenisierung via `tokenize`
- Bild-URL-Erkennung via `looksLikeImageUrl`
- End-to-End-Flow der Composable-Logik:
  - Initialisieren
  - Filtern
  - Selektieren
  - Feld aktualisieren
  - Reset

Testlauf:

```bash
npm test
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

- Import erwartet strikt ein Array aus Objekten auf Top-Level.
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
