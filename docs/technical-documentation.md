# Technical Documentation

## Projektueberblick

`viewer-editor-minimal-version` ist eine Vue-3-Einzelansicht, mit der JSON- und CSV-Dateien geladen, gefiltert, bearbeitet, zurueckgesetzt und wieder exportiert werden koennen.

Kernfunktionen:

- JSON-Datei importieren und validieren
- CSV-Datei importieren und validieren
- Beispieldaten passend zum aktiven Datenmodus laden
- Volltextsuche ueber alle Feldwerte
- Auswahl und Bearbeitung einfacher Feldtypen (`string`, `number`, `boolean`, `null`)
- Strukturierter Feldtyp `wikidata-autosuggest` mit Entity-Array-Wertmodell
- Konfigurierbare Priorisierung fuer `wikidata-autosuggest` (`claimPresence`, `claimValueMatch`)
- Automatischer Listenmodus ohne Bildkacheln, wenn keine `scan`-Spalte vorhanden ist
- Konfigurierbares Label-Feld fuer Item-Titel in Karten- und Listenansicht
- Dirty-State inkl. Warnung beim Verlassen der Seite
- Reset auf Import-Snapshot
- Export der bearbeiteten Daten als neue JSON- oder CSV-Datei
- Bildvorschau fuer `scan`-URLs inkl. Lightbox und Fullscreen
- App-weites Wording ueber Handles + Sprachumschalter (DE/EN)
- Minimale User-Config-GUI pro Datenfeld mit Anwenden
- Session-persistente User-Config (via `sessionStorage`)
- Session-persistenter Datenmodus JSON/CSV (via `sessionStorage`)
- Optionaler Timestamp im Export-Dateinamen
- Keyboard-Shortcuts mit `Escape` (Start-From-Scratch-Modal und Lightbox schliessen / Sidebar-Auswahl aufheben)
- Tab-Navigation mit vier Bereichen (`Editieren`, `Konfiguration`, `Ersetzungen`, `Info`)
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
- `src/components/ViewerWikidataField.vue` - Viewer-spezifischer Wrapper fuer den Feldtyp `wikidata-autosuggest`
- `src/components/WikidataAutosuggestInput.vue` - generische Autosuggest-Eingabe (erhaelt Konfiguration als pass-through)
- `src/components/config/AutosuggestFieldConfig.vue` - GUI-Editor fuer autosuggest-spezifische Feldoptionen in der Konfigurationsansicht
- `src/composables/useWikidataSearch.js` - Suche ueber Wikidata API inkl. Priorisierungslogik und Claim-Metadaten
- `src/composables/useWikidataSearch.test.js` - Unit-Tests fuer resiliente Wikidata-Suche (Teilausfaelle/Abort)
- `src/fields/fieldRegistry.js` - zentrale Feldtyp-Registry inkl. Field-Contract (Rendering, Defaults, Value-Mapping)
- `src/components/ListPanel.vue` - Kartenliste inkl. optional getrenntem Kopf-/Body-Rendering fuer sticky Header
- `src/components/StartFromScratchModal.vue` - Modal fuer den "Neu beginnen"-Flow
- `src/composables/useFieldMapping.js` - Mapping-Helpers fuer Feldlabel/Placeholder/Hint/Sortierung und Binding zur Feld-Registry
- `src/composables/useViewerData.js` - Datenmodell, Validierung, Such-/Edit-Logik
- `src/composables/useDataImportExport.js` - Import/Export-Flow inkl. Dateimodus-Validierung und Download-Ausleitung
- `src/composables/useSelectionNavigation.js` - Auswahlindex-Berechnung und Vor/Zurueck-Navigation
- `src/composables/useModalKeyboard.js` - gemeinsames Escape-Keyboard-Handling fuer Modals
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

