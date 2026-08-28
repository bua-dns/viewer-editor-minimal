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
- Strukturierter Feldtyp `candidate` fuer Vorschlagswerte mit konfigurierbarer Ziel-Feld-Uebernahme
- Konfigurierbare Priorisierung fuer `wikidata-autosuggest` (`claimPresence`, `claimValueMatch`)
- Automatischer Listenmodus ohne Bildkacheln, wenn keine `scan`-Spalte vorhanden ist
- Konfigurierbares Label-Feld fuer Item-Titel in Karten- und Listenansicht
- Checkbox `suspendEditing` direkt in der grauen Item-Leiste (Karten- und Listenansicht), Text vor Checkbox-Icon
- Checkbox `suspendEditing` wird nicht angezeigt, wenn ein Item bereits als bearbeitet markiert ist (Edit-Icon sichtbar)
- Sortierregel in der Liste: `suspendEditing=true` ans Listenende, aber vor Eintraegen die wegen Mark-as-edited ans Ende sortiert werden
- Suspend-Status wird nicht in die Item-Objekte geschrieben, sondern separat als Index-Array `suspendedItems` verwaltet
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
- Tab-Navigation mit fuenf Bereichen (`Editieren`, `Konfiguration`, `Ersetzungen`, `Einstellungen`, `Info`)
- Tab `Einstellungen` fuer runtime-konfigurierbare Strapi-Connection-Profile **und** editierbare App-Settings (beides mit localStorage + JSON Import/Export)
- Online/Offline-App-Modus mit Strapi-Login (FE-Users), persistenter Session und automatischem Session-Restore
- Online-Modus laedt Konfiguration aus `response.data.settings` und Items aus `settings.itemsPath` (Legacy-Fallback: `item_path`) inklusive Pagination
- Lokale Datei-Transfer-Controls (JSON/CSV Upload, Beispieldaten, lokaler Download) sind im Online-Modus deaktiviert/ausgeblendet
- Online-Login erfolgt ueber ein Modal (oeffnet per `Anmelden`) mit Icon-Toggle fuer Passwortsichtbarkeit (Eye/Eye-off SVG)
- Online-Bearbeitungen werden feldgenau als Delta gegen einen Snapshot getrackt und gezielt nach Strapi gespeichert
- Online-Modus erlaubt das Anlegen neuer Items als lokale Entwuerfe (Button im Listenkopf), die beim Speichern per `POST <itemsPath>` in Strapi erstellt werden
- Online-Speicher-UX mit Status `idle | saving | success | error`, Unsaved-Counter und Retry bei Teilfehlern
- Interne Strapi-Metadaten (`__onlineMeta`) bleiben aus Editor-, Mapping- und Config-Oberflaechen ausgeblendet
- Desktop-Sticky-Layout: Tabs + Edit-Header bleiben beim Scrollen sichtbar; Sidebar bleibt separat sticky
- Optionaler Dev-Inspektionsmodus ueber `config/app.config.js:dataInspectionMode` zeigt im Sidebar-Editor eine Raw-Data-Preview (`<pre>`) mit `show/hide raw data` und `Copy raw data`

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
- `src/components/footer/Identity.vue` - Footer-Identity mit externen Projektlinks; Text und ARIA-Labels aus dem zentralen Wording
- `src/components/ConfigurationPanel.vue` - Wrapper fuer den Konfigurations-Tab; rendert `UserConfigPanel` fest geoeffnet
- `src/components/ReplacementsPanel.vue` - Tab-Panel fuer Replacement-Tabellen je Feld
- `src/components/ReplacementsUnit.vue` - Inline-Replacements-Editor in der Sidebar
- `src/components/UserConfigPanel.vue` - ausgelagerte User-Config-Oberflaeche
- `src/components/DataTransferControls.vue` - ausgelagerte Upload/Download-Oberflaeche
- `src/components/ItemFieldEditor.vue` - ausgelagerte Sidebar-Feldeditor-Oberflaeche inkl. optionaler Raw-Data-Dev-Preview (Toggle + Copy)
- `src/components/LightboxModal.vue` - Modal fuer Scan-Vollansicht inkl. Fullscreen-Unterstuetzung
- `src/components/ViewerWikidataField.vue` - Viewer-spezifischer Wrapper fuer den Feldtyp `wikidata-autosuggest`
- `src/components/WikidataAutosuggestInput.vue` - generische Autosuggest-Eingabe (erhaelt Konfiguration als pass-through)
- `src/components/config/AutosuggestFieldConfig.vue` - GUI-Editor fuer autosuggest-spezifische Feldoptionen in der Konfigurationsansicht
- `src/composables/useWikidataSearch.js` - Suche ueber Wikidata API inkl. Priorisierungslogik, Claim-Metadaten und lokalisierter Labels/Descriptions (`de`/`en`)
- `src/composables/useWikidataSearch.test.js` - Unit-Tests fuer resiliente Wikidata-Suche (Teilausfaelle/Abort)
- `src/fields/fieldRegistry.js` - zentrale Feldtyp-Registry inkl. Field-Contract (Rendering, Defaults, Value-Mapping)
- `src/components/ListPanel.vue` - Listen-/Kartenpanel inkl. optional getrenntem Kopf-/Body-Rendering, Hierarchie-UI (Level-1-Boxen + einklappbare Level-2-Gruppen) und Create-Button im Online-Modus
- `src/components/StartFromScratchModal.vue` - Modal fuer den "Neu beginnen"-Flow
- `src/components/DatabaseConnectionPanel.vue` - GUI fuer den Settings-Tab: Strapi-Verbindungsprofil (Base URL, Config-Pfad, Speichern, Test, JSON Import/Export) plus editierbare App-Settings
- `src/components/OnlineAccessPanel.vue` - Umschalter Offline/Online inkl. Login/Logout und Status fuer Auth/Online-Settings/Online-Items
- `src/composables/useFieldMapping.js` - Mapping-Helpers fuer Feldlabel/Placeholder/Hint/Sortierung und Binding zur Feld-Registry
- `src/composables/useViewerData.js` - Datenmodell, Validierung, Such-/Edit-Logik
- `src/composables/useDataImportExport.js` - Import/Export-Flow inkl. Dateimodus-Validierung und Download-Ausleitung
- `src/composables/useSelectionNavigation.js` - Auswahlindex-Berechnung und Vor/Zurueck-Navigation
- `src/composables/useModalKeyboard.js` - gemeinsames Escape-Keyboard-Handling fuer Modals
- `src/composables/useViewerData.test.js` - Unit-Tests fuer Helpers und Kern-Flow
- `src/composables/userConfigValidation.test.js` - Unit-Tests fuer JSON-Config-Validierung
- `src/stores/useAppConfigStore.js` - globaler App-Config-Store (Sprache, Wording-Aufloesung, Primary Color, `dataInspectionMode`)
- `src/stores/useUserConfigStore.js` - User-Config-Store (State, Session, Add/Remove, Reorder, Apply)
- `src/stores/useDataTransferStore.js` - Data-Transfer-Store (Modus, Session, Dateinamenlogik)
- `src/stores/useConnectionProfileStore.js` - Store fuer persistentes Connection-Profil (`localStorage`) inkl. Import/Export und Endpoint-Tests
- `src/stores/useOnlineModeStore.js` - App-Modus-Store (`offline`/`online`, Persistenz in `localStorage`)
- `src/stores/useAuthStore.js` - Auth-Store fuer Strapi FE-User (JWT Login/Logout/Restore via `localStorage`)
- `src/stores/useOnlineSettingsStore.js` - Laden von Online-Konfiguration aus Strapi (`response.data.settings`)
- `src/stores/useOnlineUpdatesStore.js` - Delta-Tracking fuer Online-Aenderungen inkl. Draft-Create-Tracking (`pendingCreatesById`), sequenziellem Save-Orchestrator (Creates vor Updates) und Save-Status
- `src/composables/connectionProfile.js` - Validator/Normalizer fuer Connection-Profile + URL-Join-Helper
- `src/stores/useOnlineItemsStore.js` - Laden von Online-Items aus `settings.itemsPath` (inkl. Sanitizing fuer Editor-Modell)
- `src/services/strapiApi.js` - zentraler Strapi-HTTP-Zugriff fuer Login, `/users/me`, Settings-Fetch, paginiertes Item-Fetching sowie feldbasierte Item-Creates/Updates inkl. Payload-Filter fuer nicht-leere Werte
- `src/composables/userConfigValidation.js` - zentraler Validator fuer importierte JSON-Config
- `src/assets/styles/index.scss` - globaler Styling-Einstieg (Tokens, Base, Layout, Komponenten-Layer)
- `src/assets/texts/info-de.md` / `src/assets/texts/info-en.md` - editierbare Markdown-Inhalte fuer den Info-Tab
- `config/app.config.js` - App-Konfiguration (Default-Sprache, Primary Color, Wording-Handles)
- `config/wording.json` - uebersetzte Textvarianten je Handle
- `vite.config.js` - Vite-Konfiguration mit Vue-Plugin

