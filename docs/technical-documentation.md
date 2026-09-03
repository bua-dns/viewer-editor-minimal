# Technical Documentation

> **Referenzstand:** verifiziert am 2026-08-31 gegen Commit `9f9ae8e` (`main`).
> Bei Abweichungen zwischen diesem Dokument und dem Code gilt der Code.
> Dieses Dokument ist die maßgebliche Implementierungs-/Architekturreferenz;
> `README.md` ist die kurze Einstiegs- und Setup-Beschreibung.

## Inhalt

1. [Projektüberblick](#1-projektüberblick)
2. [Tech Stack und lokale Entwicklung](#2-tech-stack-und-lokale-entwicklung)
3. [Projektstruktur](#3-projektstruktur)
4. [App-Konfiguration und Wording](#4-app-konfiguration-und-wording)
5. [Browser-Persistenz](#5-browser-persistenz)
6. [Datenmodell, Suche und Sortierung](#6-datenmodell-suche-und-sortierung)
7. [User-Config (Tab `Konfiguration`)](#7-user-config-tab-konfiguration)
8. [Feldtypen-Registry und Bearbeitungslogik](#8-feldtypen-registry-und-bearbeitungslogik)
9. [Import, Validierung und Parsing](#9-import-validierung-und-parsing)
10. [Export und Reset](#10-export-und-reset)
11. [Ersetzungen (Replacements)](#11-ersetzungen-replacements)
12. [Online-Modus und Strapi-Integration](#12-online-modus-und-strapi-integration)
13. [Wikidata-Autosuggest](#13-wikidata-autosuggest)
14. [UI-Architektur (`App.vue`)](#14-ui-architektur-appvue)
15. [Styling und Responsiveness](#15-styling-und-responsiveness)
16. [Testabdeckung](#16-testabdeckung)
17. [Bekannte Grenzen](#17-bekannte-grenzen)
18. [Erweiterungspunkte](#18-erweiterungspunkte)

---

## 1 Projektüberblick

`viewer-editor-minimal-version` ist eine Vue-3-Einzelansicht zum Sichten, Filtern, Bearbeiten und
Exportieren tabellarischer Datensätze. Die App arbeitet wahlweise rein lokal (JSON/CSV-Datei) oder
online gegen eine Strapi-Instanz.

Kernfunktionen:

- Lokales Bearbeiten von JSON- und CSV-Daten inkl. Validierung, Reset auf Import-Snapshot und Export
- Online-Betrieb gegen Strapi: Login (FE-Users), Laden von Konfiguration und Items, feldgenaues Speichern
- Anlegen neuer Items im Online-Modus (lokaler Entwurf, Persistenz per `POST` beim Speichern)
- Hierarchische Navigation (Level-1-Boxen, einklappbare Level-2-Gruppen) mit bedarfsgesteuertem Nachladen
- Konfigurierbare Feldtypen über eine zentrale Registry (`normal`, `text`, `integer`, `checkbox`,
  `candidate`, `wikidata-autosuggest`)
- Wikidata-Autosuggest inkl. Priorisierung, Statement-Nachladen und mehrsprachigen Labels
- User-Config-GUI pro Datenfeld (Typ, Label, Placeholder, Hint, Breite, Reihenfolge, Read-only)
- Volltextsuche über alle Feldwerte sowie Sortiersteuerung über Bearbeitungsstand und `suspendEditing`
- Ersetzungslisten je Feld (werden gesammelt und exportiert, siehe [Kapitel 11](#11-ersetzungen-replacements))
- Bildvorschau für `scan`-URLs inkl. Lightbox und Fullscreen; automatischer Listenmodus ohne `scan`-Spalte
- Lokalisierung über Wording-Handles (DE/EN) mit optionaler Überschreibung aus dem Backend
- Runtime-editierbare App-Settings und Strapi-Verbindungsprofile im Tab `Einstellungen`
- Responsives Editor-Layout mit sticky Kopfbereich, Sidebar-Editor und erweitertem Vollbreiten-Modus

---

## 2 Tech Stack und lokale Entwicklung

- Framework: Vue 3 (`script setup`, Composition API), ohne externe State-Bibliothek
  (Stores sind Module mit Modul-globalen `ref`s)
- Build Tool: Vite 6
- Tests: Vitest 2
- Styling: Sass (SCSS)
- Info-Tab-Rendering: `markdown-it` + `highlight.js`
- Sprache: JavaScript (ESM)
- Deployment Base Path: `/viewer-editor-strapi/` (`base` in `vite.config.js`; früher genutzte Pfade
  stehen dort auskommentiert)

### Paketmanager und Skripte

Im Repository liegt ausschließlich `pnpm-lock.yaml` (kein `package-lock.json`), d. h. der Lockfile-Stand
wird mit **pnpm** gepflegt. Ein `packageManager`-Feld in `package.json` existiert nicht.

```bash
pnpm install
pnpm dev        # Vite Dev-Server
pnpm build      # Produktionsbuild
pnpm preview    # Build lokal serven
pnpm test       # vitest run
```

Die Skriptnamen sind identisch für `npm run ...`; ein `npm install` erzeugt allerdings ein
konkurrierendes `package-lock.json` und sollte deshalb vermieden werden.

---

## 3 Projektstruktur

### Root und Konfiguration

- `index.html` - Einstiegspunkt mit Mount-Node `#app`
- `vite.config.js` - Vite-Konfiguration (Vue-Plugin, `base`)
- `package.json` / `pnpm-lock.yaml` - Abhängigkeiten und Skripte
- `config/app.config.js` - App-Defaults (Sprache, Sprachmodus, GitHub-Repo, Primärfarbe,
  `connectionMode`, `dataInspectionMode`, `defaultConnectionProfile`) und Import des Wordings
- `config/wording.json` - **maßgebliche** Sprachvarianten je Wording-Handle (aktuell 238 Handles)
- `config/wording.js` - **Legacy/unbenutzt.** Die Datei wird von keinem Modul importiert
  (`app.config.js` importiert `wording.json`) und ist eine unvollständige Teilmenge von
  `wording.json` (215 Handles, keine eigenen Schlüssel). Änderungen dort haben keine Wirkung;
  die Datei kann entfernt werden.
- `docs/` - `technical-documentation.md` (dieses Dokument), `conventions.md`, `changelog.md`

### Einstieg

- `src/main.js` - Bootstrapping (`createApp(App).mount('#app')`)
- `src/App.vue` - Composition-Root: verdrahtet Komponenten, Stores, Composables, Watcher und Lifecycle

### Komponenten (`src/components/`)

- `ListPanel.vue` - Karten-/Listenpanel inkl. trennbarem Kopf-/Body-Rendering, Hierarchie-UI
  (Level-1-Boxen, einklappbare Level-2-Gruppen), Suspend-Checkbox, Edit-Icon und Create-Button
- `ItemFieldEditor.vue` - Sidebar-Feldeditor; rendert Felder über die Registry und optional die
  Raw-Data-Dev-Preview
- `UserConfigPanel.vue` - User-Config-GUI (Feldliste, globale Optionen, Anwenden)
- `ConfigurationPanel.vue` - dünner Wrapper, der `UserConfigPanel` im Tab fest geöffnet rendert
- `config/AutosuggestFieldConfig.vue` - GUI-Editor für autosuggest-spezifische Feldoptionen
- `ViewerWikidataField.vue` - Viewer-Wrapper für den Feldtyp `wikidata-autosuggest`
- `WikidataAutosuggestInput.vue` - generische Autosuggest-Eingabe (Konfiguration als Pass-through)
- `DataTransferControls.vue` - Upload/Download/Reset/Datenmodus/Beispieldaten im Header
- `DatabaseConnectionPanel.vue` - Tab `Einstellungen`: Verbindungsprofil, Verbindungstest,
  Datenmodell-Prüfung sowie editierbare App-Settings (jeweils mit JSON Import/Export)
- `OnlineAccessPanel.vue` - Offline/Online-Umschalter, Login/Logout, Status- und Save-Controls
- `ReplacementsPanel.vue` - Tab-Panel mit Ersetzungstabellen je Feld
- `ReplacementsUnit.vue` - Inline-Eingabe für neue Ersetzungen in der Sidebar
- `LightboxModal.vue` - Modal für die Scan-Vollansicht inkl. Fullscreen
- `StartFromScratchModal.vue` - Modal für den "Neu beginnen"-Flow
- `InfoPanel.vue` - rendert den Info-Tab aus den sprachspezifischen Markdown-Quellen
- `footer/Identity.vue` - Footer-Identity mit Projektlinks (GitHub-Link nur bei gesetztem `githubRepo`)

### Composables (`src/composables/`)

- `useViewerData.js` - Datenmodell, Import/Parsing, Validierung, Suche, Sortierung, Edit-Logik
- `useDataImportExport.js` - Datei-Import/Export-Flow, Beispieldaten, Start-from-Scratch, Reset
- `useFieldMapping.js` - Label-/Placeholder-/Hint-/Sortier-Mapping und Binding an die Feld-Registry
- `useSelectionNavigation.js` - Auswahlindex, Vor/Zurück-Navigation, Auswahl aufheben
- `useModalKeyboard.js` - gemeinsames Escape-Handling für Modals
- `useWikidataSearch.js` - Wikidata-Suche inkl. Priorisierung, Claim-/Statement-Nachladen, Lokalisierung
- `userConfigValidation.js` - zentraler Validator für importierte bzw. geladene JSON-Config
- `connectionProfile.js` - Validator/Normalizer für Verbindungsprofile + URL-Join-Helper

### Stores (`src/stores/`)

- `useAppConfigStore.js` - App-Config (Sprache, Wording-Auflösung inkl. Backend-Merge, Primärfarbe,
  `languageMode`, `githubRepo`, `connectionMode`, `dataInspectionMode`, `defaultConnectionProfile`)
  sowie Persistenz/Import/Export der editierbaren App-Settings
- `useUserConfigStore.js` - User-Config-State und Aktionen (Add/Remove, Reorder, Apply, Session)
- `useDataTransferStore.js` - Datenmodus (JSON/CSV), Session-Persistenz, Dateinamenslogik
- `useReplacementsStore.js` - Ersetzungslisten inkl. Snapshot, Change-Tracking und Export-Payload
- `useConnectionProfileStore.js` - persistentes Verbindungsprofil, Default-Profil-Laden,
  Verbindungstest, Datenmodell-Prüfung, JSON Import/Export
- `useOnlineModeStore.js` - App-Modus (`offline`/`online`) und `Configuration only`-Schalter
- `useAuthStore.js` - Strapi-FE-User-Auth (Login/Logout/Session-Restore)
- `useOnlineSettingsStore.js` - Laden **und Zurückschreiben** der Online-Settings inkl. Backend-Wording
- `useOnlineItemsStore.js` - Laden der Online-Items: Hierarchie-Erkennung, Level-1-Optionen
  (aus Strapi oder `firstLevelStaticList`), gefiltertes Nachladen je Level-1-Wert, Sanitizing
- `useOnlineUpdatesStore.js` - Delta-Tracking für Updates und Draft-Creates, Save-Orchestrator, Save-Status

### Feldtypen (`src/fields/`)

- `fieldRegistry.js` - zentrale Registry und Field-Contract (Rendering, Defaults, Value-Mapping)
- `wikidataAutosuggestField.js` - Registry-Eintrag und Wertnormalisierung für `wikidata-autosuggest`

### Services (`src/services/`)

- `strapiApi.js` - gesamter Strapi-HTTP-Zugriff: Login, `/api/users/me`, Settings lesen/schreiben,
  Query-Aufbau (Pagination/Populate/Fields/Filter), paginiertes Item-Fetching, Item-Create/Update,
  Item- und Wikidata-Normalisierung, Datenmodell-Prüfung

### Assets (`src/assets/`)

- `styles/index.scss` - globaler Styling-Einstieg; Layer `tokens/`, `base/`, `layout/`, `components/`,
  `legacy.scss`
- `styles/components/_index.scss` - Ausnahme-Layer für notwendige globale Sonderfälle
- `texts/info-de.md`, `texts/info-en.md` - Markdown-Quellen für den Info-Tab
- `icons/` - SVG-Icons für Editor-Controls (`arrow-down`, `edit-3`, `eye`, `eye-off`,
  `maximize-2`, `minimize-2`)
- `logos/` - Logos für den Footer (`dns-v1.svg`, `Octicons-mark-github.svg`)

### Statische Dateien (`public/`)

- `sample-data.json`, `sample-data.csv` - Beispieldaten je Datenmodus
- `sample-card-1.jpg` … `sample-card-3.jpg` - Beispielscans für die Kartenansicht
- `connection-profile/viewer-editor-connection-profile.v1.json` - optionales Default-Verbindungsprofil

### Tests

Alle Tests liegen neben ihrem Modul (`*.test.js`); Inhalte siehe [Kapitel 16](#16-testabdeckung).

---

## 4 App-Konfiguration und Wording

### 4.1 Konfigurationsquellen und Präzedenz

Es gibt drei Ebenen, die sich in genau dieser Reihenfolge überlagern:

1. **Build-Defaults** aus `config/app.config.js`.
2. **Lokal gespeicherte App-Settings** aus `localStorage` (`viewerEditor.appConfig.v1`), gepflegt im
   Tab `Einstellungen`.
3. **Online-Settings aus Strapi** - betreffen *nicht* die App-Settings aus (1)/(2), sondern die
   User-Config (Felder, Hierarchie, Labels) und optional das Wording.

Wichtig für die Wartung: `useAppConfigStore.js` lädt beim Modul-Import einmalig
`loadEditableAppConfigFromStorage()`. Existiert ein gespeicherter Eintrag, **gewinnt dieser
vollständig** über `config/app.config.js`. Eine Änderung an `app.config.js` wirkt sich also bei
Nutzern, die bereits einmal im Tab `Einstellungen` gespeichert haben, **nicht** aus, solange sie die
App-Settings nicht zurücksetzen (`clearEditableAppConfig`, entfernt den localStorage-Eintrag und
fällt auf die Build-Defaults zurück). Ohne gespeicherten Eintrag gelten die Werte aus
`app.config.js` unverändert.

Alle Werte werden beim Laden normalisiert (`normalizeAppConfigInput`), unbekannte oder ungültige
Eingaben fallen auf definierte Defaults zurück. Gespeicherte Snapshots tragen `version: 1` und
`updatedAt`; `hasSavedEditableAppConfig` unterscheidet "gespeichert" von "Default".

### 4.2 Schlüssel in `config/app.config.js`

| Schlüssel | Werte | Wirkung |
| --- | --- | --- |
| `language` | Sprachcode, Default `de` | Startsprache für die Wording-Auflösung |
| `languageMode` | `single` \| `multi` (Default bei ungültigem Wert: `multi`) | Steuert `showLanguageSwitch`. Nur bei `multi` erscheint der `DE \| EN`-Umschalter in der Topbar; bei `single` ist die Sprache fix und der Umschalter fehlt vollständig. |
| `githubRepo` | URL oder Leerstring | Ziel des GitHub-Links im Footer (`footer/Identity.vue`). Bei leerem/fehlendem Wert wird das GitHub-Icon **nicht gerendert** (`v-if="githubRepoUrl"`). |
| `primaryColor` | CSS-Farbe, Fallback `#0066CC` | Wird beim Start und bei Änderung als `--color-primary` auf `document.documentElement` gesetzt und überschreibt damit den Token-Default (siehe [Kapitel 15](#15-styling-und-responsiveness)). |
| `connectionMode` | `switchable` \| `offline` \| `online` (Fallback `switchable`) | `switchable` zeigt den Umschalter `Offline \| Online`; `offline`/`online` fixieren den App-Modus ohne Umschalter. |
| `dataInspectionMode` | `true` \| `false` | `true` blendet im Sidebar-Editor unter der Feldliste `show/hide raw data` und `Copy raw data` ein. |
| `defaultConnectionProfile` | Dateiname oder Leerstring | Dateiname eines Profils in `public/connection-profile/`, das beim App-Start geladen wird (siehe [12.1](#121-verbindungsprofil)). Leer = nur localStorage-Verhalten. |
| `wording` | Import aus `config/wording.json` | Basis-Wording-Dictionary |

Alle Schlüssel außer `wording` sind zur Laufzeit im Tab `Einstellungen` editierbar und werden dort
gespeichert, importiert und exportiert.

### 4.3 Wording, Backend-Merge und Sprachen

- `config/wording.json` enthält pro Handle eine Sprachmap, z. B. `{ "tabEdit": { "de": ..., "en": ... } }`.
- `t(key, fallback)` löst gegen die aktive Sprache auf; Fallback-Kette:
  aktive Sprache → `de` → `en` → übergebener Fallback.
- Online-Settings können ein eigenes Wording mitliefern (`response.data.wording`). Nach erfolgreichem
  Settings-Load ruft `App.vue` `setOnlineWording(result.wording)` auf; beim Verlassen des Online-Modus
  bzw. bei fehlgeschlagenem Load wird `clearOnlineWording()` aufgerufen.
- **Merge-Regel** (`mergedWording` in `useAppConfigStore.js`): Basis ist das lokale Wording; Backend-Einträge
  werden **je Handle sprachweise darüber** gemischt (`{ ...localEntry, ...backendEntry }`). Ein Backend-Handle,
  das nur `en` liefert, ersetzt also nur `en` und lässt `de` lokal bestehen. Reine Backend-Handles ohne
  lokale Entsprechung werden übernommen.
- **Geschützte Handles:** `tabDatabaseConnection` und `dbConnectionOpenTab` sind in
  `localWordingOverrideKeys` gelistet und werden vom Backend-Wording **nie** überschrieben, damit die
  Tab-Benennung `Einstellungen` / `Settings` stabil bleibt.
- `supportedLanguages` wird dynamisch aus allen Sprachschlüsseln des gemergten Wordings abgeleitet;
  ist das Dictionary leer, enthält die Liste nur die aktive Sprache.

---

## 5 Browser-Persistenz

Alle Schlüssel sind mit `viewerEditor.` präfixiert und versioniert. Zugriffe auf `localStorage`
sind gegen nicht verfügbaren Storage abgesichert.

| Schlüssel | Storage | Owner | Inhalt | Restore | Löschen/Ersetzen |
| --- | --- | --- | --- | --- | --- |
| `viewerEditor.appConfig.v1` | localStorage | `useAppConfigStore` | Snapshot der editierbaren App-Settings (`version`, alle Schlüssel aus [4.2](#42-schlüssel-in-configappconfigjs), `updatedAt`) | beim Modul-Import (App-Start) | `clearEditableAppConfig()` im Tab `Einstellungen`; JSON-Import überschreibt |
| `viewerEditor.connectionProfile.v1` | localStorage | `useConnectionProfileStore` | Verbindungsprofil (`version`, `label`, `baseUrl`, `configPath`, `updatedAt`) | beim App-Start; wird bei gesetztem `defaultConnectionProfile` ggf. durch das geladene Default-Profil überschrieben | `clearConnectionProfile()`; Speichern/Import ersetzt |
| `viewerEditor.authToken.v1` | localStorage | `useAuthStore` | Strapi-JWT | `restoreSession()` beim App-Start (holt anschließend `/api/users/me`) | Logout und fehlgeschlagener Restore entfernen den Token |
| `viewerEditor.appMode.v1` | localStorage | `useOnlineModeStore` | App-Modus `offline` \| `online` | beim App-Start; ein fixierter `connectionMode` hat Vorrang | Moduswechsel schreibt neu |
| `viewerEditor.onlineConfigOnly.v1` | localStorage | `useOnlineModeStore` | Schalter `Configuration only` | beim App-Start | Toggle im Header schreibt neu |
| `viewerEditor.userConfig.v1` | **sessionStorage** | `useUserConfigStore` | `fields`/`appliedFields`, `itemLabelField`/`appliedItemLabelField`, `markAsEditedBasis`/`appliedMarkAsEditedBasis`, `showOnlyNonEmptyFields`/`appliedShowOnlyNonEmptyFields` | beim Start der Session | `clearUserConfigSession()` bei jedem Datei-Import, Beispieldaten-Load und Start-from-Scratch |
| `viewerEditor.dataMode.v1` | **sessionStorage** | `useDataTransferStore` | aktiver Datenmodus `json` \| `csv` | beim Start der Session | Moduswechsel schreibt neu |

Nicht persistiert werden Items, Ersetzungen, Auswahl und Dirty-State: sie leben nur im Speicher und
gehen beim Reload verloren.

---

## 6 Datenmodell, Suche und Sortierung

Die zentrale Logik liegt in `useViewerData()` (`src/composables/useViewerData.js`).

### 6.1 Reaktive States

- `rawItems` - aktuell bearbeitete Datensätze
- `viewItems` - abgeleitete Liste mit UI-Metadaten
  - `_uid` - stabile Identifikation in der UI
  - `_index` - Verweis auf den Index in `rawItems`
  - `_searchText` - normalisierter Suchtext je Datensatz
- `importSnapshot` - unveränderte Kopie des letzten gültigen Imports (Basis für Reset und Online-Delta)
- `suspendedItemIndices` - Array mit Item-Indizes (`number[]`), die als `suspendEditing` markiert sind;
  der Status wird bewusst **nicht** in die Item-Objekte geschrieben
- `selectedUid`, `searchQuery`, `isDirty`, `importFileName`
- `importedConfig` - optional eingebettete JSON-Config aus dem letzten JSON-Import
- `errorMessage` - Validierungs- oder Parse-Fehler

`replacements` und `replacementsSnapshot` liegen im `useReplacementsStore`
(siehe [Kapitel 11](#11-ersetzungen-replacements)).

### 6.2 Computed Values

- `hasData` - `rawItems.length > 0`
- `selectedViewItem` / `selectedRawItem` - aktueller UI-Eintrag bzw. das zugehörige Rohobjekt
- `filteredViewItems` - gefilterte **und sortierte** Liste (siehe unten)

### 6.3 Suche

- `toSearchText(item)` kombiniert alle Feldwerte zu einem lowercase String.
- `tokenize(query)` normalisiert und splittet die Suchanfrage.
- **Die Suche greift erst ab drei Zeichen** (`normalizedQuery.length > 2`); kürzere Eingaben filtern nicht.
- Ein Datensatz matcht nur, wenn **alle** Tokens in `_searchText` vorkommen (AND-Verknüpfung).
- Beispiel: `"oak berlin"` liefert nur Items, deren `_searchText` sowohl `oak` als auch `berlin` enthält.

### 6.4 Sortierung von `filteredViewItems`

Sortiert wird in drei Stufen:

1. **Prioritätsgruppe** aus Bearbeitungsstand und Suspend-Status:
   - Standard (`editedItemsFirst = false`): nicht bearbeitet (0) → `suspendEditing` (1) → bearbeitet (2).
     Bearbeitete Items stehen also am Ende, suspendierte davor.
   - Invertiert (`editedItemsFirst = true`, Toggle im Listenkopf): bearbeitet (0) → nicht bearbeitet (1)
     → `suspendEditing` (2).
2. **Label-Trefferpunktzahl** (absteigend): Wenn ein `itemLabelField` konfiguriert ist, zählt pro
   Suchtoken ein Punkt, wenn das Token im Labelwert vorkommt. Dadurch stehen Labeltreffer vor reinen
   Volltexttreffern, ohne die Suche auf das Label zu beschränken.
3. **Originalreihenfolge** (`orderIndex`) als stabiler Tie-Break.

"Bearbeitet" wird über `markAsEditedBasis` bestimmt (siehe [7.2](#72-globale-optionen)).

---

## 7 User-Config (Tab `Konfiguration`)

Die User-Config ist modularisiert: `UserConfigPanel.vue` kapselt die GUI, `useUserConfigStore.js` State
und Aktionen, `App.vue` orchestriert nur (Apply, Datenmodus-Wechsel, Datenfluss). Gerendert wird sie im
Tab `Konfiguration`, dort dauerhaft geöffnet.

Der Tab ist nach einem Daten-Import nutzbar. Im Online-Modus kann die Konfiguration zusätzlich ohne
geladene Items bearbeitet werden, sobald gültige Online-Settings vorliegen (`Configuration only`).

### 7.1 Optionen pro Feld

Reservierte Schlüssel (`scan`, `suspendEditing`, `__onlineMeta`) erscheinen nicht als konfigurierbare
Datenfelder. Pro erkanntem Feld konfigurierbar:

- `type`: `normal`, `text`, `integer`, `checkbox`, `candidate`, `wikidata-autosuggest`
- `label` - alternative Feldbeschriftung
- `placeholder` - Platzhaltertext im Eingabefeld
- `hint` - Hinweistext unter dem Eingabefeld
- `fieldWidth` - Layoutbreite im Sidebar-Editor (`33%`, `50%`, `100%` für 3/2/1 Felder pro Zeile;
  ungültige Werte fallen auf `100%` zurück)
- `readOnly` (nicht für `wikidata-autosuggest`) - sichtbar, aber nicht editierbar
- Reihenfolge per Drag-and-Drop

Zusätzlich können Felder manuell angelegt und wieder entfernt werden.

### 7.2 Globale Optionen

- `itemLabelField` - Feldschlüssel für das Item-Label in Karten-/Listenansicht (sonst Fallback);
  beeinflusst zusätzlich die Suchsortierung (siehe [6.4](#64-sortierung-von-filteredviewitems)).
- `markAsEditedBasis` - Feldschlüssel, dessen Inhalt den **Bearbeitungsstand** eines Items definiert:
  - Ein Item gilt als "bearbeitet", sobald dieses Feld einen nicht-leeren Wert hat
    (`hasNonEmptyValue`: `''`, `null`, `undefined`, `[]`, `{}` gelten als leer; `false` und `0` als Wert).
  - Bearbeitete Items zeigen in Karten- und Listenansicht ein Edit-Icon **anstelle** der
    `suspendEditing`-Checkbox; die Checkbox ist für bereits bearbeitete Items also nicht sichtbar.
  - Bearbeitete Items werden standardmäßig ans Listenende sortiert. Ist die Option gesetzt, blendet
    der Listenkopf zusätzlich den Umschalter "bearbeitete zuerst" (`editedItemsFirst`) ein, der die
    Prioritätsgruppen invertiert.
  - Leerer Wert = keine Sortierung nach Bearbeitungsstand; `editedItemsFirst` wird dann automatisch
    zurückgesetzt.
  - Der Validator verlangt einen String, der ein vorhandenes Feld in `config.fields` benennt.
- `showOnlyNonEmptyFields` - blendet in der Sidebar pro Item alle leeren Felder aus. Ausnahme:
  leere `wikidata-autosuggest`-Felder und Felder von Online-Entwürfen bleiben sichtbar, damit sie
  überhaupt befüllt werden können.
- `hierarchyFields` - frei editierbare Liste von Feldschlüsseln für die Hierarchie
- `firstLevelStaticList` - Preset-Liste für Level-1-Werte (newline-/kommagetrennte Eingabe)

### 7.3 Zusatzoptionen für `wikidata-autosuggest`

GUI-Editierung aller `autosuggest`-Optionen in einem einklappbaren `Optionen`-Bereich:

- Basisoptionen (`searchLanguages`, `resultLanguage`, `minChars`, `limit`)
- `prefillWith` - Dropdown auf ein `normal`-Feld; dessen String-Wert wird als Suchtext vorbefüllt
- `alsoGetDataFrom` - Repeater für Wikidata-Properties als Objekte `{ propertyId, label }`;
  Legacy-Strings bleiben lesbar
- Priorisierungsblöcke `claimPresence` und `claimValueMatch` inkl. `weight`, `defs`,
  `includeInEmitData`, `showInSuggestion`
- `claimPresence.defs` als Repeater `{ propertyId, propertyLabel }` (Legacy-String-Defs bleiben lesbar)
- `claimValueMatch.defs` als Repeater `{ property, value, label }`
- Unbekannte verschachtelte Schlüssel bleiben erhalten, sofern sie nicht explizit über ein
  GUI-Control geändert werden.

### 7.4 Zusatzoptionen für `candidate`

- `candidate.targetField` (Pflicht) - Dropdown auf vorhandene Felder außer sich selbst und außer
  weiteren `candidate`-Feldern
- `candidate.inputType` - `normal` (einzeilig, Default) oder `text` (mehrzeilig)
- Die Candidate-Validierung blockiert `Konfiguration anwenden`, falls ein Candidate-Feld kein
  gültiges Ziel hat.
- In der Sidebar rendert `candidate` ein Inline-Editor+Button-Layout. Der Übernahme-Button ist nur
  aktiv, wenn ein gültiges Ziel gesetzt und der Candidate-Wert nicht leer/whitespace ist.
- Die Übernahme lässt den Candidate-Wert unverändert stehen.
- Zieltyp `wikidata-autosuggest`: Der Wert wird als Prefill gesetzt und die Suche per Force-Token
  sofort gestartet (ohne Auto-Selektion).

### 7.5 `Konfiguration anwenden`

Lokale Wirkung (immer):

- Die aktuelle Konfiguration wird in die Darstellung der Sidebar-Felder übernommen
  (`fields` → `appliedFields`).
- Entfernte Felder werden auch aus den geladenen Datensätzen entfernt.
- Hinzugefügte Felder werden in allen Datensätzen mit dem Registry-Default initialisiert
  (`''`, `null`, `false` oder `[]` je Typ).
- Bestehende Werte werden über `normalizeValueForConfigApply(...)` an den konfigurierten Typ angepasst.
- Geöffnete `Optionen`-Bereiche von `wikidata-autosuggest` werden wieder eingeklappt. Bei bereits
  vorkonfigurierten Feldern startet der Bereich eingeklappt, bei neu angelegten ausgeklappt.
- Steht der Datenmodus auf `CSV`, schaltet die App automatisch auf `JSON` um.
- `isDirty` wird gesetzt, sofern Datensätze geladen sind.

**Zusätzliche Wirkung im Online-Modus:** Ist der App-Modus `online`, ein Nutzer authentifiziert und ein
Verbindungsprofil vorhanden, schreibt `onApplyUserConfig` die Konfiguration anschließend **in die
Strapi-Settings zurück**. Details siehe [12.7](#127-settings-write-back-konfiguration-anwenden-im-online-modus).
Offline bleibt `Konfiguration anwenden` eine rein lokale Operation.

---

## 8 Feldtypen-Registry und Bearbeitungslogik

### 8.1 Registry und Contract

- `src/fields/fieldRegistry.js` ist der **einzige** Registrierungsort für Feldtypen
  (`normal`, `text`, `integer`, `checkbox`, `candidate`, `wikidata-autosuggest`).
- Jeder Feldtyp implementiert denselben Contract:
  - `createEditorBinding(...)` für UI-Bindings (`component`, Props, Event, Event-Value-Mapping)
  - `createDefaultValue()` für neu hinzugefügte Felder
  - `normalizeValueForConfigApply(...)` für die Konfigurations-Anwendung auf bestehende Daten
  - optional `normalizeUpdatedFieldValue(...)` für die Edit-Normalisierung
- Unbekannte konfigurierte Typen fallen auf einen aus dem Wert abgeleiteten Editor-Typ zurück.
- `useFieldMapping.js` liefert Label-/Sortier-Mapping und delegiert das Feld-Rendering an die Registry;
  `App.vue` reicht nur die Feld-Update-Events an `useViewerData` weiter.

### 8.2 Sidebar-Feldeditor

- `ItemFieldEditor.vue` kapselt das Rendering der Datenfelder in der Sidebar.
- `suspendEditing` wird dort **nicht** als Datenfeld gerendert. Die Checkbox liegt im Sidebar-Header
  (gerendert in `App.vue`, `sidebar-suspend-toggle`, neben dem Close-Button); zusätzlich existiert je
  Item eine Checkbox in der grauen Item-Leiste der Karten-/Listenansicht (`ListPanel.vue`).
- `__onlineMeta` erscheint nie als editierbares Feld.
- Nur bei `dataInspectionMode = true` rendert `ItemFieldEditor.vue` am Ende der Feldliste eine
  JSON-Preview des selektierten Rohobjekts (`<pre>`) mit `show/hide raw data` und `Copy raw data`.
- `candidate` rendert je nach `candidate.inputType` als `input` oder `textarea`; die Übernahme läuft
  über denselben `updateField(...)`-Pfad wie manuelle Edits (inkl. Zieltyp-Normalisierung).
- `wikidata-autosuggest` rendert über `ViewerWikidataField.vue` und speichert immer ein Array von
  Entity-Objekten mit stabiler `id`. Der Wrapper reicht `field.autosuggest` unverändert an
  `WikidataAutosuggestInput.vue` weiter; die Viewer-Core-Logik interpretiert keine autosuggest-Schlüssel.

### 8.3 Wert-Normalisierung beim Editieren

`updateField(key, nextRawValue, configuredType?)` delegiert an den Registry-Hook
`normalizeUpdatedFieldValue(...)`:

- `integer`: Die Coercion wird durch den **konfigurierten Typ** ausgelöst, nicht durch
  `typeof currentValue`. String-Input wird via `Number(...)` geparst; nicht-ganzzahlige Werte
  (`"1.5"`, `"abc"`, `NaN`, `Infinity`, Booleans) werden mit `ok: false` abgelehnt, der vorige Wert
  bleibt erhalten. Leere Eingaben (`''`, whitespace, `null`, `undefined`) werden auf `null` normalisiert.
- `boolean`: `Boolean(...)`
- `string`: direkte Übernahme
- `wikidata-autosuggest`: Normalisierung auf ein dedupliziertes Entity-Array
- Legacy-Pfade ohne `configuredType`: `null` (leerer String wird wieder `null`) und
  `number` (String via `Number(...)`, nicht-endliche Werte werden verworfen)

Nach erfolgreicher Änderung wird der Wert in `rawItems` aktualisiert, `_searchText` für das Item neu
berechnet und `isDirty` gesetzt. Nicht editierbare komplexe Werte (Objekte/Arrays) werden als JSON in
`<pre>` angezeigt.

**Konfigurations-Anwendung** (`normalizeValueForConfigApply`) ist für `integer` bewusst best-effort
statt strikt: Floats werden via `Math.trunc` abgeschnitten, un-parsebare Strings/Booleans/`NaN`/`Infinity`
fallen auf `null` zurück. Rationale: Bulk-Apply hat keine interaktive Wiederholung, silent recovery ist
besser als Datenverlust über das Unvermeidliche hinaus. Default für neue Integer-Felder ist `null`.

### 8.4 Neuen Feldtyp hinzufügen

1. In `src/fields/fieldRegistry.js` einen neuen Feldtyp mit den Contract-Funktionen ergänzen.
2. Der Feldtyp steht danach automatisch in der Config-Auswahl und in der Config-Validierung zur Verfügung.
3. Optionales feldspezifisches Verhalten für Config-Apply oder Edit-Normalisierung ebenfalls im
   Registry-Eintrag definieren.

---

## 9 Import, Validierung und Parsing

Die Data-Transfer-Funktion ist modularisiert:

- `DataTransferControls.vue` kapselt die Header-Controls für Upload/Download/Reset/Modus.
- `useDataTransferStore.js` kapselt Datenmodus, Session-Persistenz und Dateinamenslogik.
- `useDataImportExport.js` kapselt Dateityp-Prüfung, Importpfad (`csv`/`json`), Beispieldaten,
  Start-from-Scratch, Download und Reset.
- Parsing/Serialisierung liegen in `useViewerData` und im User-Config-Store.
- `App.vue` orchestriert die Integrationspunkte und bindet die Handler in die UI ein.

### 9.1 Datenmodus im Header

- In der Topbar kann zwischen `JSON` und `CSV` umgeschaltet werden; der Modus wird in `sessionStorage`
  gehalten (siehe [Kapitel 5](#5-browser-persistenz)).
- Upload-Button-Label und `accept`-Filter passen sich dem Modus an; ein Dateityp-Mismatch wird mit
  Fehlermeldung blockiert.
- Solange keine Daten geladen sind, ist zusätzlich ein Button für passende Beispieldaten sichtbar
  (`public/sample-data.json` bzw. `public/sample-data.csv`).
- Im JSON-Modus ohne geladene Daten erscheint außerdem `Neu beginnen`.
- Datenmodus- und Sprachumschalter sind als segmented controls mit aktivem/inaktivem Zustand umgesetzt.
- Download-Dateinamen können optional einen Timestamp enthalten (Checkbox in `DataTransferControls.vue`).
- Im App-Modus `online` werden die lokalen Transfer-Aktionen ausgeblendet, damit kein lokaler
  Import/Export parallel zum Strapi-Datenfluss läuft.

### 9.2 JSON-Import

1. Die Datei wird in `App.vue` per `<input type="file">` geladen.
2. Der Text geht an `importFromJsonText(text, fileName)`.
3. `parseJsonPayload` validiert:
   - gültiges JSON
   - entweder Top-Level-Array oder Objekt mit `data`-Array
   - jedes Datenelement ist ein Plain Object
   - falls vorhanden: `config` ist ein Objekt
   - falls vorhanden: `replacements` ist ein Objekt
   - falls vorhanden: `suspendedItems` ist ein Array von Item-Indizes
4. Bei Erfolg initialisiert `initializeFromJsonArray` die Datenstates, übernimmt eine optionale `config`
   in `importedConfig` und übergibt `replacements` an den Replacements-Store. `suspendedItems` wird
   gegen die Itemanzahl normalisiert (nur nicht-negative Integer im gültigen Bereich, dedupliziert, sortiert).
5. `App.vue` validiert und appliziert eine eingebettete `config` strikt (bei Fehler harter Abbruch mit
   Fehlermeldung).
6. Bei Fehler wird `errorMessage` gesetzt und der alte Stand bleibt erhalten.

**Kopierstrategie:** Daten werden via `cloneData` (`JSON.parse(JSON.stringify(...))`) tief kopiert.
Vorteil: einfacher, stabiler Snapshot für Reset/Export. Einschränkung: nicht geeignet für
nicht-JSON-Typen (`Date`, `Map`, Funktionen).

### 9.3 CSV-Import

- CSV-Import nutzt `parseCsvText` in `src/composables/useViewerData.js`.
- Die erste Zeile ist der Header, danach folgt zeilenweises Mapping auf Objekte.
- Header-Validierung: keine leeren und keine doppelten Spaltennamen.
- Zeilen-Validierung: mehr Spalten als im Header führen zu einem Parse-Fehler; fehlende trailing
  Spalten werden mit `''` aufgefüllt.
- Signifikante Leerzeichen bleiben erhalten: kein zeilenweites `trim()` vor dem Parsing; entfernt werden
  nur ein BOM am Dateianfang und ein trailing `\r` bei CRLF. Gilt für quoted und unquoted Werte gleichermaßen.
- Das Feld `scan` wird bei der Header-Normalisierung case-insensitive auf `scan` gesetzt, damit die
  bestehende Scan-UI automatisch greift.

### 9.4 Start-from-Scratch

- Verfügbar nur im JSON-Modus ohne geladene Daten.
- Eingabe entweder einer einzelnen absoluten `http(s)`-Scan-URL oder eines CSV-Textes mit mehreren URLs;
  ungültige URLs werden mit Fehlermeldung im Modal abgewiesen.
- Erzeugt intern das Payload `{ data: [{ scan }], config: { version: 1, fields: {} },
  replacements: { allFields: {} } }`, importiert es über den normalen JSON-Pfad, setzt die
  User-Config-Session zurück und markiert den Stand als dirty.

---

## 10 Export und Reset

- `createExportPayload()` liefert eine tiefe Kopie von `rawItems`.
- **JSON-Export** schreibt immer das kanonische Format
  `{ data: <items>, config: <user-config>, suspendedItems: <number[]>, replacements: <replacements> }`.
- **CSV-Export** schreibt nur Nutzdaten (ohne Config, ohne `replacements`, ohne `suspendedItems`).
- Vor jedem Download (JSON und CSV) wird eine noch nicht angewendete User-Config automatisch auf
  `rawItems` angewendet, damit Exportdaten und Konfigurationsstand nicht auseinanderlaufen.
- Der Download läuft über die zentrale Helper-Funktion `triggerBrowserDownload` (`Blob` + temporärer Link).
- Dateiname: `<importName>-edited.<json|csv>` bzw. `data-edited.<json|csv>`; mit aktiviertem Timestamp
  `<importName>-edited-YYYY-MM-DD_hh-mm-ss.<json|csv>`. Nur im Timestamp-Fall wird der Stand zusätzlich
  als gespeichert markiert (`markAsSaved`).
- Der Download-Button ist aktiv, wenn Daten **oder** `replacements` vom Snapshot abweichen.
- **Reset** fragt per `confirm(...)` nach, stellt danach `rawItems`, `suspendedItemIndices` und
  `replacements` aus dem Import-Snapshot wieder her und meldet zurück, ob er tatsächlich ausgeführt
  wurde. Nur dann räumt `App.vue` ausstehende Online-Updates und Entwürfe ab.

---

## 11 Ersetzungen (Replacements)

Ersetzungen sind eine **Sammel- und Transportfunktion, keine Transformation.** Der Viewer wendet
Ersetzungsregeln zu keinem Zeitpunkt selbst auf Feldwerte an; er nimmt sie beim Import entgegen, macht
sie in der UI editierbar und schreibt sie beim JSON-Export wieder heraus. Die Anwendung der Regeln ist
Sache nachgelagerter Verarbeitung.

- **Datenstruktur:** `replacements[fieldKey][suchtext] = ersetzungstext`. Der Schlüssel
  `allFields` steht dabei für "alle Felder" - er ist ein regulärer Objektschlüssel im selben
  Namensraum wie echte Feldnamen (`ReplacementsUnit.vue` setzt ihn als Default-Auswahl).
- **Eingabe:** `ReplacementsUnit.vue` in der Sidebar (Dropdown `Feld` inkl. `alle Felder`, Eingaben
  `Ersetze` und `mit`, Button `zur Ersetzungsliste hinzufügen`). Die Feldliste stammt aus den
  angewendeten User-Config-Feldern, ersatzweise aus den aktuell konfigurierten.
- **Anzeige:** `ReplacementsPanel.vue` im Tab `Ersetzungen` gruppiert die Einträge je Feld und zeigt
  nur Felder mit Einträgen.
- **Persistenz:** nur im Speicher. `initializeReplacements(payload)` setzt Wert und Snapshot beim
  JSON-Import; `hasReplacementsChanges` vergleicht serialisiert gegen den Snapshot und beeinflusst den
  Dirty-/Download-Zustand; `resetReplacements()` stellt den Snapshot wieder her; `clearReplacements()`
  leert beides (CSV-Import, Online-Init).
- **Export:** `createReplacementsPayload()` liefert eine tiefe Kopie in das JSON-Export-Payload.
  Der CSV-Export enthält keine Ersetzungen.
- Der Validator prüft nur, dass `replacements` ein Objekt ist; die innere Struktur wird nicht validiert.

---

## 12 Online-Modus und Strapi-Integration

- Der App-Modus wird in `useOnlineModeStore.js` verwaltet (`offline`/`online`) und in `localStorage`
  persistiert. `connectionMode` aus der App-Config kann ihn fixieren; dann wird kein Umschalter angeboten.
- Login/Logout für Strapi-FE-Users laufen über `useAuthStore.js` + `strapiApi.js` (JWT +
  Session-Restore beim App-Start).
- Der gesamte HTTP-Zugriff liegt in `src/services/strapiApi.js`. `strapiFetchJson(...)` setzt
  `Accept`, bei Body `Content-Type` und bei vorhandenem Token `Authorization: Bearer ...`; Fehlerobjekte
  tragen `status` und `payload`, die Fehlermeldung stammt bevorzugt aus `payload.error.message`.

### 12.1 Verbindungsprofil

- Ein Profil besteht aus `version`, `label`, `baseUrl`, `configPath` und `updatedAt`
  (Validierung/Normalisierung in `src/composables/connectionProfile.js`: `baseUrl` ohne trailing Slash,
  `configPath` immer mit führendem Slash, nur `http`/`https`).
- **Die Auth-Endpunkte sind nicht Teil des Profils**, sondern fest verdrahtet: `/api/auth/local` für
  den Login und `/api/users/me` für den Nutzerabruf. Konfigurierbar ist nur `configPath` (Settings-Singleton).
- Die GUI liegt in `DatabaseConnectionPanel.vue` (Speichern, Verbindungstest, Datenmodell-Prüfung,
  JSON Import/Export). Persistenz siehe [Kapitel 5](#5-browser-persistenz).
- Ist `defaultConnectionProfile` gesetzt, lädt `App.vue` beim Start
  `loadConnectionProfileFromDefault(...)` und schreibt das Profil bei Erfolg in `localStorage`.
  Die URL-Auflösung ist robust gegen unterschiedliche Deploy-Pfade: es werden mehrere Kandidaten aus
  `window.location.pathname`, `import.meta.env.BASE_URL` und Root (`/`) gebildet, jeweils mit und ohne
  `connection-profile/`-Prefix. Schlägt das Laden fehl, loggt `App.vue` einmalig
  `Default connection profile load failed:` inkl. Fehlerobjekt, und `OnlineAccessPanel.vue` zeigt eine
  technische Diagnose (`reason`, `profileUrl`, `attempted`) aus `lastConnectionProfileLoadError`.

### 12.2 Login-Modal

- Im Online-Modus startet der Login über ein Modal, das per `Anmelden` geöffnet wird.
- `Identifier` und `Passwort` nutzen denselben globalen Input-Basissatz; die Passwortsichtbarkeit wird
  über Icon-Buttons (Eye/Eye-off SVG) umgeschaltet.
- Das Modal schließt bei Backdrop-Klick, Moduswechsel und nach erfolgreicher Authentifizierung.
- Authentifiziert zeigt der Header nur den Button `Abmelden` (kein zusätzliches User-Label).

### 12.3 Initialisierungsfluss

Ein Watcher in `App.vue` reagiert auf App-Modus, Auth-Status, `Configuration only` sowie
`baseUrl`/`configPath` des Profils. Ist der Modus nicht `online` oder der Nutzer nicht authentifiziert,
werden Online-Wording, Settings, Items und Updates geleert. Andernfalls läuft strikt sequenziell:

1. **Settings laden** (`fetchOnlineSettings` → `GET <configPath>`, erwartet ein Objekt unter
   `data.settings`; optionales `data.wording` wird mitgenommen).
2. **Backend-Wording setzen** (`setOnlineWording`, siehe [4.3](#43-wording-backend-merge-und-sprachen)).
3. `itemsPath` aus den Settings lesen (`itemsPath`, Legacy-Fallback `item_path`) und das Datenmodell
   mit einer leeren Liste initialisieren (`online:<itemsPath>` als Anzeigename). Die Scan-Quelle wird
   analog aus `scanField` aufgelöst (siehe [12.6](#126-item-normalisierung-und-wikidata-mapping)).
4. **Settings-Config anwenden** (`applyImportedConfigPayload`). Ist `data.settings` nicht als gültige
   Config interpretierbar, geht die UI in einen expliziten Fehlerzustand
   (`markOnlineSettingsInvalid`) - kein stilles Weiterlaufen mit inkonsistentem Stand.
5. Bei aktivem **`Configuration only`** endet der Fluss hier: Item-Requests werden vollständig
   übersprungen, die Settings-Config bleibt aber verbindlich im User-Config-State und ist im Tab
   `Konfiguration` sichtbar.
6. **Items laden** (`fetchOnlineItems`, Strategie siehe [12.5](#125-hierarchie-und-level-1-buckets)),
   danach Items sanitizen, als Viewer-Daten initialisieren und die Config erneut auf den Datenbestand anwenden.

Der Toggle `Configuration only` liegt im Header und wird persistiert.

### 12.4 Query-Aufbau

Alle Item-Requests werden über `buildItemsPathWithPopulate(itemsPath, options)` gebaut. Bereits im
`itemsPath` enthaltene Query-Parameter bleiben erhalten, ein Fragment (`#...`) wird abgeschnitten.

| Option | Erzeugte Parameter | Zweck |
| --- | --- | --- |
| `page`, `pageSize` | `pagination[page]`, `pagination[pageSize]` | Paginierung (Default `pageSize: 100`, bei Feldwert-Abfragen 250) |
| `populateFields` | `populate[0]`, `populate[1]`, … | Nachladen komplexer Felder. Befüllt aus `getWikidataAutosuggestFieldKeysFromSettings(settings)`, also allen Feldern mit Typ `wikidata-autosuggest` bzw. `wikidata_autosuggest`. |
| `fieldKeys` | `fields[0]`, `fields[1]`, … | Projektion auf einzelne Felder (genutzt für Level-1-Werte, um keine Voll-Items zu laden) |
| `filtersEq` | `filters[<key>][$eq]=<value>` | Serverseitige Filterung, genutzt für das Nachladen eines Level-1-Wertes |

`fetchAllCollectionItemsFromStrapi(...)` paginiert bis `meta.pagination.pageCount` und sammelt alle
Zeilen ein. Meldet Strapi einen ungültigen Query-Key (`invalid key <name>`) und ist dieser Name ein
aktuell gesetzter `populate`-Key, wird der Key entfernt und der Request wiederholt; andere Fehler werden
durchgereicht. Damit funktioniert die App auch gegen Datenmodelle, in denen ein konfiguriertes
Wikidata-Feld nicht als populierbare Relation/Komponente existiert.

### 12.5 Hierarchie und Level-1-Buckets

`useOnlineItemsStore.js` bestimmt die Ladestrategie aus den Settings:

- **Hierarchie-Erkennung** (`normalizeHierarchyFields`) ist bewusst tolerant: `hierarchyFields`,
  `hierarchy_fields`, `hierarchicalFields`, `hierarchy.fields`, `config.hierarchyFields`,
  `config.hierarchy_fields`, ein Objekt `hierarchy: { level1, level2 }` sowie kommaseparierte Strings.
  Greift nichts davon, wird auf Feld-Auto-Erkennung zurückgefallen (`level_1`/`level_2`, sonst
  `level1`/`level2`). Hierarchie ist aktiv ab zwei Feldschlüsseln.
- **Ohne Hierarchie:** Items werden paginiert vollständig geladen und normalisiert.
- **Mit Hierarchie und `firstLevelStaticList`:** Die Level-1-Boxen werden direkt aus der Liste gerendert
  (getrimmt, leere Einträge entfernt, dedupliziert, Reihenfolge bleibt erhalten). Beim Start erfolgt
  **kein** Item- oder Bucket-Request; `count` bleibt `null`.
- **Mit Hierarchie ohne `firstLevelStaticList`:** Es werden nur die Werte des Level-1-Feldes geladen
  (`fetchCollectionFieldValuesFromStrapi` mit `fields[0]=<level1Feld>`), daraus werden Optionen mit
  Trefferzahl gebaut, alphabetisch sortiert; Items ohne Level-1-Wert landen in einem
  `isUnassigned`-Bucket am Ende.
- **Nachladen je Level-1-Wert** (`fetchOnlineItemsForHierarchyLevel1`): Request mit
  `filters[<level1Feld>][$eq]=<Wert>`; zusätzlich wird clientseitig nachgefiltert. Für den
  `isUnassigned`-Bucket (leerer Wert) entfällt der Filter und es werden clientseitig die Items ohne
  Level-1-Wert behalten.
- Die Level-1-Boxen werden im Hierarchie-Modus sofort gerendert, auch wenn noch keine Item-Karten geladen sind.

### 12.6 Item-Normalisierung und Wikidata-Mapping

- `normalizeStrapiItem(row, settingsFields, itemsPath, scanFieldKey)` unterstützt beide Zeilenformen: flach
  (Strapi v5) und `{ id, attributes }`.
- **Scan-Quelle:** `resolveScanFieldFromSettings(settings)` liest den Settings-Schlüssel `scanField`
  (Legacy-Fallback `scan_field`, Default `scan`). `normalizeStrapiItem` kopiert den Wert dieses Feldes
  nach `scan`; die restliche UI liest weiterhin ausschließlich `item.scan`. Damit lassen sich
  Datenmodelle anbinden, in denen die Bild-URL unter einem anderen Schlüssel liegt (z. B. `scan_url`,
  während `scan` eine Laufnummer trägt). Fehlt das Quellfeld in der Zeile, erhält das Item **kein**
  `scan` und die App fällt in den No-Scans-Modus.
- **Stabile Identifikation** nutzt primär `documentId`, mit Fallback auf `id`. Fehlt beides, ist das
  ein harter Fehler beim Ingest.
- Interne Metadaten liegen pro Item unter `__onlineMeta` (u. a. `id`, `idKind`, `itemsPath`,
  bei Entwürfen `isDraft`/`draftId`) und sind aus Editor-, Mapping- und Config-Oberflächen ausgeblendet.
- **Wikidata-Komponenten-Mapping:** Felder vom Typ `wikidata-autosuggest` werden zwischen Strapi- und
  Viewer-Form übersetzt:
  - beim Laden: `wikidata_id` → `id`, `additional_data` wird in das Entity-Objekt hineingemischt,
    beide Strapi-Schlüssel entfallen
  - beim Speichern: `id` → `wikidata_id`, `label`/`description` bleiben top-level, alle übrigen
    Schlüssel wandern nach `additional_data`
  - Entities ohne verwertbare ID bleiben unverändert.

### 12.7 Settings-Write-Back (`Konfiguration anwenden` im Online-Modus)

Wird `Konfiguration anwenden` bei App-Modus `online`, authentifiziertem Nutzer und vorhandenem
Verbindungsprofil ausgelöst, folgt auf die lokale Anwendung ein **Schreibzugriff auf Strapi**:

1. `App.vue` baut `mergedSettings = { ...bisherigeOnlineSettings, ...createUserConfigPayload(),
   fields: <payload.fields> }`. Bestehende Settings-Schlüssel bleiben also erhalten, die
   Config-Schlüssel des Viewers (u. a. `fields`, `itemLabelField`, `markAsEditedBasis`,
   `showOnlyNonEmptyFields`) werden überschrieben.
2. `useOnlineSettingsStore.persistOnlineSettings(mergedSettings)` ruft
   `updateViewerSettingsInStrapi(...)` auf: `PUT <configPath>` mit `{ data: { settings } }`.
3. Die Antwort muss erneut ein Objekt unter `data.settings` liefern, sonst Fehler. Bei Erfolg werden
   `settings` (und ggf. `wording`) aus der Antwort übernommen und `settingsStatus` auf `ready` gesetzt.
4. Bei Fehler bleibt der lokale Stand erhalten, `settingsStatus` wird `error` und `lastSettingsError`
   trägt die Meldung.

Konsequenz für die Bedienung: `Konfiguration anwenden` ist im Online-Modus **kein rein lokaler
Vorgang**, sondern verändert die zentral gespeicherte Viewer-Konfiguration für alle Nutzer dieser
Strapi-Instanz.

### 12.8 Update-Flow (bestehende Items)

- Änderungen werden als Feld-Deltas gegen den Snapshot verfolgt (`useOnlineUpdatesStore`); ein
  Rücksetzen auf den Ursprungswert entfernt das Delta wieder.
- Gespeichert wird sequenziell über `updateCollectionItemInStrapi(...)`:
  `PUT <itemsPath>/<documentId>` mit `{ data: <changedFields> }`, gebaut über
  `buildStrapiUpdatePayload(...)`; Wikidata-Felder werden dabei über
  `normalizeOnlineChangedFieldsForStrapi(...)` in die Strapi-Komponentenform gebracht.
- Bei Vollerfolg synchronisiert `markAsSaved(...)` die Baseline; bei Teilfehlern bleibt ein
  konsistenter, retry-fähiger Pending-Stand erhalten.
- Save-Status: `idle | saving | success | error`, inkl. Unsaved-Counter und Retry-Aktion im
  `OnlineAccessPanel.vue`. Erfolgs-Feedback blendet sich nach kurzem Timeout aus; alle Texte der
  Save-UX liegen als Wording-Handles vor.

### 12.9 Create-Flow (neues Item)

- Im Online-Modus zeigt der Listenkopf für authentifizierte Nutzer mit bekanntem `itemsPath` einen
  Button `Neues Item` / `New item`.
- Ein Klick legt einen lokalen Entwurf an (`appendOnlineDraftItem`): gleiche Feldschlüssel wie die
  geladenen Items, initialisiert mit den Registry-Defaults je konfiguriertem Feldtyp
  (`''`, `null`, `false`, `[]`), optional `scan: ''`, plus
  `__onlineMeta: { isDraft: true, draftId, itemsPath }`.
- Der Entwurf wird sofort selektiert, zählt ab Anlage im Unsaved-Counter mit und nutzt die allgemeine
  Listen-Sortierlogik; ohne eigenen Titel erscheint das Fallback-Label `Neues Objekt` / `New item`.
- `suspendEditing` funktioniert wie bei regulären Items; `showOnlyNonEmptyFields` blendet leere
  Entwurfsfelder nicht aus.
- Feldänderungen am Entwurf werden in `pendingCreatesById` getrackt.
- Beim Speichern laufen Creates **vor** den Updates: `POST <itemsPath>` mit
  `{ data: <nur nicht-leere Felder> }` (`createCollectionItemInStrapi`, Nicht-leer-Regel wie
  `hasNonEmptyOnlineFieldValue`; `false` gilt als Wert).
- Bei Erfolg erhält das Item die vom Server gelieferte `documentId` (Fallback `id`) in `__onlineMeta`;
  spätere Edits laufen als reguläres PUT-Delta. Bei Vollerfolg übernimmt `markAsSaved` den
  Baseline-Sync, bei Teilfehlern synchronisiert `syncSnapshotItemAtIndex` gezielt die bereits erstellten Items.
- Bei Fehlern bleibt der Entwurf als pending Create bestehen (retry-fähig); die Meldung erscheint im
  Save-Status (`error`).
- Ein Reset vor dem Speichern verwirft nicht gespeicherte Entwürfe samt Pending-Einträgen.

### 12.10 Datenmodell-Prüfung (Tab `Einstellungen`)

`checkDataModelImplementationInStrapi(...)` prüft, ob das konfigurierte Strapi-Datenmodell die vom
Viewer erwartete Form der Wikidata-Felder liefert. Ablauf:

1. Settings laden und `itemsPath` auflösen (fehlt er, ist das ein Fehler).
2. Alle `wikidata-autosuggest`-Feldschlüssel aus den Settings ermitteln und eine Probe-Anfrage mit
   `pageSize=1` und `populate[]` für genau diese Felder stellen.
3. Lehnt Strapi einen `populate`-Key ab (`invalid key <name>`), wird dieser Key entfernt und die Probe
   wiederholt; die entfernten Keys werden als `droppedPopulateKeys` zurückgegeben.
4. Für jedes Wikidata-Feld der ersten Zeile wird ein Status ermittelt:
   - `error`: Feld fehlt im Payload, ist kein Array, enthält keine Objekte, oder die Entities haben
     weder `id`+`label` noch eine erkennbare Form
   - `error` mit expliziter Meldung, wenn die Entities `wikidata_id` statt `id`+`label` verwenden
   - `warning`: Feld ist ein leeres Array (Form nicht verifizierbar)
   - `ok`: Entities haben `id` und `label`
5. Rückgabe: `{ ok, status: 'ok' | 'warning' | 'error', itemsPath, probePath, droppedPopulateKeys,
   wikidataFieldKeys, checks, rowCount, payload }`. `status` ist `warning`, wenn es Warnungen gibt
   **oder** populate-Keys verworfen wurden.

`DatabaseConnectionPanel.vue` ruft die Prüfung über `useConnectionProfileStore.checkDataModelImplementation(...)`
auf, sperrt den Button während des Laufs und rendert das Ergebnis als Statusmeldung
(`formatDataModelCheckStatus`).

---

## 13 Wikidata-Autosuggest

- **Suchbasis:** `wbsearchentities` je Sprache aus `autosuggest.searchLanguages`.
- **Request-Strategie:** Multilanguage-Calls nutzen `Promise.allSettled` statt `Promise.all`;
  erfolgreiche Teilantworten werden zusammengeführt. Fällt nur eine Sprache aus, liefert die Suche
  weiterhin Treffer aus den verbleibenden Sprachen; Rejections werden nur in DEV geloggt.
- **Deduplizierung:** Merge nach Entity-`id`.
- **Claim-Nachladen:** Ist `autosuggest.prioritize` konfiguriert, werden benötigte Claims per
  `wbgetentities` nachgeladen - ebenfalls teilrobust (`Promise.allSettled` über Chunk-Requests).
- **Regelblöcke:**
  - `claimPresence`: Match, wenn mindestens eine Property aus `defs` vorhanden ist
    (`defs` unterstützt Legacy-Strings und Objekte mit `propertyId`).
  - `claimValueMatch`: Match, wenn mindestens ein `{ property, value }`-Paar aus `defs` zutrifft
    (`label` ist rein darstellungsbezogen).
- **Scoring/Sortierung:** Summe der Block-`weight`-Werte (je Block maximal einmal pro Entity);
  Sortierung nach `score` absteigend, Tie-Break ist die originale Wikidata-Reihenfolge.
- `showInSuggestion` zeigt priorisierungsbezogene Metadaten in der Trefferliste. Sind Def-Labels
  gesetzt, erscheinen sie als `Label (PropertyId): ...` statt nur `PropertyId: ...`.
- `includeInEmitData` behält `ranking` und `prioritizationValues` im selektierten Entity-Payload;
  bei aktivem `showInSuggestion` bleiben die angezeigten Werte ebenfalls erhalten, damit z. B. GeoNames
  auch im Raw-Data-Export sichtbar sind.
- Ist `prioritizationValues.P1566` vorhanden, wird zusätzlich `geoNames` als String-Array in die
  selektierte Entity geschrieben.
- Selektierte Entities enthalten lokalisierte Begriffe unter `labels` und `descriptions` als Sprachmaps
  (mindestens `de` und `en`). Quelle ist der sprachspezifische Merge aus `wbsearchentities`; beim
  Auswählen wird zusätzlich `wbgetentities` mit `props=labels|descriptions` und `languages=de|en`
  aufgerufen, damit die Werte stabil im Export-Payload landen.
- `prefillWith`: Beim Wechsel auf ein Item wird der Wert des referenzierten `normal`-Felds in die
  Autosuggest-Eingabe übernommen; die Suche startet automatisch nur, wenn noch keine Entity im Feld
  selektiert ist.
- `alsoGetDataFrom`: Beim Hinzufügen einer Entity werden die rohen Statements je konfigurierter
  Property nachgeladen und unter `statementData[PROPERTY_ID]` gespeichert. Ist `statementData`
  vorhanden, zeigt die selektierte Entity-Liste einen Toggle (`Show/Hide statement data`) und rendert
  die Daten als formatierten JSON-Block.
- Bereits ausgewählte Entities werden aus der Suggestion-Liste gefiltert; die Liste ist auf `6rem`
  Höhe begrenzt und scrollt vertikal.
- **Stale-Protection:** `WikidataAutosuggestInput.vue` hält pro Query einen `AbortController`; bei
  neuer Eingabe oder Unmount werden laufende Requests abgebrochen. Abgebrochene Requests erzeugen weder
  Fehleranzeige noch Error-Logging.

---

## 14 UI-Architektur (`App.vue`)

Aufbau der Seite:

- **Topbar** (Titel, Online-Panel, Transfer-Controls) oberhalb der Tabs, immer sichtbar. Die
  Header-Controls sind so ausgerichtet, dass sie bei ausreichend Platz in einem horizontalen Fluss stehen.
- **Tab-Leiste** (sticky) mit fünf Bereichen: `Editieren`, `Konfiguration`, `Ersetzungen`,
  `Einstellungen`, `Info`. Interner Tab-Key des Settings-Tabs ist weiterhin `database-connection`.
  Tastatursteuerung: Left/Right (zyklisch), Home/End, Enter/Space.
- **Edit-Tab:** sticky Header-Stack mit Listenkopf (`Digitalisate` + Suche); bei konfigurierter
  Hierarchie zuerst die Level-1-Boxen, danach einklappbare Level-2-Gruppen mit eigener Item-Liste.
- **Liste:** Kartenansicht der gefilterten Items inkl. Scan-Vorschau; ohne `scan`-Spalte automatische
  Umschaltung auf die textbasierte Listenansicht.
- **Sidebar:** Felder des selektierten Items und größere Scan-Vorschau (Desktop sticky mit internem
  Scroll). Ein Expand/Collapse-Button schaltet auf volle Inhaltsbreite um.
- **Statusbereich:** Datei-/Fehlerstatus, darunter der Footer mit Identity-Links.
- **Replacements-Tab:** gruppierte Tabellen je Feld, nur Felder mit Einträgen.

Zusatzfunktionen:

- Lightbox für das `scan`-Bild mit Fullscreen-Umschaltung; Fallback-UI bei Bildladefehlern
  (Liste, Sidebar, Lightbox).
- `beforeunload`-Warnung bei `isDirty` oder nicht angewendeten User-Config-Änderungen.
- `Escape` schließt Start-From-Scratch-Modal und Lightbox; bei offener Sidebar hebt `Escape` die
  aktuelle Auswahl auf.
- Upload/Download-Buttons behalten feste Breiten je Aktionstyp, damit beim Moduswechsel kein
  Layout-Springen entsteht.

Interne Aufteilung:

- `useSelectionNavigation.js` kapselt `selectedFilteredIndex`, `canGoPrevious`, `canGoNext` sowie
  Vor/Zurück und Auswahl aufheben - jeweils gegen die **aktuelle** gefilterte Reihenfolge.
- `useDataImportExport.js` kapselt Dateityp-Checks, Importpfade, Beispieldaten, Start-from-Scratch,
  Download und Reset.
- `App.vue` bleibt Composition-Root und beschränkt sich auf Verdrahtung von Komponenten, Stores,
  Watchern und Lifecycle-Events. Im Online-Modus verhindert es zusätzlich, dass die lokale
  Feld-Auto-Initialisierung die aus Strapi geladenen Settings überschreibt.
- Die Höhen von Tab-Reihe und Edit-Header werden per `ResizeObserver` gemessen und als CSS-Variablen
  für die Sticky-Offsets gesetzt.

---

## 15 Styling und Responsiveness

Die Styles sind in Layer aufgeteilt (`src/assets/styles/index.scss`):

- `tokens/_index.scss` - zentrale Farb-/Spacing-/Typo-Tokens
- `base/_index.scss` - Basiselemente, Fokuszustand, globaler Hintergrund
- `layout/_index.scss` - Grid-Layout und Responsive-Regeln
- `components/_index.scss` - Ausnahme-Layer für notwendige globale Sonderfälle
- `legacy.scss` - temporärer Migrations-Layer für globale Alt-Styles

Komponentenspezifische Styles gehören in die jeweilige SFC (`<style scoped lang="scss">`).

**Farbschema:** semantische Root-Tokens (`--color-*`) mit Mapping auf die bestehenden `--ve-*`
Variablen, damit Komponenten-Regeln unverändert bleiben. Token-Defaults:

- Primary `#0066CC` / Hover `#004F99`
- Secondary `#FF8C42` / Hover `#E56E2E`
- Background `#EEF1F5`, Surface `#FFFFFF`
- Border `#D6DCE5` / Soft `#E5EAF0`
- Text `#1F2937` / Secondary `#5B6575`

> **Achtung:** `--color-primary` ist zur Laufzeit überschrieben. `App.vue` setzt beim Start und bei
> jeder Änderung `document.documentElement.style.setProperty('--color-primary', primaryColor)` aus der
> App-Config. Der Token-Wert `#0066CC` ist damit nur der Fallback, nicht die effektive Farbe.
> `--color-primary-hover` wird nicht mitgesetzt.

Globaler Seitenhintergrund:
`radial-gradient(circle at top, #F8FAFC 0%, #EEF1F5 60%, #E7ECF2 100%)`.

Layoutverhalten:

- Grid-Layout für Desktop (`list/sidebar/status`) plus sticky Header-Stack im Edit-Tab
- Responsive Umschaltung auf einspaltiges Layout bei `max-width: 768px`
- Im erweiterten Modus wird die Sidebar nicht sticky gerendert, nutzt volle Inhaltsbreite und
  vergrößert den Scanbereich relativ zur Feldspalte
- Kartenlayout `auto-fill, minmax(300px, 1fr)`; die Mindestbreite ist bewusst auf `300px` reduziert,
  um horizontalen Druck in kleinen Viewports zu verringern
- Lightbox mit dunklem Overlay

Weitere Konventionen:

- Wichtige interaktive Controls übersteuern `button:hover` lokal (Tabs, Datenmodus-Switch,
  Transfer-Buttons, Listenkarten), damit Hover-Farben konsistent mit Primary/Secondary bleiben.
- Placeholder in Inputs/Textareas werden global heller gerendert.
- Das globale Input-Basestyling umfasst explizit auch `input[type='password']`.

---

## 16 Testabdeckung

Testlauf:

```bash
pnpm test        # entspricht: vitest run
```

Stand `9f9ae8e`: 17 Testdateien, 151 Tests, alle grün.

### Composables

| Datei | Geprüftes Verhalten |
| --- | --- |
| `composables/useViewerData.test.js` | Validierung von `parseJsonPayload` (Top-Level-Array, eingebettete `data`/`config`, `suspendedItems`), `tokenize`, `looksLikeImageUrl`, CSV-Randfälle (`splitCsvLine` mit Quotes/escaped Quotes, leere und fehlende trailing Spalten, Spaltenüberschuss als Fehlerpfad, Whitespace-erhaltender Roundtrip), Mindestlänge der Suche, Label-Feld-Priorisierung, Sortierung nach Bearbeitungsstand inkl. invertiertem Modus und Zusammenspiel mit `suspendEditing`, Suspend-Toggle per UID, Import/Export der Suspend-Indizes, Kern-Flow (Init → Filter → Select → Update → Reset), Wikidata-Werte als Entity-Arrays inkl. Metadaten-Roundtrip, `appendOnlineDraftItem` und `syncSnapshotItemAtIndex` |
| `composables/userConfigValidation.test.js` | Gültige Config-Payloads; Ablehnung fehlender/ungültiger `fields`, unbekannter Feldtypen, ungültiger `itemLabelField`/`markAsEditedBasis`/`showOnlyNonEmptyFields`/`fieldWidth`/`hint`/`readOnly`; `readOnly` verboten für `wikidata-autosuggest`; `autosuggest` nur auf Wikidata-Feldern; `prefillWith`-Regeln; `alsoGetDataFrom` als String und Repeater inkl. Property-ID-Prüfung; Candidate-Regeln (`targetField` Pflicht, kein Candidate-Ziel, `inputType`) |
| `composables/useFieldMapping.test.js` | Leere Wikidata-Felder bleiben bei `showOnlyNonEmptyFields` sichtbar; `suspendEditing` und `__onlineMeta` erscheinen nie als editierbare Felder; Candidate-gesteuertes Prefill/Force-Search für Autosuggest-Bindings |
| `composables/useDataImportExport.test.js` | Eine noch nicht angewendete User-Config wird vor JSON- **und** CSV-Export automatisch angewendet |
| `composables/useSelectionNavigation.test.js` | Navigation folgt der aktuellen gefilterten Reihenfolge nach Umsortierung; Vorwärts-Navigation ist bei nur einem Item deaktiviert |
| `composables/useWikidataSearch.test.js` | Resilientes Merge-Verhalten bei Ausfall einer Suchsprache; `AbortError`-Pfad ohne Warning-Logging; `claimPresence` mit Objekt-Defs; Nachladen roher Statement-Daten; Nachladen lokalisierter Labels/Descriptions (`de`/`en`) |
| `composables/connectionProfile.test.js` | Normalisierung von `baseUrl` (Trim, trailing Slash) und `configPath` (führender Slash); Pflichtfeld-Validierung; `createSavedConnectionProfile` mit `updatedAt`; JSON-Parsing; `joinBaseUrlAndPath` |

### Fields und Services

| Datei | Geprüftes Verhalten |
| --- | --- |
| `fields/fieldRegistry.test.js` | Registrierte Feldtypen bleiben stabil; Fallback auf abgeleiteten Editor-Typ bei unbekanntem Typ; Editor-Bindings für Checkbox, Read-only-Text und Candidate; Defaults je Typ; Normalisierung beim Config-Apply inkl. best-effort Integer-Coercion; kanonische Form für fehlerhafte Wikidata-Werte; `autosuggest`-Config bleibt opaker Pass-through; Edit-Normalisierung inkl. Legacy-Pfad und `configuredType`-gesteuerter Integer-Logik |
| `services/strapiApi.test.js` | Normalisierung flacher und `attributes`-basierter Zeilen inkl. `documentId`/`id`-Fallback und hartem Fehler ohne stabile ID; Update-Payload mit `data`-Wrapper; Update-Request gegen den aufgelösten Item-Pfad; `populate[n]`-Aufbau; Ermittlung der Wikidata-Feldschlüssel aus Settings; Wikidata-Mapping Strapi ↔ Viewer in beide Richtungen; Settings lesen (inkl. optionalem Wording) und schreiben über `configPath`; Datenmodell-Prüfung inkl. `wikidata_id`-Mismatch und Retry nach abgelehntem `populate`-Key; Item-Fetch-Retry ohne ungültigen `populate`-Key |

### Stores

| Datei | Geprüftes Verhalten |
| --- | --- |
| `stores/useAppConfigStore.test.js` | Lokales Wording als Default; sprachweise Überschreibung durch Backend-Wording; reine Backend-Handles; Rückfall auf lokales Wording nach `clearOnlineWording`; geschützte Settings-Tab-Handles bleiben lokal |
| `stores/useUserConfigStore.test.js` | Initialisierung minimaler Autosuggest-Config beim Typwechsel; Erhalt unbekannter Autosuggest-Schlüssel; Entfernen von `autosuggest`/`readOnly` bei Typwechsel; Candidate-Initialisierung, -Aktualisierung und Abwehr ungültiger Ziele; Persistenz und Bereinigung von `itemLabelField` |
| `stores/useAuthStore.test.js` | Login speichert das JWT; `restoreSession` lädt Token und Nutzer; Login ohne Credentials schlägt fehl |
| `stores/useConnectionProfileStore.test.js` | Speichern und Neuladen eines Profils; Ablehnung ungültiger Profile; JSON-Import; Laden des Default-Profils über Runtime-Fallback-Pfade |
| `stores/useOnlineModeStore.test.js` | Speichern/Restore des App-Modus; Ablehnung ungültiger Modi; deaktiviertes Umschalten bei fixiertem `connectionMode` |
| `stores/useOnlineSettingsStore.test.js` | Laden aus `response.data.settings`; Persistieren gegen den Singleton-Endpoint; lokaler State bleibt bei fehlgeschlagenem Persist erhalten |
| `stores/useOnlineItemsStore.test.js` | Laden und Sanitizing über `settings.itemsPath`; `attributes`-Form mit numerischem ID-Fallback; harter Fehler ohne stabile ID; Level-1-Optionen ohne Voll-Item-Fetch; `firstLevelStaticList` ohne Item-Requests; Hierarchie-Erkennung über den Legacy-Schlüssel `hierarchy_fields` |
| `stores/useOnlineUpdatesStore.test.js` | Delta-Tracking inkl. Revert auf den Snapshot-Wert; Teilfehler bleiben pending und werden gemeldet; Draft-Tracking (unberührter Entwurf zählt als pending, persistierte Items nicht); POST nur mit nicht-leeren Feldern und Übernahme der `documentId`; fehlgeschlagener Create bleibt retry-fähig; erstellte Items wechseln danach auf den Update-Pfad |

---

## 17 Bekannte Grenzen

- Import akzeptiert Top-Level-Array oder `data`-Array; `data` als Objekt ist ungültig.
- Der CSV-Parser ist bewusst minimal; exotische CSV-Formate werden nicht vollständig abgedeckt.
- Editierbar sind nur Registry-unterstützte Feldtypen; unbekannte komplexe Strukturen bleiben als
  Rohdaten sichtbar und werden nicht semantisch aufbereitet.
- Deep Clone via JSON-Serialisierung unterstützt keine Spezialtypen (`Date`, `Map`, Funktionen).
- Die Bildvorschau basiert auf URL-Pattern und prüft die Erreichbarkeit nicht vor dem Laden.
- Ersetzungen werden nicht auf die Daten angewendet (siehe [Kapitel 11](#11-ersetzungen-replacements)).
- Items, Auswahl, Dirty-State und Ersetzungen überleben keinen Reload.
- Im Online-Modus ohne Hierarchie werden alle Items paginiert vollständig geladen; es gibt kein
  virtuelles Scrolling.

---

## 18 Erweiterungspunkte

- Schema-basierte Feldvalidierung (z. B. pro Key-Regeln)
- Undo/Redo statt nur globalem Reset
- Virtuelles Scrolling/Pagination für große Datensätze in der Liste
- Anwendung der Ersetzungsregeln direkt im Viewer (heute bewusst nur Sammlung/Export)
- Feinere i18n/Locale-Unterstützung über DE/EN hinaus
- Konfigurierbare Auth-Endpunkte im Verbindungsprofil (heute fest `/api/auth/local` und `/api/users/me`)