- `type`: `normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`
- `label`: alternative Feldbeschriftung
- `placeholder`: Platzhaltertext im Eingabefeld
- `hint`: zusaetzlicher Hinweistext unter dem Eingabefeld (Ausfuellhinweis)
- `readOnly` (nicht fuer `wikidata-autosuggest`): Feld ist in der Sidebar sichtbar, aber nicht editierbar
- Reihenfolge via Drag-and-Drop
- globales `itemLabelField`: Feldschluessel fuer Item-Label in Liste/Karten (optional, sonst Fallback)

Fuer `wikidata-autosuggest` zusaetzlich:

- GUI-Editierung aller `autosuggest`-Optionen in einem einklappbaren `Optionen`-Bereich
  - Basisoptionen (`searchLanguages`, `resultLanguage`, `minChars`, `limit`)
  - `prefillWith`: Dropdown auf ein `normal`-Feld; dessen String-Wert wird als Suchtext vorbefuellt
  - Priorisierungsbloecke `claimPresence` und `claimValueMatch` inkl. `weight`, `defs`, `includeInEmitData`, `showInSuggestion`
  - `claimPresence.defs` als Repeater mit `{ propertyId, propertyLabel }` (Legacy-String-Defs bleiben lesbar)
  - `claimValueMatch.defs` als Repeater mit `{ property, value, label }`
- Unknown Nested Keys bleiben erhalten, sofern sie nicht durch GUI-Control-Felder explizit geaendert werden

Zusaetzlich:

- neue Felder koennen manuell angelegt werden
- vorhandene Felder koennen aus der Konfiguration entfernt werden

Verhalten:

- `Konfiguration anwenden` uebernimmt die aktuelle Konfiguration in die Darstellung der Sidebar-Felder.
- Nach `Konfiguration anwenden` werden geoeffnete `Optionen`-Bereiche von `wikidata-autosuggest` wieder eingeklappt.
- Bei bereits vorkonfigurierten `wikidata-autosuggest` Feldern startet der `Optionen`-Bereich eingeklappt; bei neu angelegten Feldern ausgeklappt.
- Falls beim Anwenden der Konfiguration der Datenmodus auf `CSV` steht, schaltet die App automatisch auf `JSON` um.
- Das konkrete Feld-Rendering wird ueber die Registry aufgeloest (statt ueber Bedingungen in `ItemFieldEditor.vue`).
- Entfernte Felder werden beim Anwenden auch aus den geladenen Datensaetzen entfernt.
- Hinzugefuegte Felder werden beim Anwenden in allen Datensaetzen initialisiert (`''`, `false` oder `[]` je nach Feldtyp).
- Konfigurationszustand (`fields`, `appliedFields`) wird unter `viewerEditor.userConfig.v1` in `sessionStorage` gespeichert.
- Konfigurationszustand umfasst auch `itemLabelField`/`appliedItemLabelField`.

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
- `replacements` (Store): `src/stores/useReplacementsStore.js` speichert und exportiert `replacements`
- `replacementsSnapshot` (Store): Snapshot der importierten `replacements` fuer Change-Tracking
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
   - falls vorhanden: `replacements` ist Objekt
4. Bei Erfolg initialisiert `initializeFromJsonArray` die Datenstates, uebernimmt optionale `config` in `importedConfig` und uebergibt `replacements` an den Replacements-Store.
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
- Signifikante Leerzeichen in Feldwerten bleiben erhalten:
  - kein zeilenweites `trim()` vor dem CSV-Parsing
  - nur BOM am Dateianfang sowie ein trailing `\r` bei CRLF-Zeilenenden werden entfernt
  - gilt fuer unquoted und quoted Werte gleichermassen
- Das Feld `scan` wird bei Header-Normalisierung explizit auf `scan` gesetzt (case-insensitive), damit die bestehende Scan-UI automatisch greift.

## Suche

- `toSearchText(item)` kombiniert alle Feldwerte als lowercase String.
- `tokenize(query)` normalisiert und splittet die Suchanfrage.
- Filter: Ein Datensatz matcht nur, wenn **alle** Tokens enthalten sind.

Beispiel:

- Query `"oak berlin"` liefert nur Items, deren `_searchText` sowohl `oak` als auch `berlin` enthaelt.