## App-Konfiguration und Wording

- `config/app.config.js` definiert die app-weiten Handles (z. B. `title`, `itemLabel`) und Basiswerte wie `language` und `primaryColor`.
- `config/app.config.js` steuert zusaetzlich den Online/Offline-Zugriff ueber `connectionMode` mit den Werten `switchable | offline | online`.
  - `switchable`: UI zeigt den Umschalter `Offline | Online`.
  - `offline`: kein Umschalter, App-Modus fest auf `offline`.
  - `online`: kein Umschalter, App-Modus fest auf `online`.
- `config/app.config.js` steuert zusaetzlich den optionalen Dev-Inspektionsmodus ueber `dataInspectionMode` (`true | false`).
  - `true`: Im Edit-Sidebar-Panel werden unterhalb der Feldliste die Buttons `show/hide raw data` und `Copy raw data` angezeigt.
  - `false`: Keine zusaetzlichen Raw-Data-Controls in der Sidebar.
- `config/app.config.js` kann optional ein Default-Verbindungsprofil ueber `defaultConnectionProfile` setzen.
  - Wertebeispiel: `viewer-editor-connection-profile.v1.json` (Datei in `public/connection-profile/`).
  - Beim App-Start laedt `App.vue` das Profil ueber `useConnectionProfileStore.loadConnectionProfileFromDefault(...)` und schreibt es bei Erfolg in `localStorage` (`viewerEditor.connectionProfile.v1`).
  - Die URL-Aufloesung fuer relative Werte ist robust gegen unterschiedliche Deploy-Pfade: es werden mehrere Kandidaten aus `window.location.pathname`, `import.meta.env.BASE_URL` und Root (`/`) gebildet (u. a. mit und ohne `connection-profile/`-Prefix).