## Bearbeitungslogik

`updateField(key, nextRawValue, configuredType?)` bearbeitet einfache Typen sowie strukturierte Registry-Typen:

- Die konkrete Normalisierung laeuft ueber den Registry-Hook `normalizeUpdatedFieldValue(...)`.
- Verhalten:
  - `integer` (Registry-Typ, seit Refactor 2026-07-06): Coercion wird durch den **konfigurierten Typ** ausgeloest, nicht durch `typeof currentValue`. String-Input wird via `Number(...)` geparst; nicht-ganzzahlige Werte (`"1.5"`, `"abc"`, `NaN`, `Infinity`, Booleans) werden mit `ok: false` abgelehnt und der vorige Wert bleibt erhalten. Leere Eingaben (`''`, whitespace, `null`, `undefined`) werden auf `null` normalisiert (kanonische "kein Integer"-Darstellung).
  - `boolean`: Wert wird auf `Boolean(...)` normalisiert
  - `null` (Legacy-Pfad ohne `configuredType`): leerer String wird wieder `null`, sonst String
  - `number` (Legacy-Pfad ohne `configuredType`): String-Input wird mit `Number(...)` geparst; nicht-endliche Werte werden verworfen
- `string`: direkte Uebernahme
- `wikidata-autosuggest`: Wert wird auf ein dedupliziertes Entity-Array normalisiert

Konfigurations-Anwendung (`normalizeValueForConfiguredType`) fuer `integer` ist best-effort statt strikt: Floats werden via `Math.trunc` abgeschnitten, un-parsebare Strings/Booleans/`NaN`/`Infinity` fallen auf `null` zurueck. Rationale: Bulk-Apply hat keine interaktive Wiederholung, silent recovery ist besser als Datenverlust ueber das Unvermeidliche hinaus. Der Default-Wert fuer neu hinzugefuegte Integer-Felder ist `null`.

Nach erfolgreicher Aenderung:

- Feldwert in `rawItems` wird aktualisiert
- `_searchText` wird fuer das Item neu berechnet
- `isDirty` wird auf `true` gesetzt

Nicht editierbare komplexe Werte (Objekte/Arrays) werden in der UI als JSON in `<pre>` angezeigt.

## Sidebar Field Editor Modularization

- `ItemFieldEditor.vue` kapselt das Rendering der Datenfelder in der Sidebar.
- `src/fields/fieldRegistry.js` ist der einzige Registrierungsort fuer Feldtypen (`normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`).
- Jeder Feldtyp implementiert denselben Contract:
  - `createEditorBinding(...)` fuer UI-Bindings (`component`, Props, Event, Event-Value-Mapping)
  - `createDefaultValue()` fuer neu hinzugefuegte Felder
  - `normalizeValueForConfigApply(...)` fuer Konfigurations-Anwendung auf bestehende Daten
- Der Feldtyp `wikidata-autosuggest` rendert ueber `ViewerWikidataField.vue` und speichert immer ein Array von Entity-Objekten mit stabiler `id`.
- Der Wrapper reicht `field.autosuggest` unveraendert an `WikidataAutosuggestInput.vue` weiter; die Viewer-Core-Logik interpretiert keine autosuggest-spezifischen Schluessel.
- Die Priorisierung wird in `useWikidataSearch.js` ausgefuehrt: Ergebnisse werden nach `score` sortiert (Tie-Break: originale Wikidata-Reihenfolge).
- Bei aktivierten Flags koennen selektierte Entities zusaetzlich `ranking` und gefilterte `prioritizationValues` enthalten.
- `useFieldMapping.js` liefert weiterhin Label-/Sortier-Mapping und delegiert Feld-Rendering an die Registry.
- `App.vue` orchestriert nur noch die Feld-Update-Events und reicht sie an `useViewerData` weiter.

## Wikidata Autosuggest Priorisierung

- Suchbasis: `wbsearchentities` je Sprache aus `autosuggest.searchLanguages`.
- Request-Strategie: Multilanguage-Calls nutzen `Promise.allSettled` statt `Promise.all`; erfolgreiche Teilantworten werden zusammengefuehrt.
- Fehlerverhalten: Falls nur einzelne Sprachrequests fehlschlagen, liefert die Suche weiterhin Treffer aus den verbleibenden Sprachen; Rejections werden nur in DEV geloggt.
- Deduplizierung: Merge nach Entity-`id`.
- Falls `autosuggest.prioritize` konfiguriert ist, werden benoetigte Claims per `wbgetentities` nachgeladen.
- Claim-Nachladen ist ebenfalls teilrobust (`Promise.allSettled` ueber Chunk-Requests), damit einzelne Chunk-Fehler nicht die gesamte Ergebnisliste blockieren.
- Unterstuetzte Regelbloecke:
  - `claimPresence`: Match, wenn mindestens eine Property aus `defs` vorhanden ist (`defs` unterstuetzt Legacy-Strings und Objekte mit `propertyId`).
  - `claimValueMatch`: Match, wenn mindestens ein `{ property, value }`-Paar aus `defs` zutrifft (`label` ist rein darstellungsbezogen).
- Scoring: Summe der Block-`weight`-Werte (je Block maximal einmal pro Entity).
- Sortierung: `score` absteigend, dann originale Result-Reihenfolge.
- `showInSuggestion`: zeigt priorisierungsbezogene Metadaten in der Trefferliste.
- Bei gesetzten Def-Labels werden Metadaten als `Label (PropertyId): ...` angezeigt (statt nur `PropertyId: ...`) in Trefferliste und selektierten Ergebnissen.
- `includeInEmitData`: behaelt priorisierungsbezogene Metadaten (`ranking`, `prioritizationValues`) im selektierten Entity-Payload.
- `prefillWith`: wenn konfiguriert, wird beim Wechsel auf ein Item der Wert des referenzierten `normal`-Felds automatisch in die Autosuggest-Suche uebernommen; die Suche startet sofort.
- Stale-Protection: `WikidataAutosuggestInput.vue` verwaltet pro Query einen `AbortController`; bei neuer Eingabe oder Unmount werden laufende Requests abgebrochen.
- UX bei Abort: Abgebrochene Requests erzeugen keine Fehleranzeige im UI und kein Error-Logging.

### Neues Feld hinzufuegen

1. In `src/fields/fieldRegistry.js` einen neuen Feldtyp mit Contract-Funktionen ergaenzen.
2. Der Feldtyp steht danach automatisch in der Config-Auswahl und in der Config-Validierung zur Verfuegung.
3. Optionales feldspezifisches Verhalten fuer Config-Apply oder Edit-Normalisierung ebenfalls im Registry-Eintrag definieren.

## UI-Architektur (`App.vue`)

Die Seite ist in mehrere Bereiche gegliedert:

- Oberhalb des Inhalts: sticky Tab-Leiste fuer `Editieren` und `Info` inkl. Tastatursteuerung (Left/Right/Home/End/Enter/Space)
- Topbar (Titel + Transfer-Controls) steht oberhalb der Tabs und bleibt damit immer sichtbar
- Im Edit-Tab: sticky Header-Stack mit Konfiguration und Listenkopf (`Digitalisate` + Suche)
- Upload/Download-Buttons behalten feste Breiten je Aktionstyp, damit beim Moduswechsel kein Layout-Springen entsteht.
- Toolbar: Dateiname-Hinweis und Dirty-Hinweis
- Liste: Kartenansicht der gefilterten Items inkl. Scan-Vorschau; ohne `scan` automatische Umschaltung auf textbasierte Listenansicht
- Sidebar: Felder des selektierten Items und groessere Scan-Vorschau (desktop sticky mit internem Scroll)
- Erweiterter Edit-Modus: Sidebar kann auf volle Inhaltsbreite umgeschaltet werden (eigener Expand/Collapse-Button mit SVG-Icons)
- Statusbereich: Datei-/Fehlerstatus
- Footer im Statusbereich: Identity-Links (GitHub, Berlin University Collections)
- Replacements-Tab: gruppierte Tabellen je Feld, nur Felder mit Eintraegen; Eingabe im Edit-Panel mit Feld-Dropdown inkl. `alle Felder`