- `config/wording.json` enthaelt die Sprachvarianten pro Handle (`de`, `en`).
- Online-Create-Texte sind ebenfalls ueber Handles abgedeckt (u. a. `onlineCreateItem`, `onlineNewItemFallback`) und werden in Listenkopf/Fallback-Label verwendet.
- `src/stores/useAppConfigStore.js` loest Handles gegen die aktuell aktive Sprache auf und stellt die Werte als `computed` bereit.
- `src/stores/useAppConfigStore.js` verwaltet zusaetzlich editierbare App-Settings in `localStorage` (`viewerEditor.appConfig.v1`) inkl. JSON Import/Export sowie Runtime-Updates fuer `primaryColor`, `connectionMode`, `language`, `languageMode`, `githubRepo`, `dataInspectionMode`, `defaultConnectionProfile`.
- Sprachwechsel passiert in `App.vue` per einfachem `DE | EN`-Schalter in der Topbar.
- Tab-Beschriftungen (`Editieren`/`Info`/`Einstellungen`) sowie Footer-Credit und zugehoerige ARIA-Labels werden ebenfalls ueber Wording-Handles lokalisiert.
- Die Keys `tabDatabaseConnection` und `dbConnectionOpenTab` werden bewusst **nicht** von Online-Wording ueberschrieben, damit die lokale Tab-Benennung `Einstellungen` stabil bleibt.

## User-Config-GUI (minimal)

Die User-Config ist modularisiert:

- `UserConfigPanel.vue` kapselt die GUI.
- `useUserConfigStore.js` kapselt den zugehoerigen State und die Aktionen.
- `App.vue` orchestriert nur noch (Apply, Datenmodus-Wechsel, Datenfluss).

Die User-Config wird im eigenen Tab `Konfiguration` gerendert und dort dauerhaft geoeffnet angezeigt.
Standardfall: Der Tab ist nach Daten-Import nutzbar. Im Online-Modus kann die Konfiguration zusaetzlich auch ohne geladene Items bearbeitet werden, sobald gueltige Online-Settings geladen sind (`Configuration only`).

Pro erkanntem Feld (ohne reservierte Felder wie `scan` und `suspendEditing`) kann gesetzt werden:

- `type`: `normal`, `text`, `integer`, `checkbox`, `candidate`, `wikidata-autosuggest`
- `label`: alternative Feldbeschriftung
- `placeholder`: Platzhaltertext im Eingabefeld
- `hint`: zusaetzlicher Hinweistext unter dem Eingabefeld (Ausfuellhinweis)
- `fieldWidth`: Layoutbreite pro Feld im Sidebar-Editor (`33%`, `50%`, `100%` fuer 3/2/1 Felder pro Zeile)
- `readOnly` (nicht fuer `wikidata-autosuggest`): Feld ist in der Sidebar sichtbar, aber nicht editierbar
- Reihenfolge via Drag-and-Drop
- globales `itemLabelField`: Feldschluessel fuer Item-Label in Liste/Karten (optional, sonst Fallback)
- globale Checkbox `showOnlyNonEmptyFields`: blendet in der Sidebar pro Item alle leeren Felder aus (`''`, `null`, `undefined`, `[]`, `{}`)
- globale Hierarchie-Konfiguration direkt in der GUI:
  - `hierarchyFields`: frei editierbare Liste von Feldschluesseln fuer die Hierarchie
  - `firstLevelStaticList`: Preset-Liste fuer Level-1-Werte (newline/komma-getrennte Eingabe)

Fuer `wikidata-autosuggest` zusaetzlich:

- GUI-Editierung aller `autosuggest`-Optionen in einem einklappbaren `Optionen`-Bereich
  - Basisoptionen (`searchLanguages`, `resultLanguage`, `minChars`, `limit`)
  - `prefillWith`: Dropdown auf ein `normal`-Feld; dessen String-Wert wird als Suchtext vorbefuellt
  - `alsoGetDataFrom`: Repeater fuer optionale Wikidata-Properties als Objekte `{ propertyId, label }`; pro Eintrag werden rohe Statement-Daten beim Auswaehlen einer Entity zusaetzlich gespeichert (Legacy-String bleibt lesbar)
  - Priorisierungsbloecke `claimPresence` und `claimValueMatch` inkl. `weight`, `defs`, `includeInEmitData`, `showInSuggestion`
  - `claimPresence.defs` als Repeater mit `{ propertyId, propertyLabel }` (Legacy-String-Defs bleiben lesbar)
  - `claimValueMatch.defs` als Repeater mit `{ property, value, label }`
- Unknown Nested Keys bleiben erhalten, sofern sie nicht durch GUI-Control-Felder explizit geaendert werden

Fuer `candidate` zusaetzlich:

- `candidate.targetField` (Pflicht): Dropdown auf vorhandene Felder ausser sich selbst und ausser `candidate`
- `candidate.inputType`: `normal` (einzeilig, Default) oder `text` (mehrzeilig)
- Candidate-Validierung blockiert `Konfiguration anwenden`, falls mindestens ein Candidate-Feld kein gueltiges Ziel hat
- In der Sidebar rendert `candidate` ein Inline-Editor+Button-Layout
- Der Uebernahme-Button ist nur aktiv, wenn ein gueltiges Ziel gesetzt ist und der Candidate-Wert nicht leer/whitespace ist
- Uebernahme behaelt den Candidate-Wert im Candidate-Feld unveraendert
- Zieltyp `wikidata-autosuggest`: Candidate-Wert wird als Prefill gesetzt und die Suche per Force-Token unmittelbar gestartet (ohne Auto-Selektion)

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
- Konfigurationszustand umfasst auch `itemLabelField`/`appliedItemLabelField`, `markAsEditedBasis`/`appliedMarkAsEditedBasis` sowie `showOnlyNonEmptyFields`/`appliedShowOnlyNonEmptyFields`.

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
- `suspendedItemIndices`: Array mit Item-Indizes (`number[]`), die in der Liste als `suspendEditing` markiert sind
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
- Im App-Modus `online` werden lokale Transfer-Aktionen im Header unterdrueckt, damit kein lokaler Import/Export parallel zum Strapi-Datenfluss erfolgt.

## Online-Modus und Strapi-Integration