Zusatzfunktionen:

- Lightbox fuer `scan`-Bild mit Fullscreen-Umschaltung
- Fallback-UI bei Bildladefehlern (Liste, Sidebar, Lightbox)
- `beforeunload`-Warnung bei `isDirty` oder nicht angewendeten User-Config-Aenderungen
- `Escape` schliesst Start-From-Scratch-Modal und Lightbox; bei offener Sidebar hebt `Escape` die aktuelle Auswahl auf

Interne Script-Aufteilung:

- `useSelectionNavigation.js` kapselt `selectedFilteredIndex`, `canGoPrevious`, `canGoNext` sowie die Aktionen fuer vorheriges/naechstes Item und Selektion aufheben.
- `useDataImportExport.js` kapselt Dateityp-Mismatch-Checks, Datei-Importpfad (`csv/json`), optionales Anwenden eingebetteter JSON-Config sowie Download/Reset-Handler.
- `App.vue` bleibt damit der Composition-Root und konzentriert sich auf Verdrahtung von Komponenten, Stores, Watchern und Lifecycle-Events.

## Export und Reset

- `createExportPayload()` liefert eine tiefe Kopie von `rawItems`.
- JSON-Export schreibt immer das kanonische Format `{ data: <items>, config: <user-config>, replacements: <replacements> }` und nutzt die Store-Daten.
- CSV-Export schreibt nur Nutzdaten (ohne Config, ohne `replacements`).
- Vor jedem Download (JSON und CSV) wird eine noch nicht angewendete User-Config automatisch auf `rawItems` angewendet, damit Exportdaten und Konfigurationsstand nicht auseinanderlaufen.
- Download wird in `useDataImportExport.js` ueber eine zentrale Helper-Funktion (`triggerBrowserDownload`) mit `Blob` + temporaerem Link ausgelagert.
- Dateiname: `<importName>-edited.<json|csv>` bzw. `data-edited.<json|csv>`.
- Falls aktiviert: Dateiname mit Timestamp im Format `<importName>-edited-YYYY-MM-DD_hh-mm-ss.<json|csv>`.
- Reset nutzt `importSnapshot` und stellt den Zustand des letzten gueltigen Imports wieder her.
- Download-Button wird aktiviert, wenn entweder Daten oder `replacements` gegen den Snapshot abweichen.
- Reset stellt ebenfalls die `replacements` auf den Snapshot zurueck.

## Styling und Responsiveness

Die Styles sind in Layer aufgeteilt (`src/assets/styles/index.scss`):

- `tokens/_index.scss`: zentrale Farb-/Spacing-/Typo-Tokens
- `base/_index.scss`: Basiselemente, Fokuszustand, globaler Hintergrund
- `layout/_index.scss`: Grid-Layout und Responsive-Regeln
- `legacy.scss`: temporaerer Migrations-Layer fuer globale Alt-Styles
- Wichtige interaktive Controls uebersteuern `button:hover` lokal (z. B. Tabs, Datenmodus-Switch, Transfer-Buttons, Listenkarten), damit Hover-Farben konsistent mit Primary/Secondary bleiben.
- Placeholder in Inputs/Textareas werden global heller gerendert, damit Platzhalter visuell klarer von echten Feldwerten getrennt sind.

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
  - Parse-Export-Parse-Roundtrip erhaelt signifikante Leerzeichen in quoted/unquoted Werten
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

Tests in `src/composables/useWikidataSearch.test.js` pruefen:

- resilientes Merge-Verhalten bei Ausfall einer Suchsprache
- `AbortError`-Pfad fuer aktiv abgebrochene Requests ohne zusaetzliches Warning-Logging

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