- Der App-Modus wird in `src/stores/useOnlineModeStore.js` verwaltet (`offline`/`online`) und in `localStorage` persistiert.
- `connectionMode` aus `config/app.config.js` kann diesen App-Modus fixieren (`offline` oder `online`); in diesem Fall wird kein Moduswechsel in der UI angeboten.
- Login/Logout fuer Strapi FE-Users laeuft ueber `src/stores/useAuthStore.js` + `src/services/strapiApi.js` (JWT + Session-Restore beim App-Start).
- Das Verbindungsprofil (Base URL, Auth-/Settings-Endpoint) kommt aus `src/stores/useConnectionProfileStore.js`; die GUI liegt in `src/components/DatabaseConnectionPanel.vue`.
- Der Settings-Tab (`src/components/DatabaseConnectionPanel.vue`) umfasst neben dem Verbindungsprofil auch App-Settings; diese sind im Store `useAppConfigStore` persistiert/importierbar/exportierbar.
- Der Online-Initialisierungsfluss in `App.vue` ist strikt sequenziell:
  1. Settings laden (`response.data.settings`)
  2. `itemsPath` aus Settings lesen (Legacy-Fallback: `item_path`)
  3. Hierarchie-Strategie bestimmen:
     - Mit Hierarchie (`hierarchyFields`/Legacy-Fallbacks) und **ohne** `firstLevelStaticList`: Level-1-Werte aus Strapi laden (keine Voll-Item-Ladung beim Start)
     - Mit Hierarchie und **mit** `firstLevelStaticList`: Level-1-Boxen direkt aus Settings rendern (ohne Strapi-Item- oder Bucket-Fetch beim Start)
     - Ohne Hierarchie: Items paginiert aus Strapi laden (`pagination[page]`, `pagination[pageSize]`)
  4. Falls Items geladen wurden: Items fuer das Editor-Modell sanitizen und als Viewer-Daten initialisieren
  5. geladene Settings-Config auf den Datenbestand anwenden
- `firstLevelStaticList` akzeptiert ein Array fuer feste Level-1-Kategorien; Werte werden getrimmt, leere Eintraege entfernt und dedupliziert (Reihenfolge bleibt erhalten).
- In Hierarchie + `firstLevelStaticList` werden Items erst beim Klick auf eine Level-1-Box geladen.
- Hierarchie-Parsing ist robust gegen mehrere Settings-Formen (u. a. `hierarchyFields`, `hierarchy_fields`, nested Varianten); wenn keine explizite Hierarchie konfiguriert ist, greift ein Fallback auf Auto-Erkennung (`level_1`, `level_2`) im Datenmodell.
- Die Level-1-Boxen werden im Hierarchie-Modus sofort gerendert (auch dann, wenn noch keine Item-Karten geladen sind).
- Wenn `response.data.settings` nicht als gueltige Config interpretierbar ist, wechselt die UI in einen expliziten Fehlerzustand (kein stilles Weiterlaufen mit inkonsistentem Stand).
- `src/components/OnlineAccessPanel.vue` zeigt Auth-, Settings- und Item-Status inkl. Save-Controls (`Save changes`), Unsaved-Counter, Save-Feedback und Retry-Aktion.
- Wenn kein Verbindungsprofil verfuegbar ist, zeigt `src/components/OnlineAccessPanel.vue` zusaetzlich eine technische Diagnose (`reason`, `profileUrl`, `attempted`) aus `useConnectionProfileStore.lastConnectionProfileLoadError`; dadurch sind 404-/Pfadprobleme beim Default-Profil direkt in der UI sichtbar.
- Optionaler Header-Toggle `Configuration only` (Store: `useOnlineModeStore`) laedt beim Online-Start nur `response.data.settings`; Item-Requests werden dabei vollstaendig uebersprungen.
- In `Configuration only` bleibt die Settings-Initialisierung verbindlich: Die aus Strapi geladenen Settings werden trotz leerer Item-Liste in den User-Config-State uebernommen und im Konfigurations-Tab angezeigt.
- Erfolgs-Feedback des Speicherns wird nach kurzem Timeout automatisch ausgeblendet; alle Texte der Save-UX (Button-States, Fehler/Retry) sind als Wording-Handles in `config/wording.json` hinterlegt.
- Authentifiziert zeigt der Header im Online-Modus nur den Button `Abmelden` (kein zusaetzliches User-Label); nicht notwendige Erfolgsmeldungen/Transfer-Hinweise wurden entfernt.
- Bei Fehlschlag des Default-Profil-Ladens loggt `App.vue` einmalig `Default connection profile load failed:` in der Browser-Konsole inklusive Fehlerobjekt.

### Online-Login-Modal

- Im Online-Modus startet der Login ueber ein Modal, das per `Anmelden` geoeffnet wird.
- Inputs `Identifier` und `Passwort` haben vereinheitlichte Feldgroessen und nutzen denselben globalen Input-Basissatz.
- Die Passwortsichtbarkeit wird ueber Icon-Buttons (Eye/Eye-off SVG) umgeschaltet.
- Das Modal schliesst bei Backdrop-Klick, Moduswechsel und nach erfolgreicher Authentifizierung automatisch.

### Online-Update-Flow (Strapi)

- `src/services/strapiApi.js` normalisiert Online-Items robust (`normalizeStrapiItem`) fuer beide Formen: flache Zeilen und `{ id, attributes }`.
- Stabile Identifikation nutzt primaer `documentId` (Strapi v5), mit Fallback auf `id`; fehlende stabile IDs fuehren beim Ingest zu einem harten Fehler.
- Pro Item werden interne Metadaten unter `__onlineMeta` gehalten (nicht Teil der sichtbaren Edit-Felder).
- Aenderungen werden als Feld-Deltas gegen einen Snapshot verfolgt; Rueckgaengigmachen auf Ursprungswert entfernt die Delta-Aenderung wieder.
- Speichern laeuft sequenziell ueber `updateCollectionItemInStrapi(...)` als `PUT <itemsPath>/<documentId>` mit Payload `{ data: changedFields }`; die Payload wird dabei ueber `buildStrapiUpdatePayload(...)` aus den getrackten Feld-Deltas gebaut.
- Bei Vollerfolg synchronisiert `markAsSaved(...)` die Baseline; bei Teilfehlern bleibt ein konsistenter Retry-faehiger Pending-Stand erhalten.
- `useDataImportExport.js` meldet explizit zurueck, ob ein Reset tatsaechlich ausgefuehrt wurde; nur dann raeumt `App.vue` ausstehende Online-Updates ab.

### Online-Create-Flow (Neues Item)

- Im Online-Modus zeigt der Listenkopf fuer authentifizierte Nutzer einen Button `Neues Item` / `New item` (optimistisch sichtbar, Backend-Fehler werden im Save-Feedback angezeigt).
- Klick legt einen lokalen Entwurf an (`appendOnlineDraftItem` in `useViewerData`): gleiche Feld-Schluessel wie die geladenen Items, initialisiert mit Registry-Defaults je konfiguriertem Feldtyp (`''`, `null`, `false`, `[]`), optional `scan: ''`, plus `__onlineMeta: { isDraft: true, draftId, itemsPath }`.
- Der Entwurf wird sofort selektiert, zaehlt ab Anlage im Unsaved-Counter mit und nutzt die allgemeine Listen-Sortierlogik; ohne eigenen Titel erscheint das Fallback-Label `Neues Objekt` / `New item`.
- Der Entwurf unterstuetzt `suspendEditing` wie regulaere Items; die bestehende Listen-Sortierung/Anzeige fuer suspendierte Eintraege bleibt konsistent.
- Feldaenderungen am Entwurf werden in `pendingCreatesById` (`useOnlineUpdatesStore`) getrackt; `showOnlyNonEmptyFields` blendet leere Entwurfs-Felder nicht aus.
- Beim Speichern laufen Creates sequenziell vor den Updates: `POST <itemsPath>` mit `{ data: <nur nicht-leere Felder> }` (`createCollectionItemInStrapi`, Nicht-leer-Regel wie `hasNonEmptyValue`; `false` gilt als Wert).
- Bei Erfolg erhaelt das Item die vom Server gelieferte `documentId` (Fallback `id`) in `__onlineMeta`; nachfolgende Edits laufen als reguläres PUT-Delta. Bei Vollerfolg uebernimmt `markAsSaved` den Baseline-Sync, bei Teilfehlern synchronisiert `syncSnapshotItemAtIndex` gezielt die bereits erstellten Items.
- Bei Fehlern bleibt der Entwurf als pending Create bestehen (Retry-faehig); Fehlermeldungen erscheinen im bestehenden Save-Status (`error`) des Online-Panels.
- Ein Reset vor dem Speichern verwirft nicht gespeicherte Entwuerfe samt Pending-Eintraegen.

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
- `suspendEditing` wird in der Sidebar nicht als normales Datenfeld gerendert, sondern als Checkbox im Sidebar-Header (neben dem Close-Button).
- Optional (nur bei `dataInspectionMode=true`) rendert `ItemFieldEditor.vue` am Ende der Feldliste eine JSON-Preview des aktuell selektierten Rohobjekts sowie einen Copy-Button fuer die Zwischenablage.
- `src/fields/fieldRegistry.js` ist der einzige Registrierungsort fuer Feldtypen (`normal`, `text`, `integer`, `checkbox`, `candidate`, `wikidata-autosuggest`).
- Jeder Feldtyp implementiert denselben Contract:
  - `createEditorBinding(...)` fuer UI-Bindings (`component`, Props, Event, Event-Value-Mapping)
  - `createDefaultValue()` fuer neu hinzugefuegte Felder
  - `normalizeValueForConfigApply(...)` fuer Konfigurations-Anwendung auf bestehende Daten
- Der Feldtyp `wikidata-autosuggest` rendert ueber `ViewerWikidataField.vue` und speichert immer ein Array von Entity-Objekten mit stabiler `id`.
- Der Feldtyp `candidate` rendert je nach `candidate.inputType` als `input` oder `textarea`; die Uebernahme ins Ziel-Feld laeuft ueber denselben `updateField(...)`-Pfad wie manuelle Edits (inkl. Zieltyp-Normalisierung).
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
- `showInSuggestion`: wenn aktiviert, bleiben die dazugehoerigen priorisierungsbezogenen Werte ebenfalls im selektierten Entity-Payload erhalten (damit angezeigte Metadaten wie GeoNames auch im Raw-Data-Export sichtbar bleiben).
- Wenn `prioritizationValues.P1566` vorhanden ist, wird zusaetzlich `geoNames` als String-Array in die selektierte Entity geschrieben (lesbarer Shortcut fuer GeoNames-IDs im Raw-Data-Payload).
- Selektierte Entities enthalten zusaetzlich lokalisierte Begriffe unter `labels` und `descriptions` als Sprachmaps (mindestens `de` und `en`), z. B. `labels.de`, `labels.en`, `descriptions.de`, `descriptions.en`.
- Datenquelle fuer lokalisierte Begriffe: sprachspezifischer Merge aus `wbsearchentities`; beim Auswaehlen wird zusaetzlich `wbgetentities` mit `props=labels|descriptions` und `languages=de|en` verwendet, damit die Werte stabil im Export-Payload landen.
- `prefillWith`: wenn konfiguriert, wird beim Wechsel auf ein Item der Wert des referenzierten `normal`-Felds automatisch in die Autosuggest-Eingabe uebernommen; die Suche startet dabei nur automatisch, wenn noch keine Entity im Feld selektiert ist.
- `alsoGetDataFrom`: wenn konfiguriert (ein oder mehrere `P...`-Eintraege), laedt die Auswahl-Logik beim Hinzufuegen einer Entity die rohen Statements fuer jede Property nach und speichert sie unter `statementData[PROPERTY_ID]` im Entity-Payload.
- Bereits ausgewaehlte Entities werden in der Suggestion-Liste ausgefiltert (Anzeige nur in der selektierten Entity-Liste unterhalb des Inputs).
- Die Suggestion-Liste ist auf `6rem` Hoehe begrenzt und nutzt vertikales Scrollen.
- Wenn `statementData` vorhanden ist, zeigt die selektierte Entity-Liste einen Toggle (`Show/Hide statement data`) und rendert die rohen Daten als formatierten JSON-Block (`<pre>`).
- Stale-Protection: `WikidataAutosuggestInput.vue` verwaltet pro Query einen `AbortController`; bei neuer Eingabe oder Unmount werden laufende Requests abgebrochen.
- UX bei Abort: Abgebrochene Requests erzeugen keine Fehleranzeige im UI und kein Error-Logging.

### Neues Feld hinzufuegen

1. In `src/fields/fieldRegistry.js` einen neuen Feldtyp mit Contract-Funktionen ergaenzen.
2. Der Feldtyp steht danach automatisch in der Config-Auswahl und in der Config-Validierung zur Verfuegung.
3. Optionales feldspezifisches Verhalten fuer Config-Apply oder Edit-Normalisierung ebenfalls im Registry-Eintrag definieren.

## UI-Architektur (`App.vue`)

Die Seite ist in mehrere Bereiche gegliedert:

- Oberhalb des Inhalts: sticky Tab-Leiste fuer `Editieren`, `Konfiguration`, `Ersetzungen`, `Einstellungen`, `Info` inkl. Tastatursteuerung (Left/Right/Home/End/Enter/Space)
- Topbar (Titel + Transfer-Controls) steht oberhalb der Tabs und bleibt damit immer sichtbar
- Header-Controls sind so ausgerichtet, dass sie bei ausreichend Platz in einem einzigen horizontalen Fluss stehen
- Im Edit-Tab: sticky Header-Stack mit Listenkopf (`Digitalisate` + Suche)
- Im Edit-Tab mit konfigurierter Hierarchie: zuerst Level-1-Boxen, danach einklappbare Level-2-Gruppen mit jeweils eigener Item-Liste
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
- Im Online-Modus verhindert `App.vue` zusaetzlich, dass lokale Feld-Auto-Initialisierung die aus Strapi geladenen Settings ueberschreibt.

## Export und Reset

- `createExportPayload()` liefert eine tiefe Kopie von `rawItems`.
- JSON-Export schreibt immer das kanonische Format `{ data: <items>, config: <user-config>, replacements: <replacements>, suspendedItems: <number[]> }` und nutzt die Store-Daten.
- CSV-Export schreibt nur Nutzdaten (ohne Config, ohne `replacements`).
- Beim JSON-Import ist `suspendedItems` optional; falls vorhanden, wird es als Array von Item-Indizes gelesen.
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
- Das globale Input-Basestyling umfasst explizit auch `input[type='password']`, damit Passwort- und Textfelder konsistent aussehen.

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
- Kartenlayout fuer Item-Vorschau (`auto-fill`, `minmax(300px, 1fr)`) 
- Lightbox mit dunklem Overlay

Hinweis:

- Die Karten-Mindestbreite ist bereits auf `300px` reduziert, um horizontalen Druck in kleineren Viewports zu verringern.

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
- Candidate-Regeln (`candidate.targetField` Pflicht, keine Targets auf Candidate-Felder, `candidate.inputType` nur `normal|text`)

Tests in `src/stores/useUserConfigStore.test.js` pruefen:

- Initialisierung minimaler Candidate-Konfiguration beim Typwechsel
- Validierung/Aktualisierung von Candidate-Target und `inputType`
- Abwehr ungueltiger Targets (insb. Target auf Candidate-Feld)

Tests in `src/composables/useFieldMapping.test.js` pruefen:

- Candidate-gesteuertes Prefill/Force-Search fuer `wikidata-autosuggest` Bindings

Tests in `src/composables/useWikidataSearch.test.js` pruefen:

- resilientes Merge-Verhalten bei Ausfall einer Suchsprache
- `AbortError`-Pfad fuer aktiv abgebrochene Requests ohne zusaetzliches Warning-Logging
- Priorisierungsfall `claimPresence` mit Objekt-Defs (`{ propertyId, propertyLabel }`)
- Nachladen roher Statement-Daten je Entity/Property
- Nachladen lokalisierter Labels/Descriptions (`de`/`en`) via `wbgetentities`

Tests in `src/stores/useOnlineUpdatesStore.test.js` pruefen:

- Delta-Tracking und Revert-Verhalten fuer bestehende Items
- Fehlerbehandlung bei Teilfehlern im Save-Orchestrator
- Draft-Create-Tracking inkl. POST-Payload (nur nicht-leere Felder), documentId-Uebernahme und Retry-faehigem Fehlerpfad

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
- Editierbar sind Registry-unterstuetzte Feldtypen; unbekannte komplexe Strukturen bleiben als Rohdaten sichtbar und werden nicht automatisch semantisch aufbereitet.
- Deep Clone via JSON-Serialize unterstuetzt keine Spezialtypen.
- Bildvorschau basiert auf URL-Pattern und prueft keine Erreichbarkeit vor dem Laden.

## Erweiterungspunkte

Typische naechste Schritte fuer eine produktive Weiterentwicklung:

- Schema-basierte Feldvalidierung (z. B. pro Key-Regeln)
- Undo/Redo statt nur globalem Reset
- Persistente Sessions (Local Storage)
- Virtuelles Scrolling/Pagination fuer grosse Datensaetze
- Feinere i18n/Locale-Unterstuetzung
