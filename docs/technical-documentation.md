# Technical Documentation

> Bei Abweichungen zwischen diesem Dokument und dem Code gilt der Code.
> Dieses Dokument ist die maßgebliche Implementierungs-/Architekturreferenz;
> `README.md` ist die kurze Einstiegs- und Setup-Beschreibung.

## Inhalt

1. [Projektüberblick](#1-projektüberblick)
2. [Tech Stack und lokale Entwicklung](#2-tech-stack-und-lokale-entwicklung)
3. [Projektstruktur](#3-projektstruktur)
4. [Konfiguration und Wording](#4-konfiguration-und-wording)
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
- Ersetzungsregeln je Feld, die auf Nutzeraktion hin auf die Daten angewendet werden (offline auf die
  geladenen Items, online auf die gesamte Collection, siehe [Kapitel 11](#11-ersetzungen-replacements))
- Bildvorschau für `scan`-URLs inkl. Lightbox und Fullscreen; automatischer Listenmodus ohne `scan`-Spalte
- Lokalisierung über Wording-Handles (DE/EN) mit optionaler Überschreibung aus dem Backend
- Zwei Konfigurationsebenen: Grundkonfiguration aus `public/app-config/` und Konfiguration der
  Datenquelle (JSON-Datei bzw. Strapi-Settings); Tab `Einstellungen` für Verbindungsprofil und
  Viewer-Einstellungen
- Responsives Editor-Layout mit dreistufig sticky Kopfbereich (Topbar, Tab-Reihe, Edit-Kopfzeile),
  Sidebar-Editor und erweitertem Vollbreiten-Modus

---

## 2 Tech Stack und lokale Entwicklung

- Framework: Vue 3 (`script setup`, Composition API), ohne externe State-Bibliothek
  (Stores sind Module mit Modul-globalen `ref`s)
- Build Tool: Vite 6
- Tests: Vitest 2
- Styling: Sass (SCSS)
- Info-Tab-Rendering: `markdown-it` + `highlight.js`
- Sprache: JavaScript (ESM)
- Deployment Base Path: generischer Build `/viewer-editor/` (`base` in `vite.config.js`); Projekt-Builds
  setzen ihn selbst (siehe [Projekt-Modi](#projekt-modi---mode-project))

### Paketmanager und Skripte

Im Repository liegt ausschließlich `pnpm-lock.yaml` (kein `package-lock.json`), d. h. der Lockfile-Stand
wird mit **pnpm** gepflegt. Ein `packageManager`-Feld in `package.json` existiert nicht.

```bash
pnpm install
pnpm dev        # Vite Dev-Server
pnpm build      # Produktionsbuild
pnpm preview    # Build lokal serven
pnpm test       # vitest run
pnpm settings:backup <project> | --all   # Strapi viewer-setting lokal sichern (siehe unten)
pnpm items:dump <project> | --all        # alle Items der Collection lokal ablegen (siehe unten)
pnpm fields:sync                         # Feldkonfiguration zwischen Collections prüfen/angleichen (Menü, siehe unten)
```

Die Skriptnamen sind identisch für `npm run ...`; ein `npm install` erzeugt allerdings ein
konkurrierendes `package-lock.json` und sollte deshalb vermieden werden.

### Projekt-Modi (`--mode <project>`)

```bash
pnpm dev --mode xylothek
pnpm build --mode xylothek      # Ausgabe: dist-projects/xylothek/
pnpm preview --mode xylothek
```

Ohne `--mode` (bzw. mit Vites eigenen Modi `development`, `production`, `test`) entsteht der generische
Build wie bisher: `base` `/viewer-editor/`, Ausgabe `dist/`. Jeder andere Modus ist ein Projektname.

- **Wo die Projekte liegen:** in einem eigenen Config-Repo, per Konvention im Nachbarordner
  `../viewer-editor-projects/<project>/`. Ein anderer Ort wird in der (ungetrackten) `.env.local` dieses
  Repos gesetzt: `VIEWER_EDITOR_PROJECTS_DIR=<pfad>`. Fehlt das Projekt, bricht der Build ab und nennt die
  vorhandenen Projekte.
- **Projektordner:** `project.json` (optional: `base`, siehe unten; `title` für `<title>`; `favicon` als
  Pfad im Projekt-`public/`), `public/` und optional `.env` / `.env.local`.
- **Overlay:** `public/` des Projekts wird über das generische `public/` gelegt; eine Projektdatei ersetzt
  die generische Datei mit demselben Pfad. Das Ergebnis liegt in `.vite/project-public/<project>/` und dient
  als `publicDir`. Im Dev-Server wird es bei Änderungen in einem der beiden Ordner neu erzeugt (Full Reload).
- **Laufzeitdateien bleiben Dateien:** `app-config/*.json` landen unverändert im Build und lassen sich auf dem
  Server ohne Rebuild austauschen.
- **Pfad `<server>/<project>/`:** Ohne `base` in `project.json` laufen Dev-Server und Preview unter
  `/<project>/` (z. B. `http://localhost:5173/xylothek/`). Der Build ist relativ (`./`): Den Inhalt von
  `dist-projects/<project>/` in einen Ordner `<project>` auf dem Server legen, dann läuft die App unter
  `<server-url>/<project>/`, egal unter welchem Serverpfad. Die Seiten-URL muss mit `/` enden. Ein `base` in
  `project.json` überschreibt beides.
- **Secrets:** `envDir` ist der Projektordner. `VITE_*`-Werte landen lesbar im Bundle; Secrets gehören ohne
  `VITE_`-Präfix in die `.env.local` des Projekts und sind nur zur Build-Zeit verfügbar. Der Build warnt bei
  `VITE_*`-Namen, die nach Secret aussehen (`TOKEN`, `SECRET`, `PASSWORD`, `PRIVATE`, `API_KEY`).
- Code: `build-tools/projectMode.js` (Auflösen, Overlay, `index.html`-Anpassung, Vite-Plugin), eingebunden
  in `vite.config.js`. Tests: `build-tools/projectMode.test.js`.
- Deployment bleibt manuell (Inhalt von `dist-projects/<project>/` hochladen).

### Backup der Viewer-Settings (`pnpm settings:backup`)

```bash
pnpm settings:backup xylothek-index-cards   # ein oder mehrere Projekte
pnpm settings:backup --all                  # alle Projekte mit Grundkonfiguration
```

Die Online-Konfiguration (Felder, Hierarchie, Wording, Mappings) liegt nur im Strapi-Single-Type
`viewer-setting`; ein Speichern im Tab `Konfiguration` überschreibt sie ohne Versionsstand. Das Skript sichert
sie lokal:

- **Quelle:** `connectionProfile.baseUrl` + `configPath` aus
  `<project>/public/app-config/viewer-editor-app-config.v1.json` im Config-Repo. Projekte ohne diese Datei
  werden bei `--all` übergangen und bei expliziter Nennung als Fehler gemeldet.
- **Ziel:** `<project>/settings-backups/<updatedAt>/` mit einer Datei pro Attribut des Single Types:
  `settings.json`, `wording.json`, `mappings.json` (und jedes später ergänzte Attribut), jeweils unverändert.
  Strapis Systemfelder (`id`, `documentId`, `createdAt`, `updatedAt`, `publishedAt`, `locale`) und die
  Quell-URL stehen in `_meta.json`. Der Ordner liegt außerhalb von `public/` und gelangt nicht in den Build.
  Der Ordnername kommt aus dem `updatedAt` des Servers: Existiert er schon, wird nichts geschrieben
  (`unchanged`).
- **Auth:** ohne Token (der Endpoint ist öffentlich lesbar). Optional `VIEWER_SETTING_TOKEN` (JWT oder
  API-Token) in der `.env.local` dieses Repos oder in der Umgebung; wird als `Bearer` gesendet.
- **Wiederherstellen:** im Strapi-Admin den Inhalt von `<attribut>.json` in das gleichnamige JSON-Feld des
  Single Types kopieren, speichern und veröffentlichen.
- Exit-Code `1`, wenn ein Projekt fehlschlägt; die übrigen werden trotzdem gesichert.
- Code: `build-tools/settingsBackup.js` (Logik), `build-tools/backupSettings.js` (CLI). Tests:
  `build-tools/settingsBackup.test.js`.

### Dump aller Items einer Collection (`pnpm items:dump`)

```bash
pnpm items:dump xylothek-index-cards                                   # Collection aus viewer-setting.itemsPath
pnpm items:dump xylothek-index-cards --collection /api/collection-items  # andere Collection
pnpm items:dump --all [--page-size 100]
```

- **Quelle:** `connectionProfile.baseUrl` wie beim Settings-Backup; Collection ist `itemsPath` (Legacy
  `item_path`) des `viewer-setting`, außer `--collection` ist gesetzt. Seitenweise (`pagination[pageSize]`,
  Default 100), mit `populate=*` (Relationen/Komponenten der ersten Ebene) und `sort=id:asc` – beides nur,
  wenn der Pfad nicht selbst `populate`/`sort` setzt.
- **Ziel:** `<project>/item-dumps/<collection>/<Abrufzeit>/items.json` (Rohzeilen, unverändert) und
  `_meta.json` (`source`, `itemsPath`, `count`, `fetchedAt`). Jeder Lauf schreibt einen neuen Ordner. Ein
  HTTP-Fehler auf einer Seite bricht das Projekt ab; ein Teil-Dump wird nicht geschrieben.
- **Größe:** der Index-Karten-Dump hat ~18 000 Items / ~20 MB.
- **Auth:** wie oben, optional `VIEWER_SETTING_TOKEN`.
- Code: `build-tools/itemsDump.js` (Logik), `build-tools/dumpItems.js` (CLI), gemeinsames Env-Setup beider
  CLIs in `build-tools/cliEnv.js`. Tests: `build-tools/itemsDump.test.js`.

### Feldkonfiguration zwischen Collections angleichen (`pnpm fields:sync`)

```bash
pnpm fields:sync                                    # Menü (nur im Terminal)
pnpm fields:sync check xylothek-index-cards --from index_cards --to collection_items --field collectors
pnpm fields:sync sync  xylothek-index-cards --from index_cards --to collection_items --field collectors [--yes]
```

Gegenstück zum Kopieren von Komponenten beim Ableiten ([12.12](#1212-items-ableiten)): ein kopiertes Feld
erscheint im Ziel nur richtig, wenn es dort dieselbe Struktur und dieselbe Feldkonfiguration hat.

- **Collections** sind die Attribute des `viewer-setting` mit `itemsPath` und `fields` (v2-Layout, z. B.
  `index_cards`, `collection_items`); das v1-Attribut `settings` wird nicht angeboten und nicht angefasst.
  Felder werden über denselben Schlüssel in Quelle und Ziel verglichen.
- **check** (nur lesend): Strapi-Schema des Felds in beiden Collections (`GET
  /api/content-type-builder/content-types`, Content-Type über den Plural-Namen aus `itemsPath`): gleicher
  Typ, bei Komponenten gleiche UID und gleiches `repeatable`. Dann die Viewer-Konfiguration: in beiden
  konfiguriert? Unterschiede als Schlüsselpfade (`autosuggest.prioritize: — → {…}`). Exit `0` gleiche Struktur
  und identisch, `1` Unterschiede bzw. Schema-Problem, `2` Fehler. Ohne Leserecht aufs Schema meldet der Check
  `schema not readable` statt abzubrechen.
- **Was „identisch" heißt:** alle Schlüssel außer `order` (Position im Formular der jeweiligen Collection).
  `prefillWith` wird nur übernommen, wenn das genannte Feld im Ziel konfiguriert ist; sonst entfällt es mit
  Hinweis. Check und Sync nutzen dieselbe Regel, nach einem Sync meldet der Check „identical".
- **sync:** verweigert, wenn der Strapi-Check scheitert oder das Feld in der Quelle fehlt; bei identischer
  Konfiguration passiert nichts. Sonst: Settings-Backup (`backupProject`, wie `settings:backup`) → Diff →
  Rückfrage `[y/N]` (Default nein; `--yes` überspringt sie, ohne Terminal ohne `--yes` wird nichts geschrieben)
  → `viewer-setting` frisch lesen → `PUT <configPath>` mit `{ data: { <Ziel-Attribut>: … } }` (nur dieses
  Attribut, darin nur dieses Feld) → erneut lesen und prüfen. Ein neues Feld kommt ans Ende der `order`.
- **Token:** `VIEWER_SETTING_TOKEN` aus `<project>/.env.local` bzw. `.env` im Config-Repo, sonst aus der
  `.env.local` dieses Repos bzw. der Umgebung. Sync braucht Schreibrecht auf den `viewer-setting`.
- **Menü** (auf stderr; Enter = Vorschlag, `b` zurück, `q` beenden, Ctrl+C bricht ab): Projekt → Quelle →
  Ziel (ohne die Quelle) → Feld (Komponenten zuerst, darin die auch im Ziel konfigurierten) → Operation.
  Jeder Lauf ist ein CLI-Aufruf, das Menü zeigt ihn an; danach geht es zurück zur Feldauswahl.

  ```
  Field:
    1) collectors  (component, configured in target)  (default)
    2) locations  (component, not in target)
  Choice [1] (b back, q quit):
  Operation for "collectors":
    1) check  (read only)  (default)
    2) sync   (writes the target config after a backup and a confirmation)
  > pnpm fields:sync check xylothek-index-cards --from index_cards --to collection_items --field collectors
  Field "collectors": index_cards → collection_items
    Strapi:  same structure — source: component metadata-forms.wikidata-reference, repeatable; target: …
    Viewer:  configured in source: yes; in target: yes
    Config:  2 difference(s) (target vs. source):
      autosuggest.alsoGetDataFrom: — → [{"propertyId":"P227","label":"GND"}]
      autosuggest.prioritize: — → {"claimPresence":{…}}
    Note:    prefillWith "ai_collector" is left out: the target has no field "ai_collector".
  ```

- Code: `build-tools/fieldConfigSync.js` (reine Logik: Collections, Schema-Vergleich, Diff, Zielkonfiguration),
  `build-tools/fieldSyncStrapi.js` (Lesen, Backup, Schreiben), `build-tools/fieldSyncMenu.js` (Menü, alle I/O
  injiziert), `build-tools/syncFieldConfig.js` (CLI). Tests: `fieldConfigSync.test.js`,
  `fieldSyncStrapi.test.js` (Fake-Strapi), `fieldSyncMenu.test.js` (geskriptete Sitzungen, CLI-Argumente).

---

## 3 Projektstruktur

### Root und Konfiguration

- `index.html` - Einstiegspunkt mit Mount-Node `#app`
- `vite.config.js` - Vite-Konfiguration (Vue-Plugin, `base`, Projekt-Modi)
- `build-tools/projectMode.js` - Projekt-Modi: Projektordner auflösen, `public/`-Overlay, `index.html`-Titel/Favicon
- `package.json` / `pnpm-lock.yaml` - Abhängigkeiten und Skripte
- `docs/` - `technical-documentation.md` (dieses Dokument), `conventions.md`, `changelog.md`
- `public/app-config/` - Grundkonfiguration `viewer-editor-app-config.v1.json` und Wording
  `wording.json`, beide zur Laufzeit geladen (siehe [4.2](#42-grundkonfiguration-publicapp-config))

### Einstieg

- `src/main.js` - Bootstrapping: lädt Grundkonfiguration und Wording (`loadBasicConfig`), mountet danach
- `src/App.vue` - Composition-Root: verdrahtet Komponenten, Stores, Composables, Watcher und Lifecycle

### Komponenten (`src/components/`)

- `ListPanel.vue` - Karten-/Listenpanel inkl. trennbarem Kopf-/Body-Rendering, Hierarchie-UI
  (Level-1-Boxen, einklappbare Level-2-Gruppen), Suchfeld mit Bereichsschalter und Trefferansicht
  der bestandsweiten Suche, Create-Button
- `ListItems.vue` - eine Liste von View-Items als Scan-Karten oder Zeilen (Suspend-Checkbox, Edit-Icon,
  optional der Ort eines Treffers); genutzt für flache Liste, Level-2-Gruppen und Suchtreffer
- `ItemFieldEditor.vue` - Sidebar-Feldeditor; rendert Felder über die Registry und optional die
  Raw-Data-Dev-Preview
- `UserConfigPanel.vue` - User-Config-GUI (Feldliste, globale Optionen, Anwenden)
- `ConfigurationPanel.vue` - dünner Wrapper, der `UserConfigPanel` im Tab fest geöffnet rendert
- `config/AutosuggestFieldConfig.vue` - GUI-Editor für autosuggest-spezifische Feldoptionen
- `ViewerWikidataField.vue` - Viewer-Wrapper für den Feldtyp `wikidata-autosuggest`
- `WikidataAutosuggestInput.vue` - generische Autosuggest-Eingabe (Konfiguration als Pass-through)
- `DataTransferControls.vue` - Upload/Download/Reset/Datenmodus/Beispieldaten im Header
- `DatabaseConnectionPanel.vue` - Tab `Einstellungen`: Verbindungsprofil, Verbindungstest,
  Datenmodell-Prüfung, Viewer-Einstellungen der Datenquelle und Anzeige/Download der Grundkonfiguration
- `OnlineAccessPanel.vue` - Offline/Online-Umschalter, Login/Logout, Status- und Save-Controls
- `ReplacementsPanel.vue` - Tab-Panel mit Ersetzungstabellen je Feld, Entfernen-Button je Regel,
  `Ersetzungen anwenden` und Statuszeile des letzten Laufs
- `ReplacementsUnit.vue` - Inline-Eingabe für neue Ersetzungen (Sidebar und Tab)
- `LightboxModal.vue` - Modal für die Scan-Vollansicht inkl. Fullscreen
- `StartFromScratchModal.vue` - Modal für den "Neu beginnen"-Flow
- `DeriveItemDialog.vue` - Bestätigungsdialog für `Item ableiten`: Vorschau der Werte, Hinweis aufs
  Vorab-Speichern, Ergebnis bzw. Fehler (siehe [12.12](#1212-items-ableiten))
- `DerivationRuleEditor.vue` - Editor der Ableitungsregel im Tab `Konfiguration` (unter der Feldkonfiguration)
- `InfoPanel.vue` - rendert den Info-Tab aus den sprachspezifischen Markdown-Quellen
- `footer/Identity.vue` - Footer-Identity mit Credit und Link zu den Berlin University Collections

### Composables (`src/composables/`)

- `useViewerData.js` - Datenmodell, Import/Parsing, Validierung, Suche, Sortierung, Edit-Logik
- `useDataImportExport.js` - Datei-Import/Export-Flow, Beispieldaten, Start-from-Scratch, Reset
- `useFieldMapping.js` - Label-/Placeholder-/Hint-/Sortier-Mapping und Binding an die Feld-Registry
- `useSelectionNavigation.js` - Auswahlindex, Vor/Zurück-Navigation, Auswahl aufheben
- `hierarchyConfig.js` - reine Hierarchie-Helfer: Feldlisten normalisieren, Hierarchie-Felder aus Settings auflösen, Level-1-/Level-2-Optionen aus Items zählen
- `useModalKeyboard.js` - gemeinsames Escape-Handling für Modals
- `useModalFocus.js` - Fokus in Modals: erstes Element fokussieren, Tab im Dialog halten, Fokus zurückgeben
- `replacementRules.js` - reine Regel-Logik der Ersetzungen (ersetzbare Felder, Matching, Diff-Berechnung)
- `useReplacementsApply.js` - Orchestrierung eines Ersetzungslaufs (lokal bzw. über die ganze Collection)
- `useWikidataSearch.js` - Wikidata-Suche inkl. Priorisierung, Claim-/Statement-Nachladen, Lokalisierung
- `userConfigValidation.js` - zentraler Validator für importierte bzw. geladene JSON-Config
- `connectionProfile.js` - Validator/Normalizer für Verbindungsprofile + URL-Join-Helper
- `publicConfigUrls.js` - Kandidaten-URLs und Fetch für Konfigurationsdateien in `public/`
- `usePendingOnlineChangesGuard.js` - Online-Sitzung, ungespeicherte Online-Änderungen und die Rückfrage vor dem Verwerfen
- `requestSequence.js` - "neuester Request gewinnt" für Ladevorgänge, die gemeinsamen State schreiben
- `searchQuery.js` - gemeinsame Suchregeln: Tokenisierung, Mindestlänge drei Zeichen
- `useCollectionSearch.js` - Suchbereich in der Hierarchie (Kategorie oder gesamter Bestand), Zustand der
  Trefferansicht, navigierbare Items (siehe [6.5](#65-bestandsweite-suche-in-der-hierarchie))
- `valueChecks.js` - `hasNonEmptyValue` (Grundlage für "bearbeitet")
- `useRemoteFieldModel.js` - lädt das Felder-Datenmodell der Online-Collection, sobald der Tab
  `Konfiguration` offen ist oder die bestandsweite Suche es braucht, einmal je Verbindung/Token/Collection
  (siehe [12.11](#1211-datenmodell-der-collection-felder-zum-hinzufügen))
- `useOnlineSave.js` - `Änderungen speichern` online (Items, dann Ersetzungsregeln); liefert `true`, wenn
  alles gespeichert wurde. `saveOnlineItemChanges(item)` ist `Item speichern` im Kopf des Editierbereichs:
  nur das offene Item (Update oder neues Item), alle anderen Änderungen und die Ersetzungsregeln bleiben
  pending
- `derivationRules.js` - reine Logik der Ableitungsregeln: Normalisieren, Regel je Quell-Collection,
  Validierung, Zielwerte (Kopie, Präfix, fester Wert) und Relation (`connect`)
- `useItemDerivation.js` - Ablauf von `Item ableiten` (Vorschau, Vorab-Speichern, Anlegen) und die
  Verdrahtung in `App.vue` (Button-Beschriftung, Sichtbarkeit des Regel-Editors)
- `useDerivationRuleDraft.js` - Entwurfszustand des Regel-Editors: Ziel-Collections, Datenmodell des Ziels,
  Fehler, Speichern
- `linkedItems.js` - reine Helfer für verknüpfte Items einer sekundären Collection: Konfigurations-Scope,
  Verknüpfungsziel, Schlüssel, Felder mit Defaults, Kopfzeile, Sprach-Fallback
- `useSecondaryItems.js` - verknüpfte Items je sekundärer Collection laden, bearbeiten, speichern, lösen,
  löschen; Konfiguration der Collection anwenden bzw. neu laden (siehe [12.13](#1213-collection-layout-und-verknüpfte-items))
- `csvFormat.js` - CSV lesen (`parseCsvRecords`, quote-aware über Zeilenumbrüche) und schreiben
  (`toCsvCell`); genutzt von Import, Export und Start-from-Scratch (siehe [9.3](#93-csv-import))

### Stores (`src/stores/`)

- `useAppConfigStore.js` - Grundkonfiguration (Laden, Normalisieren, Download), Viewer-Einstellungen der
  Datenquelle als Überlagerung, Sprache und Wording-Auflösung inkl. Backend-Merge
- `useUserConfigStore.js` - Feldkonfiguration und Aktionen (Add/Remove, Hinzufügen aus Datenschlüsseln,
  Reorder, Apply)
- `useDataTransferStore.js` - Datenmodus (JSON/CSV), Session-Persistenz, Dateinamenslogik
- `useReplacementsStore.js` - Ersetzungsregeln inkl. Snapshot, Change-Tracking, Export-Payload und
  Status des letzten Anwendungslaufs
- `useConnectionProfileStore.js` - Verbindungsprofil (fest aus der Grundkonfiguration oder vom Nutzer
  eingegeben und nach bestandenem Verbindungstest gespeichert), Datenmodell-Prüfung, JSON Import/Export
- `useOnlineModeStore.js` - App-Modus (`offline`/`online`, online nur mit Verbindungsprofil) und
  `Configuration only`-Schalter
- `useAuthStore.js` - Strapi-FE-User-Auth (Login/Logout/Session-Restore)
- `useOnlineSettingsStore.js` - Laden **und Zurückschreiben** der Online-Settings inkl. Backend-Wording
- `useOnlineItemsStore.js` - Laden der Online-Items: Hierarchie-Erkennung, Level-1-Optionen
  (aus Strapi oder `firstLevelStaticList`), gefiltertes Nachladen je Level-1-Wert, bestandsweite
  Serversuche (`searchOnlineItems`), Sanitizing
- `useDerivationRulesStore.js` - Ableitungsregeln (`viewer-setting.mappings`) der geöffneten Datenquelle
  und Speichern einer Regel
- `useOnlineUpdatesStore.js` - Delta-Tracking für Updates, Draft-Creates und Ersetzungsläufe über die
  gesamte Collection, Save-Orchestrator, Save-Status

### Feldtypen (`src/fields/`)

- `fieldRegistry.js` - zentrale Registry und Field-Contract (Rendering, Defaults, Value-Mapping)
- `wikidataAutosuggestField.js` - Registry-Eintrag und Wertnormalisierung für `wikidata-autosuggest`

### Services (`src/services/`)

- `strapiApi.js` - Basis des Strapi-HTTP-Zugriffs (`strapiFetchJson` mit Timeout und Fehlerform), Login,
  `/api/users/me`, Settings lesen/schreiben,
  Query-Aufbau (Pagination/Populate/Fields/Filter), paginiertes Item-Fetching, Item-Create/Update,
  Item- und Wikidata-Normalisierung, Datenmodell-Prüfung
- `strapiSearch.js` - bestandsweite Textsuche mit Strapi-Filtern (`$containsi`): durchsuchbare Felder,
  Filteraufbau, Wiederholung ohne abgelehnte Felder, Trefferobergrenze (`MAX_SEARCH_HITS`)
- `strapiDataModel.js` - Felder der Collection hinter `itemsPath`: aus dem Content-Type-Schema oder,
  ohne Leserecht darauf, aus einem Beispiel-Item; Liste der Collection-Types (Ziele der Ableitungsregeln)
- `strapiMappings.js` - Schreiben der Ableitungsregeln (`PUT <configPath>` mit `{ data: { mappings } }`)
- `strapiCollectionConfig.js` - Collection-Layout: Settings-Datensatz roh lesen, ein Collection-Attribut
  frisch lesen und schreiben, verknüpfte Items laden, lösen und löschen
- `viewerSettingsLayout.js` - liest den Settings-Datensatz als v1 oder v2 (Collection-Layout) und führt
  geänderte Settings bzw. Ersetzungen in ein Collection-Attribut zurück

### Assets (`src/assets/`)

- `styles/index.scss` - globaler Styling-Einstieg; Layer `tokens/`, `base/`, `layout/`, `components/`,
  `legacy.scss`
- `styles/components/_index.scss` - Ausnahme-Layer für notwendige globale Sonderfälle
- `texts/info-de.md`, `texts/info-en.md` - Markdown-Quellen für den Info-Tab
- `icons/` - SVG-Icons für Editor-Controls (`arrow-down`, `edit-3`, `eye`, `eye-off`,
  `maximize-2`, `minimize-2`)
- `logos/` - Logo für den Footer (`dns-v1.svg`)

### Statische Dateien (`public/`)

- `sample-data.json` (mit `config`), `sample-data.csv` - Beispieldaten je Datenmodus
- `sample-card-1.jpg` … `sample-card-3.jpg` - Beispielscans für die Kartenansicht
- `app-config/viewer-editor-app-config.v1.json`, `app-config/wording.json` - Grundkonfiguration und Wording

### Tests

Alle Tests liegen neben ihrem Modul (`*.test.js`); Inhalte siehe [Kapitel 16](#16-testabdeckung).

---

## 4 Konfiguration und Wording

### 4.1 Zwei Ebenen

Es gibt genau zwei Konfigurationsebenen:

1. **Grundkonfiguration** - eine JSON-Datei, die neben dem Build in `public/app-config/` liegt und vor
   dem ersten Rendern geladen wird (siehe [4.2](#42-grundkonfiguration-publicapp-config)).
2. **Konfiguration der Datenquelle** - offline das `config`-Objekt der hoch- bzw. heruntergeladenen
   JSON-Datei, online `viewer-setting.settings` in Strapi (siehe [4.3](#43-konfiguration-der-datenquelle)).

Präzedenzregel: **Datenquelle vor Grundkonfiguration, Schlüssel für Schlüssel.** Wird die Datenquelle
geschlossen (Import ohne `config`, CSV-Import, Verlassen des Online-Modus, Logout), gilt wieder die
Grundkonfiguration.

Die Schlüssel sind nach Rolle gruppiert:

| Gruppe | Schlüssel | Ablage |
| --- | --- | --- |
| Bootstrap | `connectionMode`, `connectionProfile` | nur Grundkonfiguration (ein vom Nutzer eingegebenes Profil: siehe [12.1](#121-verbindungsprofil)) |
| Viewer-Einstellungen | `language`, `languageMode`, `primaryColor`, `dataInspectionMode` | Grundkonfiguration als Default, Datenquelle überschreibt |
| Feldkonfiguration | `fields`, `itemLabelField`, `markAsEditedBasis`, `showOnlyNonEmptyFields`, `hierarchyFields`, `firstLevelStaticList` | nur Datenquelle, kein Default (siehe [Kapitel 7](#7-user-config-tab-konfiguration)) |
| Anbindung (online) | `itemsPath`, `scanField`, `createKeyField` | nur `viewer-setting.settings` |
| Wording | Handle → Sprachmap | `public/app-config/wording.json`; online zusätzlich `viewer-setting.wording` |
| Ersetzungen | `replacements` | Datenquelle (siehe [Kapitel 11](#11-ersetzungen-replacements)) |
| Funktionsschalter | `deriveItems` | nur Grundkonfiguration (siehe [12.12](#1212-items-ableiten)) |
| Ableitungsregeln | `mappings` | nur online, eigenes Prop `viewer-setting.mappings` (siehe [12.12](#1212-items-ableiten)) |
| Collection-Layout | `primaryCollection`, `secondaryCollections`, `appTitle` | nur Grundkonfiguration (siehe [12.13](#1213-collection-layout-und-verknüpfte-items)) |

Im **Collection-Layout** (Grundkonfiguration mit `primaryCollection`) teilen sich mehrere Deployments
einen `viewer-setting`. Dort liegen Feldkonfiguration, Anbindung und Ersetzungen je Collection in einem
eigenen JSON-Prop; die Viewer-Einstellungen kommen dann nur aus der Grundkonfiguration.

Konfiguration wird nicht im Browser gespeichert. Einzige Ausnahme ist ein vom Nutzer eingegebenes
Verbindungsprofil (siehe [Kapitel 5](#5-browser-persistenz)).

### 4.2 Grundkonfiguration (`public/app-config/`)

Der Dateiname ist fest: `viewer-editor-app-config.v1.json` (`BASIC_CONFIG_FILE` in
`useAppConfigStore.js`).

```json
{
  "version": 1,
  "connectionMode": "switchable",
  "connectionProfile": null,
  "language": "de",
  "languageMode": "multi",
  "primaryColor": "#0066CC",
  "dataInspectionMode": false,
  "deriveItems": false
}
```

| Schlüssel | Werte (Default) | Wirkung |
| --- | --- | --- |
| `connectionMode` | `switchable` \| `offline` \| `online` (`switchable`) | `switchable` zeigt den Umschalter `Offline \| Online`; `offline`/`online` fixieren den App-Modus. |
| `connectionProfile` | Objekt `{ label?, baseUrl, configPath }` oder `null` | Fest vorgegebenes Strapi-Profil; im Tab `Einstellungen` nur lesbar. Ein ungültiges Profil wird als `null` behandelt und per `console.warn` gemeldet. |
| `language` | Sprachcode (`de`) | Startsprache |
| `languageMode` | `single` \| `multi` (`multi`) | Nur bei `multi` erscheint der Umschalter `DE \| EN`. |
| `primaryColor` | CSS-Farbe (`#0066CC`) | wird als `--color-primary` gesetzt (siehe [Kapitel 15](#15-styling-und-responsiveness)) |
| `dataInspectionMode` | `true` \| `false` (`false`) | blendet im Sidebar-Editor `show/hide raw data` und `Copy raw data` ein |
| `deriveItems` | `true` \| `false` (`false`) | schaltet `Item ableiten` ein (nur online; nur ein literales `true` gilt), siehe [12.12](#1212-items-ableiten) |
| `primaryCollection` | Name eines JSON-Props von `viewer-setting` (`''`) | schaltet das Collection-Layout ein: diese Collection ist die Liste; ohne Wert gilt `viewer-setting.settings` wie bisher, siehe [12.13](#1213-collection-layout-und-verknüpfte-items) |
| `secondaryCollections` | Liste von Prop-Namen (`[]`) | Collections, deren verknüpfte Items unter dem gewählten Item erscheinen (nur mit `primaryCollection`) |
| `appTitle` | Sprachmap oder `null` | App-Titel des Deployments; schlägt `wording.appTitle` der Datenquelle |

- **Laden:** `main.js` ruft `loadBasicConfig()` auf und mountet die App erst danach. Grundkonfiguration
  und `wording.json` werden parallel über `resolvePublicConfigUrls(..., 'app-config')` und
  `fetchFirstAvailableConfigText` (`src/composables/publicConfigUrls.js`) geladen: ein Dateiname wird
  unter den Präfixen `location.pathname`, `import.meta.env.BASE_URL` und `/` gesucht.
- **Fehlerfall:** fehlt eine Datei oder ist sie ungültig, gelten die fest eingebauten Defaults der
  Normalizer bzw. die Inline-Fallbacks der `t()`-Aufrufe. Die App startet immer; der Grund steht in
  `lastBasicConfigLoadError` und als `console.warn`.
- **Anzeige und Erzeugen:** Der Bereich `Grundkonfiguration` im Tab `Einstellungen` zeigt die Werte nur an.
  Änderungen an den Viewer-Einstellungen werden im Bereich darüber mit der Datenquelle gespeichert (siehe
  [4.3](#43-konfiguration-der-datenquelle)). `Grundkonfiguration als JSON herunterladen`
  (`exportBasicConfigAsJson(draft)`) erzeugt die Datei für `public/app-config/`; die Option
  `Verbindungsprofil in die Datei übernehmen` fügt das aktuelle Profil als festes `connectionProfile` ein.
- **Altlast:** ein früher gespeicherter localStorage-Eintrag `viewerEditor.appConfig.v1` wird beim Laden
  entfernt und nicht mehr gelesen.

### 4.3 Konfiguration der Datenquelle

| | Offline (JSON-Datei) | Online (`viewer-setting`) |
| --- | --- | --- |
| Viewer-Einstellungen | `config.language`, `config.languageMode`, … | `settings.language`, `settings.languageMode`, … |
| Feldkonfiguration | `config.fields`, … | `settings.fields`, … |
| Wording | - (nur `wording.json`) | `wording` |
| Ersetzungen | `replacements` | `replacements` |
| Ableitungsregeln | - | `mappings` |

- Die Viewer-Einstellungen liegen flach neben den Feldkonfigurations-Schlüsseln. Nur vorhandene, gültige
  Schlüssel überschreiben (`pickViewerSettings`); eine Datenquelle ohne sie nutzt die Grundkonfiguration.
- `useAppConfigStore` hält sie in `dataSourceViewerSettings`; `primaryColor`, `languageMode` und
  `dataInspectionMode` sind computed über Grundkonfiguration plus Datenquelle.
- `language` der Datenquelle setzt die Sprache beim Öffnen. Der Umschalter `DE | EN` ändert sie danach
  nur für die Sitzung. Endet eine Überschreibung der Sprache, gilt wieder die Sprache der
  Grundkonfiguration; ohne Sprach-Überschreibung bleibt die Wahl des Nutzers stehen.
- Gesetzt werden sie beim JSON-Import mit gültiger `config` (`useDataImportExport`) und nach dem Laden der
  Online-Settings (`App.vue`); geleert bei jedem anderen Import und beim Schließen der Online-Datenquelle.
- Der Validator prüft die Typen (`language` nicht-leerer String, `languageMode` `single`/`multi`,
  `primaryColor` nicht-leerer String, `dataInspectionMode` Boolean).

**Bearbeiten im Tab `Einstellungen`:** Der Bereich `Viewer-Einstellungen` ist nur bei geöffneter
Datenquelle aktiv (offline: Daten geladen; online: angemeldet und Settings geladen).
`Auf Datenquelle anwenden` setzt alle vier Werte als Überschreibung, `Werte der Grundkonfiguration
verwenden` entfernt sie.

- Offline: der Stand wird `isDirty`, die Werte gehen mit dem nächsten JSON-Download in `config`; ein
  CSV-Datenmodus schaltet auf JSON um.
- Online: `buildMergedOnlineSettings()` in `App.vue` schreibt sie wie `Konfiguration anwenden` per
  `PUT <configPath>` zurück (siehe [12.7](#127-settings-write-back-konfiguration-anwenden-im-online-modus))
  und ändert damit den Viewer für alle Nutzer dieser Instanz.

### 4.4 Wording, Backend-Merge und Sprachen

- `public/app-config/wording.json` enthält pro Handle eine Sprachmap, z. B.
  `{ "tabEdit": { "de": ..., "en": ... } }`. Jeder `t(key, fallback)`-Aufruf in `src/` trägt einen
  Inline-Fallback.
- `t(key, fallback)` löst gegen die aktive Sprache auf; Fallback-Kette:
  aktive Sprache → `de` → `en` → übergebener Fallback.
- Online-Settings können ein eigenes Wording mitliefern (`response.data.wording`). Nach erfolgreichem
  Settings-Load ruft `App.vue` `setOnlineWording(result.wording)` auf; beim Verlassen des Online-Modus
  bzw. bei fehlgeschlagenem Load wird `clearOnlineWording()` aufgerufen. Offline gibt es nur das lokale
  Wording.
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

Alle Schlüssel sind mit `viewerEditor.` präfixiert und versioniert. Zugriffe auf den Storage sind gegen
nicht verfügbaren Storage abgesichert. Konfiguration liegt nicht im Browser; die einzige Ausnahme ist ein
vom Nutzer eingegebenes Verbindungsprofil.

| Schlüssel | Storage | Owner | Inhalt | Restore | Löschen/Ersetzen |
| --- | --- | --- | --- | --- | --- |
| `viewerEditor.connectionProfile.v1` | localStorage | `useConnectionProfileStore` | vom Nutzer eingegebenes Verbindungsprofil (`version`, `label`, `baseUrl`, `configPath`, `updatedAt`) | `initializeConnectionProfile()` beim App-Start, nur wenn die Grundkonfiguration kein Profil mitbringt | `Gespeichertes Profil löschen`; Speichern/Import (nach bestandenem Verbindungstest) ersetzt |
| `viewerEditor.authToken.v1` | localStorage | `useAuthStore` | Strapi-JWT | `restoreSession()` beim App-Start (holt anschließend `/api/users/me`) | Logout und fehlgeschlagener Restore entfernen den Token |
| `viewerEditor.appMode.v1` | localStorage | `useOnlineModeStore` | App-Modus `offline` \| `online` | beim App-Start; ein fixierter `connectionMode` hat Vorrang; `online` ohne Profil wird zu `offline` | Moduswechsel schreibt neu |
| `viewerEditor.onlineConfigOnly.v1` | localStorage | `useOnlineModeStore` | Schalter `Configuration only` | beim App-Start | Toggle im Header schreibt neu |
| `viewerEditor.dataMode.v1` | **sessionStorage** | `useDataTransferStore` | aktiver Datenmodus `json` \| `csv` | beim Start der Session | Moduswechsel schreibt neu |

Entfernte Altlasten: `viewerEditor.appConfig.v1` (localStorage, App-Settings-Snapshot) und
`viewerEditor.userConfig.v1` (sessionStorage, Kopie der Feldkonfiguration) werden beim Start gelöscht und
nicht mehr gelesen.

Nicht im Browser persistiert werden Items, Feldkonfiguration, Ersetzungsregeln, Auswahl und Dirty-State:
sie leben nur im Speicher und gehen beim Reload verloren. Ihre Ablage ist die Datenquelle - offline die
exportierte JSON-Datei, online Strapi (siehe [11.4](#114-persistenz-der-regeln)).

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
- `tokenizeSearchQuery(query)` (`searchQuery.js`) normalisiert und splittet die Suchanfrage; dieselben
  Regeln gelten für die Serversuche (siehe [6.5](#65-bestandsweite-suche-in-der-hierarchie)).
- **Die Suche greift erst ab drei Zeichen** (`MIN_SEARCH_QUERY_LENGTH`); kürzere Eingaben filtern nicht.
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

### 6.5 Bestandsweite Suche in der Hierarchie

Ohne Hierarchie deckt die lokale Suche alle geladenen Items ab. Mit Hierarchie bestimmt
`useCollectionSearch` den **Suchbereich**:

- **Ist eine Level-1-Kategorie gewählt**, sucht die Suche nur in ihr (wie bisher).
- **Ist keine gewählt**, sucht sie im gesamten Bestand.
- Der Schalter **Gesamter Bestand** neben dem Suchfeld erzwingt innerhalb einer Kategorie die
  bestandsweite Suche. Ohne Auswahl ist er angehakt und gesperrt. Er wird nicht gespeichert.

Im bestandsweiten Bereich ersetzt eine **Trefferansicht** den Level-2-Baum: eine flache Liste mit dem
Ort jedes Treffers (`Level-1 / Level-2`, leere Werte als "Ohne Zuordnung") und dem Knopf
`Zurück zu den Kategorien`.

- **Offline** liegen alle Items im Speicher; die Trefferansicht filtert live (ab drei Zeichen). Zurück
  leert die Suchanfrage. Zurück und das Abschalten des Schalters schließen das geöffnete Item, weil es
  außerhalb der wieder gezeigten Kategorie liegen kann.
- **Online** startet die Suche erst mit Enter oder dem Knopf `Suchen` (jede Suche ist ein paginierter
  Server-Durchlauf). `searchOnlineItems` sucht serverseitig (siehe [12.4](#124-query-aufbau)); die Treffer
  ersetzen die geladenen Items über denselben Weg wie ein Kategoriewechsel (`replaceOnlineItems` in
  `App.vue`): Rückfrage bei ungespeicherten Änderungen, Request-Sequenz, Config-Apply. Die Suchanfrage
  bleibt danach als lokaler Filter über den Treffern stehen. Treffer lassen sich bearbeiten und speichern
  wie Items einer Kategorie. Zurück (Knopf, leere Anfrage + Enter, Abschalten des Schalters) lädt die
  gewählte Kategorie neu bzw. leert die Liste ohne Auswahl; ein Klick auf eine Level-1-Box verlässt die
  Treffer ebenfalls. Es gibt **keine Obergrenze** für die Trefferzahl.

Trefferzähler im Listenkopf und Vor/Zurück folgen dem, was die Liste zeigt (`navigableViewItems`): in einer
Kategorie nur deren Treffer, in der Trefferansicht alle.

---

## 7 User-Config (Tab `Konfiguration`)

Die User-Config ist modularisiert: `UserConfigPanel.vue` kapselt die GUI, `useUserConfigStore.js` State
und Aktionen, `App.vue` orchestriert nur (Apply, Datenfluss). Gerendert wird sie im Tab `Konfiguration`,
dort dauerhaft geöffnet.

**Die Feldkonfiguration hat keinen Default.** Sie kommt immer aus der Datenquelle (`config` der JSON-Datei
bzw. `viewer-setting.settings`, siehe [4.1](#41-zwei-ebenen)). Jeder Import setzt sie zuerst zurück
(`initializeUserConfig()`) und wendet dann eine mitgelieferte `config` an. Eine Datenquelle ohne `config`
(reines JSON-Array, CSV) startet ohne Felder - außer offline beim ersten Laden, siehe oben; es wird nichts
aus den Datenschlüsseln abgeleitet und nichts im Browser zwischengespeichert.

`Feld hinzufügen` ist ein **Dropdown der noch nicht konfigurierten Felder**: online die Felder des
Strapi-Datenmodells mit ihrem Strapi-Typ (`label (string)`, siehe
[12.11](#1211-datenmodell-der-collection-felder-zum-hinzufügen)), danach die Schlüssel der geladenen
Items (`availableFieldKeys`, ohne reservierte Schlüssel). Online ist das Datenmodell nötig, weil die
geladenen Items nur die schon konfigurierten Felder enthalten; neue Strapi-Felder tauchen dort nie auf.
Die letzte Option `Eigener Feldname ...` blendet ein Textfeld für freie Namen ein; gibt es nichts
anzubieten (offline ohne Daten), steht nur das Textfeld da. Daneben `Alle hinzufügen`
(`addUserConfigFieldsFromDataKeys`; lässt strukturierte Felder - Relationen, Medien, Komponenten, JSON -
aus, die das Dropdown einzeln weiter anbietet) und online `Datenmodell neu laden`. Hinzugefügte Felder erhalten
den zum Strapi-Typ passenden Viewer-Typ (`text`/`richtext` → `text`, `integer`/`biginteger` → `integer`,
`boolean` → `checkbox`, sonst `normal`); wirksam werden sie mit `Konfiguration anwenden`. Nicht konfigurierte Schlüssel bleiben in den Daten erhalten: `Konfiguration
anwenden` entfernt nur Felder, die zuvor angewendet und dann aus der Konfiguration gelöscht wurden.

Offline ist der Tab immer nutzbar, auch ohne geladene Daten; dann steht über dem Formular ein Hinweis, dass
die Konfiguration mit den Daten gespeichert wird. Eine so vorbereitete Konfiguration bleibt beim ersten
Laden von Daten ohne eigene `config` erhalten und wird auf die Items angewendet
(`prepareFieldConfigForNewData` in `useDataImportExport`); `Neu beginnen` übernimmt sie in die `config`
des erzeugten Datensatzes. Bringen die Daten eine eigene `config` mit oder waren schon Daten geladen, wird
die Feldkonfiguration ersetzt. Online ist der Tab nutzbar, sobald gültige Online-Settings vorliegen, auch
ohne geladene Items (`Configuration only`).

### 7.1 Optionen pro Feld

Reservierte Schlüssel (`scan`, `suspendEditing`, `__onlineMeta`) erscheinen nicht als konfigurierbare
Datenfelder. Pro konfiguriertem Feld einstellbar:

- `type`: `normal`, `text`, `integer`, `checkbox`, `candidate`, `wikidata-autosuggest`
- `label` - alternative Feldbeschriftung
- `placeholder` - Platzhaltertext im Eingabefeld
- `hint` - Hinweistext unter dem Eingabefeld
- `fieldWidth` - Layoutbreite im Sidebar-Editor (`33%`, `50%`, `100%` für 3/2/1 Felder pro Zeile;
  ungültige Werte fallen auf `100%` zurück)
- `readOnly` (nicht für `wikidata-autosuggest`) - sichtbar, aber nicht editierbar
- `hidden` (alle Typen) - Feld erscheint nicht im Sidebar-Editor, bleibt aber in den Daten und in
  der Konfiguration; so kann es weiter als `prefillWith`-Quelle dienen
- `prefillWith` (alle Typen außer `checkbox`, Spalte "Prefill") - Dropdown auf ein `normal`-Feld.
  Bei `wikidata-autosuggest` wird dessen Wert als Suchtext vorbefüllt (siehe [7.3](#73-zusatzoptionen-für-wikidata-autosuggest)).
  Bei allen anderen Typen zeigt ein leeres Feld den Wert als Vorschlag (graue Kursivschrift auf grauem
  Feld, `components/FieldEditorControl.vue`); gespeichert wird erst mit dem Haken rechts im Feld, mit
  Enter (Strg+Enter im Textfeld) oder beim Bearbeiten. Das x rechts im Feld verwirft den Vorschlag bzw. den vorbefüllten
  Suchbegriff, bis das Item erneut geöffnet wird. Felder mit Vorschlag bleiben auch bei
  `showOnlyNonEmptyFields` sichtbar. Ältere Configs mit `autosuggest.prefillWith` werden beim Laden
  nach `prefillWith` verschoben.
- Reihenfolge per Drag-and-Drop; entfernt wird ein Feld mit dem x am Zeilenende

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
- `hierarchyFields` - frei editierbare Liste von Feldschlüsseln für die Hierarchie. Die ersten zwei
  Einträge bilden Level 1 und Level 2; ab zwei Schlüsseln ist die Hierarchie-Ansicht im Edit-Tab aktiv.
  Im Offline-Modus wirkt die **angewendete** Liste direkt (siehe [12.5](#125-hierarchie-und-level-1-buckets)),
  im Online-Modus bestimmen die Strapi-Settings die Hierarchie.
- `firstLevelStaticList` - Preset-Liste für Level-1-Werte (newline-/kommagetrennte Eingabe)

### 7.3 Zusatzoptionen für `wikidata-autosuggest`

GUI-Editierung aller `autosuggest`-Optionen in einem einklappbaren `Optionen`-Bereich:

- Basisoptionen (`searchLanguages`, `resultLanguage`, `minChars`, `limit`)
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
5. `useDataImportExport` setzt die Feldkonfiguration zurück, validiert eine eingebettete `config` strikt
   und wendet sie an, inklusive der Viewer-Einstellungen (siehe [4.3](#43-konfiguration-der-datenquelle)).
   Bei ungültiger `config` erscheint eine Fehlermeldung; die Daten bleiben ohne Feldkonfiguration geladen.
6. Bei Fehler wird `errorMessage` gesetzt und der alte Stand bleibt erhalten.

**Kopierstrategie:** Daten werden via `cloneData` (`JSON.parse(JSON.stringify(...))`) tief kopiert.
Vorteil: einfacher, stabiler Snapshot für Reset/Export. Einschränkung: nicht geeignet für
nicht-JSON-Typen (`Date`, `Map`, Funktionen).

### 9.3 CSV-Import

- CSV-Import nutzt `parseCsvText` in `src/composables/useViewerData.js`, das die Datensätze aus
  `parseCsvRecords` (`src/composables/csvFormat.js`) liest. Der Parser liest die Datei in einem Durchgang:
  ein Zeilenumbruch in einem quoted Wert gehört zum Wert (als `\n`), so dass ein exportierter
  mehrzeiliger Wert (Feldtyp `text`) wieder in seiner Zeile landet. Ein nicht geschlossenes
  Anführungszeichen ist ein Fehler mit Zeilenangabe; leere Zeilen werden übersprungen.
- Der erste Datensatz ist der Header, danach folgt das Mapping der Datensätze auf Objekte. Fehlermeldungen
  nennen die physische Zeile, in der der Datensatz beginnt.
- Header-Validierung: keine leeren und keine doppelten Spaltennamen.
- Zeilen-Validierung: mehr Spalten als im Header führen zu einem Parse-Fehler; fehlende trailing
  Spalten werden mit `''` aufgefüllt.
- Signifikante Leerzeichen bleiben erhalten: kein `trim()` vor dem Parsing; entfernt werden nur ein BOM am
  Dateianfang und das `\r` von CRLF-Zeilenenden (auch innerhalb quoted Werte wird `\r\n` zu `\n`). Gilt
  für quoted und unquoted Werte gleichermaßen.
- Das Feld `scan` wird bei der Header-Normalisierung case-insensitive auf `scan` gesetzt, damit die
  bestehende Scan-UI automatisch greift.

### 9.4 Start-from-Scratch

- Verfügbar nur im JSON-Modus ohne geladene Daten.
- Eingabe entweder einer einzelnen absoluten `http(s)`-Scan-URL oder eines CSV-Textes mit mehreren URLs
  (gelesen mit demselben Parser wie der CSV-Import);
  ungültige URLs werden mit Fehlermeldung im Modal abgewiesen.
- Erzeugt intern das Payload `{ data: [{ scan }], config: <vorbereitete Konfiguration inkl. Viewer-Einstellungen>,
  replacements: { allFields: {} } }`, importiert es über den normalen JSON-Pfad und markiert den Stand
  als dirty.

---

## 10 Export und Reset

- `createExportPayload()` liefert eine tiefe Kopie von `rawItems`.
- **JSON-Export** schreibt immer das kanonische Format
  `{ data: <items>, config: <user-config>, suspendedItems: <number[]>, replacements: <replacements> }`.
  `config` enthält neben der Feldkonfiguration die Viewer-Einstellungen, die die Datenquelle überschreibt.
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

Ersetzungen sind Regeln der Form `replacements[fieldKey][suchtext] = ersetzungstext`, die der Viewer
**auf ausdrückliche Nutzeraktion hin auf die Daten anwendet**. Der Schlüssel `allFields` steht dabei
für "alle Felder"; er ist ein regulärer Objektschlüssel im selben Namensraum wie echte Feldnamen.

### 11.1 Matching-Semantik

- **literal** (kein Regex), **Teilzeichenkette**, **Groß-/Kleinschreibung beachtend**
- Ersetzt werden **alle** Vorkommen im Feldwert; ein leerer Ersetzungstext löscht den Suchtext.
- Betroffen sind nur Felder der konfigurierten Typen `normal` und `text`, deren aktueller Wert ein
  String ist. Sichtbare Read-only-Felder sowie `scan`, `suspendEditing` und `__onlineMeta` bleiben
  ausgenommen. Ausgeblendete Felder (`hidden: true`) sind enthalten, auch wenn sie read-only sind:
  Read-only sperrt nur die Editorzeile, und ein ausgeblendetes Feld hat keine.
- `allFields` meint **jedes konfigurierte Feld** (User-Config bzw. Online-Settings), das nach diesen
  Regeln ersetzbar ist - Felder, die aus der Konfiguration entfernt wurden, sind nicht dabei.
- Reihenfolge je Feld: zuerst die `allFields`-Regeln, danach die feldspezifischen, jeweils in
  Einfügereihenfolge. Regeln wirken also nacheinander auf denselben Wert.
- Die Regel-Logik liegt ohne Vue-Abhängigkeit in `src/composables/replacementRules.js`
  (`collectReplaceableFieldKeys`, `collectRulesForField`, `computeReplacementChanges`).

### 11.2 Auslöser eines Laufs

Angewendet wird ausschließlich auf Nutzeraktion, ohne Dry-Run und ohne Bestätigungsdialog:

- beim Hinzufügen einer Regel (`ReplacementsUnit.vue`, Sidebar und Tab)
- über `Ersetzungen anwenden` im Tab `Ersetzungen`

Das bloße **Laden** von Regeln (JSON-Import, Online-Settings) wendet **nichts** an. Das Entfernen
einer Regel wirkt nur auf künftige Läufe - bereits ersetzte Werte bleiben ersetzt. Ein Undo gibt es
nicht; der Rückweg ist `Reset` bzw. der noch nicht gespeicherte Stand.

### 11.3 Wirkungsbereich eines Laufs

Orchestriert wird der Lauf in `src/composables/useReplacementsApply.js`:

- **Offline:** betroffen sind die geladenen Datensätze (`applyReplacementsToLoadedItems` in
  `useViewerData`). Die Änderungen sind sofort sichtbar, `_searchText` wird neu berechnet und
  `isDirty` gesetzt.
- **Online:** betroffen ist die **gesamte Collection**, nicht nur der geladene Ausschnitt:
  1. Geladene Items werden in place geändert (sofort sichtbar) und über `trackOnlineFieldChange(...)`
     als normale Feld-Deltas registriert.
  2. `trackOnlineReplacementUpdatesForRemainingItems(...)` (`useOnlineUpdatesStore`) lädt anschließend
     die Collection paginiert nach, überspringt die bereits geladenen Items anhand `__onlineMeta.id`
     und registriert für jeden weiteren Treffer ebenfalls ein Delta.
  - Der Lauf **schreibt nichts** direkt nach Strapi. Er erzeugt nur Pending-Updates, die der normale
    `Änderungen speichern`-Flow per `PUT` schreibt (siehe [12.8](#128-update-flow-bestehende-items)).
  - Im Hierarchie-Modus sind Änderungen an nicht geladenen Items daher erst nach dem Speichern und
    erneutem Laden des jeweiligen Level-1-Buckets sichtbar; die Zusammenfassung nennt beide Zahlen.
  - `Configuration only` verhindert den Collection-Durchlauf **nicht**: der Schalter steuert das
    Startverhalten, ein ausgelöster Ersetzungslauf greift bewusst auf die Collection zu.
- Status und Ergebnis des letzten Laufs (`applyStatus`, `lastApplySummary`, `lastApplyError`) liegen im
  `useReplacementsStore` und werden im Tab `Ersetzungen` als Zusammenfassung angezeigt.

### 11.4 Persistenz der Regeln

| Modus | Quelle beim Laden | Ziel beim Speichern |
| --- | --- | --- |
| Offline | `replacements` aus dem JSON-Import | JSON-Export (`{ data, config, suspendedItems, replacements }`) |
| Online | `data.replacements` des Settings-Singletons (Legacy-Fallback `data.settings.replacements`) | `PUT <configPath>` mit `{ data: { replacements } }` |

- Die Regeln liegen online in einem **eigenen JSON-Prop** `replacements` des Viewer-Settings-Typs,
  nicht im `settings`-Objekt. `Konfiguration anwenden`
  (siehe [12.7](#127-settings-write-back-konfiguration-anwenden-im-online-modus)) fasst sie damit
  nicht an, und umgekehrt.
- Geschrieben werden sie zusammen mit den Item-Änderungen über `Änderungen speichern`
  (`persistOnlineReplacements` → `updateViewerReplacementsInStrapi`). Der Save-Button ist im
  Online-Modus deshalb auch dann aktiv, wenn **nur** Regeln geändert wurden.
- Im Collection-Layout ([12.13](#1213-collection-layout-und-verknüpfte-items)) liegen die Regeln im
  Prop der primären Collection (`<collection>.replacements`), weil beide Collections gleichnamige
  Felder haben können. Geschrieben wird nur dieses Prop, nach erneutem Lesen.
- Fehlt das Prop in der Strapi-Instanz, schlägt das Speichern mit einer expliziten Meldung fehl
  (Anzeige über `settingsStatus`/`lastSettingsError` im `OnlineAccessPanel.vue`).
- Die Regeln sind zentral: Wer sie speichert, ändert sie für alle Nutzer dieser Strapi-Instanz.
- `initializeReplacements(payload)` setzt Wert und Snapshot (JSON-Import, Online-Settings-Load);
  `hasReplacementsChanges` vergleicht serialisiert gegen den Snapshot und beeinflusst Dirty-/Download-
  Zustand sowie den Online-Save-Button; `resetReplacements()` stellt den Snapshot wieder her;
  `clearReplacements()` leert beides (CSV-Import); `markReplacementsAsSaved()` synchronisiert den
  Snapshot nach erfolgreichem Schreiben.
- Ein Wechsel des Level-1-Buckets lässt die Regeln unangetastet.
- Der Validator prüft weiterhin nur, dass `replacements` ein Objekt ist; die innere Struktur wird
  nicht validiert.

### 11.5 UI

- **Eingabe:** `ReplacementsUnit.vue` (Sidebar und Tab) mit Dropdown `Feld`, das `alle Felder` sowie
  **nur die ersetzbaren** Feldschlüssel anbietet, dazu `Ersetze`/`mit` und den Button
  `zur Ersetzungsliste hinzufügen`. Nach dem Hinzufügen startet der Lauf.
- **Anzeige:** `ReplacementsPanel.vue` im Tab `Ersetzungen` gruppiert die Regeln je Feld, bietet je
  Regel einen Entfernen-Button, den Button `Ersetzungen anwenden` sowie die Statuszeile des letzten
  Laufs.

---

## 12 Online-Modus und Strapi-Integration

- Der App-Modus wird in `useOnlineModeStore.js` verwaltet (`offline`/`online`) und in `localStorage`
  persistiert. `connectionMode` aus der App-Config kann ihn fixieren; dann wird kein Umschalter angeboten.
- Login/Logout für Strapi-FE-Users laufen über `useAuthStore.js` + `strapiApi.js` (JWT +
  Session-Restore beim App-Start).
- Der gesamte HTTP-Zugriff liegt in `src/services/strapiApi.js`. `strapiFetchJson(...)` setzt
  `Accept`, bei Body `Content-Type` und bei vorhandenem Token `Authorization: Bearer ...`; Fehlerobjekte
  tragen `status` und `payload`, die Fehlermeldung stammt bevorzugt aus `payload.error.message`.
  - **Timeout:** jeder Request endet nach `READ_TIMEOUT_MS` (30 s, `GET`) bzw. `WRITE_TIMEOUT_MS`
    (60 s, sonst); ein optionales `signal` wird damit kombiniert. Timeout und Netzwerkfehler werden zu
    einem Fehler mit `status: 0` und `outcomeUnknown: true` - bei einem Schreibzugriff ist dann offen,
    ob der Server ihn ausgeführt hat (siehe [12.9](#129-create-flow-neues-item)).
  - **2xx ohne JSON** (z. B. eine Proxy- oder SPA-Fallback-Seite) ist ein Fehler; nur `204` liefert
    `null`. Früher kam `null` zurück, und die populate-Wiederholung in `fetchAllCollectionItemsFromStrapi`
    lief damit endlos.
  - **401 mit Token** meldet der Request an den per `setUnauthorizedHandler(...)` registrierten Handler
    (`useAuthStore.handleUnauthorized`, siehe [12.2](#122-login-modal)).
  - Wikidata-Requests (10 s) und die Config-Dateien aus `public/app-config/` (10 s) haben eigene Timeouts.

### 12.1 Verbindungsprofil

- Ein Profil besteht aus `version`, `label`, `baseUrl`, `configPath` und `updatedAt`
  (Validierung/Normalisierung in `src/composables/connectionProfile.js`: `baseUrl` ohne trailing Slash,
  `configPath` immer mit führendem Slash, nur `http`/`https`).
- **Die Auth-Endpunkte sind nicht Teil des Profils**, sondern fest verdrahtet: `/api/auth/local` für
  den Login und `/api/users/me` für den Nutzerabruf. Konfigurierbar ist nur `configPath` (Settings-Singleton).
- Die GUI liegt in `DatabaseConnectionPanel.vue` (Speichern, Verbindungstest, Datenmodell-Prüfung,
  JSON Import/Export). Persistenz siehe [Kapitel 5](#5-browser-persistenz).
- **Quelle:** `initializeConnectionProfile()` läuft in `onMounted` vor dem Wiederherstellen des App-Modus.
  - Bringt die Grundkonfiguration ein `connectionProfile` mit, ist es fest (`isProfileFixed`): das Formular
    ist nur lesbar, Speichern, Import und Löschen entfallen. Ein im localStorage gespeichertes Profil wird
    dann ignoriert, aber nicht gelöscht.
  - Sonst gilt das vom Nutzer eingegebene Profil aus localStorage.
- **Speichern** (`saveConnectionProfile`, auch beim JSON-Import) ist asynchron: das Profil wird validiert,
  dann läuft `testConnection`; nur bei bestandenem Test wird es gespeichert. `testConnection` ruft den
  Settings-Endpunkt ohne Token per `GET` und `POST /api/auth/local` mit Probe-Credentials auf und schlägt
  nur bei Netzwerkfehler oder `404` fehl.
- **Online ohne Profil:** Im Modus `switchable` bleibt die App bei `Online` ohne Profil offline
  (`isOnlineSwitchPending`) und öffnet den Tab `Einstellungen`; sobald ein Profil gespeichert ist,
  wechselt sie auf `online`, danach folgt der Login. Wird das Profil gelöscht, fällt ein
  `switchable`-Modus auf `offline` zurück. Bei fixiertem `connectionMode: online` ohne Profil startet die
  App im Tab `Einstellungen`; der Online-Fluss wartet auf ein gespeichertes Profil.

### 12.2 Login-Modal

- Im Online-Modus startet der Login über ein Modal, das per `Anmelden` geöffnet wird.
- `Identifier` und `Passwort` nutzen denselben globalen Input-Basissatz; die Passwortsichtbarkeit wird
  über Icon-Buttons (Eye/Eye-off SVG) umgeschaltet.
- Das Modal schließt bei Backdrop-Klick, Moduswechsel und nach erfolgreicher Authentifizierung.
- Authentifiziert zeigt der Header nur den Button `Abmelden` (kein zusätzliches User-Label).
- **Abgelaufene Sitzung:** Antwortet Strapi während einer Sitzung mit 401, setzt `handleUnauthorized`
  `authStatus: 'expired'` und `sessionExpired: true`, verwirft nur das Token und behält `user`.
  `hasOnlineSession` bleibt `true`: geladene Daten und ungespeicherte Änderungen bleiben stehen,
  der Header zeigt `Anmelden` und `Abmelden`, Speichern ist bis zum neuen Login gesperrt. Ein erneuter
  Login als **derselbe** Nutzer setzt die Sitzung fort (kein Neuladen); ein **anderer** Nutzer
  (`sessionUserId` ändert sich) lädt die Datenquelle neu. Ein fehlgeschlagener Neu-Login lässt die
  Sitzung offen. 401 beim Login selbst und beim Wiederherstellen eines gespeicherten Tokens zählen nicht
  als Ablauf.
- **Logout** verwirft nur die Kopie im Browser; das JWT bleibt bei Strapi bis zu seinem Ablauf gültig
  (users-permissions, Default 30 Tage, `jwt.expiresIn` in der Strapi-Konfiguration).
- **Rückfrage vor dem Verwerfen:** Logout, Wechsel auf `Offline`, der Toggle `Configuration only` und
  ein Verbindungsprofil mit anderer `baseUrl`/anderem `configPath` (Speichern, Import, Löschen) laden
  die Online-Daten neu. Stehen ungespeicherte Item-Änderungen oder geänderte Ersetzungsregeln an, fragt
  `usePendingOnlineChangesGuard` vorher (`onlineDiscardPendingConfirm`).

### 12.3 Initialisierungsfluss

Ein Watcher in `App.vue` reagiert auf App-Modus, Online-Sitzung (`hasOnlineSession`), Sitzungsnutzer
(`sessionUserId`), `Configuration only` sowie `baseUrl`/`configPath` des Profils. Ist der Modus nicht
`online` oder keine Sitzung offen, werden Online-Wording, Settings, Items und Updates geleert
(`closeOnlineDataSource`). Andernfalls läuft `loadOnlineDataSource` strikt sequenziell.

**Nur der neueste Lauf schreibt:** Datenquellen-Ladevorgänge und Level-1-Ladevorgänge
([12.5](#125-hierarchie-und-level-1-buckets)) teilen eine Request-Sequenz
(`src/composables/requestSequence.js`). Nach jedem `await` prüft ein Lauf `isCurrent()`; ist inzwischen
ein neuerer gestartet (Logout, Moduswechsel, Gruppenklick, …), bricht er ab, ohne zu schreiben. Ist die
Sitzung dann schon geschlossen, werden die Online-Stores erneut geleert, falls der veraltete Request sie
noch befüllt hat.

1. **Settings laden** (`fetchOnlineSettings` → `GET <configPath>`, erwartet ein Objekt unter
   `data.settings`; optionales `data.wording`, `data.replacements` und `data.mappings` werden mitgenommen;
   die Ableitungsregeln gehen in `useDerivationRulesStore`). Die
   geladenen Ersetzungsregeln gehen per `initializeReplacements(...)` in den Replacements-Store und
   bilden dort zugleich den Snapshot; **angewendet werden sie dabei nicht**
   (siehe [Kapitel 11](#11-ersetzungen-replacements)).
2. **Backend-Wording setzen** (`setOnlineWording`, siehe [4.4](#44-wording-backend-merge-und-sprachen)).
3. `itemsPath` aus den Settings lesen (`itemsPath`, Legacy-Fallback `item_path`) und das Datenmodell
   mit einer leeren Liste initialisieren (`online:<itemsPath>` als Anzeigename). Die Scan-Quelle wird
   analog aus `scanField` aufgelöst (siehe [12.6](#126-item-normalisierung-und-wikidata-mapping)).
4. **Settings-Config anwenden** (`applyImportedConfigPayload`) und die Viewer-Einstellungen aus
   `data.settings` übernehmen (`setDataSourceViewerSettings`, siehe [4.3](#43-konfiguration-der-datenquelle)).
   Ist `data.settings` nicht als gültige Config interpretierbar, geht die UI in einen expliziten
   Fehlerzustand (`markOnlineSettingsInvalid`) - kein stilles Weiterlaufen mit inkonsistentem Stand.
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
| `filterEmptyField` | `filters[$or][0][<key>][$null]=true`, `filters[$or][1][<key>][$eq]=` | Items ohne Wert im Feld (null oder leer), genutzt für den `isUnassigned`-Bucket |
| `extraFilterEntries` | beliebige fertige Paare, z. B. `filters[$and][t][$or][f][<key>][$containsi]=<token>` | Bestandsweite Suche (`strapiSearch.js`) |

**Bestandsweite Suche** (`searchCollectionItemsInStrapi`): Jedes Token muss in mindestens einem
durchsuchbaren Feld vorkommen (UND über Tokens, ODER über Felder, Groß-/Kleinschreibung egal) - dieselbe
Semantik wie die lokale Suche. Durchsucht werden die Felder aus `settings.fields` mit Typ `normal`, `text`,
`candidate` oder ohne Typ sowie die beiden Hierarchie-Felder; nicht durchsucht werden `checkbox`, `integer`
und `wikidata-autosuggest` (Relationen/Komponenten). Ebenfalls ausgelassen werden Felder, die im
Strapi-Datenmodell strukturiert sind (`isStructured`: Relation, Medien, Komponente, JSON, Blocks; siehe
[12.11](#1211-datenmodell-der-collection-felder-zum-hinzufügen)), auch wenn sie als `normal` konfiguriert
sind - einen Textfilter (`$containsi`) darauf wertet Strapi nicht aus, und der Fehler lässt sich nicht sicher einem Feld zuordnen. Das Modell
lädt `searchOnlineItems` über `loadExcludedFieldKeys` erst für eine gültige Anfrage; ist es nicht ladbar,
wird ohne Ausschluss gesucht. Lehnt Strapi ein Feld als `invalid key` ab, wird es entfernt und die Suche
wiederholt (höchstens einmal je Feld); die Trefferansicht nennt ausgelassene und entfernte Felder unter
`Auf dem Server nicht durchsucht`. Bleibt kein Feld übrig, schlägt die Suche mit einer Meldung fehl.

**Trefferobergrenze:** Mehr als `MAX_SEARCH_HITS` (500) Treffer werden nicht geladen.
`fetchAllCollectionItemsFromStrapi` mit `maxItems` bricht nach der ersten Seite ab, wenn
`meta.pagination.total` darüber liegt (ohne `total`: sobald die gesammelten Zeilen darüber liegen), und
wirft einen Fehler mit `code: 'TOO_MANY_ITEMS'`. Die Suche meldet dann `<n> hits - too many to load (limit
500). Please refine the search.`; die geladene Kategorie bleibt sichtbar.

Einzelne Items lädt `fetchCollectionItemFromStrapi(...)` (`GET <itemsPath>/<id>` mit optionalem
`populate[n]`); der Update-Flow nutzt das für die Konfliktprüfung (siehe [12.8](#128-update-flow-bestehende-items)).

`fetchAllCollectionItemsFromStrapi(...)` paginiert bis `meta.pagination.pageCount` und sammelt alle
Zeilen ein. Meldet Strapi einen ungültigen Query-Key (`invalid key <name>`) und ist dieser Name ein
aktuell gesetzter `populate`-Key, wird der Key entfernt und der Request wiederholt; andere Fehler werden
durchgereicht. Die Wiederholung steckt in `fetchDroppingInvalidPopulateKeys` (auch von der
Datenmodell-Prüfung genutzt) und ist begrenzt: jeder Versuch entfernt einen Key, also höchstens
`populateFields.length + 1` Requests. Damit funktioniert die App auch gegen Datenmodelle, in denen ein konfiguriertes
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
  `filters[<level1Feld>][$eq]=<Wert>`; zusätzlich wird clientseitig nachgefiltert. Der
  `isUnassigned`-Bucket (leerer Wert) filtert serverseitig über `filterEmptyField` (null oder leerer
  String). Lehnt Strapi diesen Filter mit HTTP 400 ab (z. B. bei einem Nicht-Text-Feld), wird die
  Collection ungefiltert geladen; clientseitig bleiben in beiden Fällen nur Items ohne Level-1-Wert
  (auch reine Leerzeichen zählen als leer).
- **Wechsel des Level-1-Buckets** lädt die Items neu und verwirft dabei ausstehende Online-Änderungen
  (`clearOnlineUpdates`). Gibt es welche, fragt die App vorher nach (`onlineDiscardPendingConfirm`);
  bei Abbruch bleibt der aktuelle Bucket samt Änderungen stehen. Während ein Bucket lädt, sind die
  Level-1-Boxen gesperrt (`hierarchyLoading`); kommt trotzdem ein älteres Ergebnis nach einem neueren an,
  wird es verworfen (Request-Sequenz, siehe [12.3](#123-initialisierungsfluss)).
- Die Level-1-Boxen werden im Hierarchie-Modus sofort gerendert, auch wenn noch keine Item-Karten geladen sind.

**Offline-Modus (lokale JSON-Datei).** Die Hierarchie kommt aus der angewendeten User-Config
(`appliedHierarchyFields`, also aus der `config` der importierten Datei oder aus `Konfiguration anwenden`).
Da alle Items im Speicher liegen, gibt es keine Nachlade-Requests; die reinen Funktionen in
`src/composables/hierarchyConfig.js` zählen Boxen und Gruppen direkt aus `rawItems`:

- Ohne `firstLevelStaticList`: alle gefundenen Level-1-Werte alphabetisch mit Trefferzahl, der
  `isUnassigned`-Bucket am Ende.
- Mit `firstLevelStaticList`: zuerst die Listeneinträge in Listenreihenfolge (Trefferzahl `0`, wenn kein
  Item den Wert trägt), danach alphabetisch die Werte aus den Daten, die in der Liste fehlen - damit
  bleibt kein Item unerreichbar -, der `isUnassigned`-Bucket zuletzt.
- Vor/Zurück in der Sidebar und das automatische Weiterschalten beim Aussetzen bleiben innerhalb der
  gewählten Level-1-Kategorie (`navigableViewItems` in `App.vue`). Online ist das ohne Wirkung, weil dort
  nur der geladene Bucket im Speicher liegt.

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

1. `buildMergedOnlineSettings()` in `App.vue` baut `{ ...bisherigeOnlineSettings, ...createUserConfigPayload() }`,
   entfernt daraus die vier Viewer-Einstellungen und fügt die aktuellen Überschreibungen der Datenquelle
   (`dataSourceViewerSettings`) wieder ein. Nicht vom Viewer bearbeitete Schlüssel (`itemsPath`,
   `scanField`, …) bleiben erhalten; Feldkonfiguration und Viewer-Einstellungen werden ersetzt. Derselbe
   Schreibweg dient dem Bereich `Viewer-Einstellungen` im Tab `Einstellungen`.
2. `useOnlineSettingsStore.persistOnlineSettings(mergedSettings)` ruft
   `updateViewerSettingsInStrapi(...)` auf: `PUT <configPath>` mit `{ data: { settings } }`.
3. Die Antwort muss erneut ein Objekt unter `data.settings` liefern, sonst Fehler. Bei Erfolg werden
   `settings` (und ggf. `wording`) aus der Antwort übernommen und `settingsStatus` auf `ready` gesetzt.
4. Bei Fehler bleibt der lokale Stand erhalten, `settingsStatus` wird `error` und `lastSettingsError`
   trägt die Meldung.

Im Collection-Layout schreibt `Konfiguration anwenden` statt `settings` das Prop der primären Collection:
`GET <configPath>`, Prop zusammenführen (gespeicherte `replacements` und `relations` bleiben, die
Viewer-Einstellungen fallen weg), `PUT <configPath>` mit `{ data: { <collection>: … } }`. Andere Props
werden nicht gesendet; so überschreiben sich zwei Deployments nicht gegenseitig.

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
- **Konfliktprüfung:** Je geändertem Feld merkt sich der Eintrag den beim Laden gesehenen
  Serverwert (`baselineFields`). Vor jedem `PUT` lädt der Save das Item neu
  (`fetchCollectionItemFromStrapi`) und vergleicht feldweise (`src/composables/onlineSaveConflicts.js`):
  Hat sich ein Feld auf dem Server geändert und entspricht weder dem geladenen noch dem zu sendenden
  Wert, wird das Item nicht geschrieben und der Save meldet die Felder. Die Serverwerte werden dabei zur
  neuen Baseline - ein zweites Speichern überschreibt also bewusst. Der Vergleich ist feldweise statt
  über `updatedAt`, weil bei Draft & Publish der gelesene und der geschriebene Stand verschiedene
  Zeitstempel tragen; Änderungen anderer an *anderen* Feldern sind kein Konflikt (es wird nur das Delta
  gesendet). Leere Werte (`null`, `''`, `[]`) gelten als gleich, Zahlen gleich ihrer String-Form.
- **Item speichern:** `saveOnlineItem({ item })` speichert nur den Pending-Eintrag des einen Items
  (Schlüssel aus `__onlineMeta`: `id` bzw. bei Entwürfen `draftId`), mit derselben Konfliktprüfung.
  Danach wird nur der Snapshot dieses Items aktualisiert; ist nichts mehr pending, gilt der Stand als
  gespeichert. Der Button ist online sichtbar und nur aktiv, wenn das Item Änderungen hat.
- **Änderungen während des Speicherns:** Nach dem `PUT` werden nur die Felder aus dem Pending-Stand
  entfernt, die noch den gesendeten Wert haben. Ein währenddessen erneut geändertes oder zurückgesetztes
  Feld bleibt pending (mit dem gesendeten Wert als Baseline). Für Entwürfe gilt dasselbe: Änderungen
  während des `POST` werden zu einem regulären Update des neu angelegten Items.
- Bei Vollerfolg synchronisiert `markAsSaved(...)` die Baseline; bei Teilfehlern bleibt ein
  konsistenter, retry-fähiger Pending-Stand erhalten.
- Im selben Speichervorgang werden geänderte **Ersetzungsregeln** nach Strapi geschrieben
  (siehe [11.4](#114-persistenz-der-regeln)). Der Save-Button ist deshalb auch dann aktiv, wenn nur
  Regeln geändert wurden und kein Item-Delta ansteht.
- Save-Status: `idle | saving | success | error`, inkl. Unsaved-Counter und Retry-Aktion im
  `OnlineAccessPanel.vue`. Erfolgs-Feedback blendet sich nach kurzem Timeout aus; alle Texte der
  Save-UX liegen als Wording-Handles vor.

### 12.9 Create-Flow (neues Item)

**Offline** zeigt der Listenkopf `Neues Item`, sobald eine Feldkonfiguration angewendet ist - auch ohne
geladene Daten. `appendLocalItem` (`useViewerData`) hängt ein Item mit den Registry-Defaults der
angewendeten Felder an (plus `scan: ''`, wenn die Daten eine `scan`-Spalte haben), leert die Suche,
selektiert es und setzt `isDirty`; es geht mit dem nächsten Download in die Daten. `Reset` entfernt
Items, die seit dem letzten Import bzw. Speichern angelegt wurden, auch wenn vorher keine Daten geladen
waren. In dieser Sitzung angelegte Items (offline wie online) merkt sich `src/composables/createdItems.js`
in einer `WeakSet` außerhalb der Item-Objekte: ihre leeren Felder bleiben bei `showOnlyNonEmptyFields`
sichtbar, und ohne eigenen Titel zeigt die Liste `Neues Objekt`.

**Online:**

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
- **Unklarer Ausgang (Timeout, Verbindungsabbruch):** Der `POST` kann gespeichert worden sein, ohne
  dass die Antwort ankam; ein erneutes Speichern würde das Item doppelt anlegen. Optional nennt der
  Settings-Schlüssel `createKeyField` ein Textfeld der Collection (am besten `unique`). Dann trägt jeder
  Create einen erzeugten Schlüssel (`crypto.randomUUID()`, sonst Zeit+Zufall) in diesem Feld, und nach
  einem unklaren Ausgang sucht das nächste Speichern das Item zuerst per
  `filters[<createKeyField>][$eq]=<Schlüssel>` (`findCollectionItemByFieldValue`). Gefunden: Das Item
  übernimmt die Identität, kein zweiter `POST`. Nicht gefunden: erneuter `POST` mit demselben Schlüssel.
  Ohne `createKeyField` sagt die Fehlermeldung, dass das Item vielleicht schon existiert.
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

### 12.11 Datenmodell der Collection (Felder zum Hinzufügen)

`fetchCollectionFieldModelFromStrapi({ profile, token, itemsPath })` in `services/strapiDataModel.js`
liefert `{ source: 'schema' | 'sample', fields: [{ key, strapiType, suggestedType, isStructured }] }`
(Komponenten aus dem Schema zusätzlich mit `component` (UID) und `repeatable`):

1. **Schema:** `GET /api/content-type-builder/content-types`, davon der Content-Type, dessen
   `schema.pluralName` dem letzten Segment von `itemsPath` entspricht (`/api/index-cards` →
   `index-cards`). Liefert alle Attribute mit Typ, auch Relationen, Medien und Komponenten. Braucht für
   die Rolle des Editors die Strapi-Berechtigung **Content-type-builder → `getContentTypes`**.
2. **Beispiel-Item (Fallback):** Ist das Schema nicht lesbar (z. B. 403) oder kein Content-Type passt,
   wird ein Item mit `pagination[pageSize]=1&populate=*` gelesen (bei Fehler ohne `populate`). Strapi
   liefert skalare Felder auch mit `null`; Typen werden aus den Werten geraten, `null` bleibt ohne Typ.
   Relationen ohne Leserecht und Felder einer leeren Collection fehlen. Die UI zeigt dann den kurzen
   Hinweis `remoteFieldModelSampleNote`; die fehlende Berechtigung nennt erst dessen Tooltip
   (`remoteFieldModelSampleHint`), da sie nur Admins etwas angeht.

Ausgelassen werden die Strapi-Systemfelder (`id`, `documentId`, `createdAt`, `updatedAt`,
`publishedAt`, `createdBy`, `updatedBy`, `locale`, `localizations`). `isStructured` markiert
`relation`, `media`, `component`, `dynamiczone`, `json` und `blocks` (Tooltip am Dropdown), da
der Viewer solche Werte nur teilweise bearbeitet. Ein 403 meldet nicht ab (nur 401 tut das).

`useRemoteFieldModel` lädt das Modell erst, wenn der Tab `Konfiguration` offen ist (oder die bestandsweite
Suche über `loadStructuredFieldKeys()` die strukturierten Felder braucht) und eine angemeldete
Online-Sitzung mit `itemsPath` besteht, und behält es, bis sich Basis-URL, Token oder `itemsPath` ändern
oder `Datenmodell neu laden` geklickt wird. Ein veralteter Ladevorgang schreibt nicht
(`requestSequence`).

### 12.12 Items ableiten

Aus dem gewählten Item legt `Item ableiten` ein neues Item in einer **anderen** Collection an, füllt es nach
einer Regel vor und verknüpft beide über eine Relation. Nur online, nur ein Item je Klick.

**Einschalten:** `deriveItems: true` in der Grundkonfiguration (je Deployment, Default aus). Ohne Schalter
gibt es weder Button noch Regel-Editor, auch wenn Regeln in Strapi stehen.

**Regeln** liegen im eigenen JSON-Prop `mappings` des Viewer-Settings-Typs (wie `replacements` nicht im
`settings`-Objekt; `Konfiguration anwenden` fasst sie nicht an). Eine Liste, höchstens eine Regel je
Quell-Collection; der Viewer nimmt die Regel, deren `source` dem `itemsPath` der Settings entspricht
(Pfade ohne Query, Fragment und trailing Slash verglichen). `null` (Prop noch leer) heißt: keine Regeln.

```json
[
  {
    "source": "/api/index-cards",
    "target": "/api/collection-items",
    "label": { "de": "Als Sammlungsobjekt anlegen", "en": "Create collection item" },
    "relationField": "index_cards",
    "fields": [
      { "target": "label", "from": "label", "prefix": "item_" },
      { "target": "name", "from": "ai_scientific_name" },
      { "target": "status", "value": "draft" },
      { "target": "collectors", "from": "collectors",
        "structure": { "type": "component", "component": "metadata-forms.wikidata-reference", "repeatable": true } }
    ]
  }
]
```

| Schlüssel | Bedeutung |
| --- | --- |
| `source` / `target` | Collection-Pfade (`/api/<pluralName>`); das Ziel muss eine andere Collection sein |
| `label` | Button- und Dialogtitel je Sprache; ohne Eintrag `Item ableiten` / `Derive item` |
| `relationField` | Relationsattribut **der Ziel-Collection**, das auf die Quelle zeigt (bei many-to-many genügt eine Seite) |
| `fields[]` mit `from` | kopiert den Wert des Quellfelds; `prefix` wird davor gesetzt. Leere Quellwerte (`null`, leerer bzw. reiner Leerzeichen-String) werden ausgelassen, `0` und `false` übernommen |
| `fields[]` mit `from`, strukturiert | Komponente, JSON oder Blocks werden als Ganzes kopiert, nur in ein Feld gleicher Struktur (Komponente: gleiche UID und gleiches `repeatable`). Komponenten-Einträge verlieren ihre Datenbank-`id` und verschachtelte Medien/Relationen; verschachtelte Komponenten ebenso. JSON-Inhalte bleiben unverändert (auch `id`-Schlüssel darin). `prefix` gilt nur für Text und Zahlen |
| `structure` (bei Kopien) | Struktur des Quellfelds (`type`: `component` mit `component` und `repeatable`, `json` oder `blocks`). Der Regel-Editor schreibt sie beim Speichern aus dem Schema-Datenmodell der Quelle; ohne Schema bleibt eine gespeicherte erhalten. Damit kann auch eine Rolle ohne Leserecht aufs Schema Komponenten populieren und bereinigen |
| `fields[]` mit `value` | fester Wert (ein vorhandener Schlüssel `value` macht die Zeile zur Konstante, auch bei `""`) |

Unvollständige Regeln bzw. Zeilen werden beim Laden verworfen (`normalizeDerivationRules`).

**Ablauf** (`useItemDerivation`):

```
Klick ─▶ nur für Kopien ohne `structure`: Datenmodell der Quelle (nur ein Schema-Modell zählt)
      ─▶ nur wenn Komponenten kopiert werden: GET /api/content-type-builder/components
      ─▶ GET <source>/<documentId>?populate[n]=<kopierte Komponente>  (bei einem Entwurf übersprungen)
      ─▶ Vorschau = Serverwerte + lokale ungespeicherte Werte ─▶ Dialog
OK    ─▶ ungespeicherte Änderungen? ─ ja ─▶ useOnlineSave (alles) ─ Fehler ─▶ Abbruch, nichts angelegt
      ─▶ GET <source>/<documentId>?populate…  (gespeicherter Stand, auch Felder außerhalb der Feldkonfiguration)
      ─▶ Komponenten bereinigen (cleanComponentValue)
      ─▶ POST <target> { data: { …Zielwerte, <relationField>: { connect: [{ documentId }] } } }
      ─▶ Dialog: "Item angelegt: <label> (ID <documentId>)"
```

- Ein gerade angelegter Entwurf wird beim Vorab-Speichern erstellt und danach über seine neue
  `documentId` verknüpft. Ohne `documentId` (Strapi v4) wird über `{ id }` verknüpft.
- Welche Kopie eine Komponente ist, sagt `structure` der Regel; bei älteren Regeln ohne `structure` das
  Schema-Datenmodell der Quelle. Ein aus einem Beispiel-Item geratenes Modell zählt nicht (es hält
  Komponenten für JSON). Hält das Item für eine Kopie ohne bekannte Struktur ein Objekt oder eine Liste,
  bricht der Dialog mit `deriveRuleNeedsResave` ab, statt den Wert stillschweigend wegzulassen; die Regel
  muss dann einmal mit Schema-Zugriff gespeichert werden (Regel-Editor zeigt sie als geändert).
- Ohne lesbare Komponenten-Schemas fällt nur die `id` der Einträge weg, verschachtelte Medien/Relationen
  bleiben. Verschachtelte Komponenten werden nicht eigens populiert (nur eine Ebene).
- Die Vorschau zeigt Komponenten unbereinigt, mit lokalen Änderungen in Viewer-Form (bei
  Wikidata-Feldern ist `id` dort die QID); angelegt wird aus dem gespeicherten Strapi-Stand.
- Die Bezeichnung im Ergebnis ist `label` der Antwort, sonst der erste abgeleitete Textwert.
- Ein zweites Ableiten desselben Items ist erlaubt und legt ein weiteres Ziel-Item an (kein Hinweis).
- **Unklarer Ausgang** (Timeout, Abbruch, `outcomeUnknown`): der Dialog sagt, dass das Item vielleicht
  schon existiert. Anders als beim Create-Flow ([12.9](#129-create-flow-neues-item)) gibt es hier keinen
  `createKeyField`-Abgleich.
- Während des Anlegens lässt sich der Dialog nicht schließen.

**Regel-Editor** (`DerivationRuleEditor.vue` im Tab `Konfiguration`): sichtbar mit Schalter, angemeldet und
schreibbaren Settings. Quelle ist fest die geladene Collection. Die Ziel-Collection kommt aus den
Collection-Types des Schemas (`fetchCollectionTypesFromStrapi`, nur `api::`-Collection-Types ohne die
Quelle; ohne Leserecht ein Textfeld). Die Dropdowns kommen aus den Datenmodellen
([12.11](#1211-datenmodell-der-collection-felder-zum-hinzufügen)): Quelle aus `useRemoteFieldModel`, Ziel
per `fetchCollectionFieldModelFromStrapi` auf `target`. Komponente, JSON und Blocks sind wählbar, wenn das
jeweilige Modell aus dem Schema kommt (`isMappableField`); im Quell-Dropdown sind dann nur Felder gleicher
Struktur frei (`areFieldsCompatible`), Präfix und fester Wert entfallen für solche Ziele. Eine gespeicherte
Regel mit unpassendem Paar meldet `deriveRuleIncompatibleField` und lässt sich nicht speichern.
Relation, Medien und Dynamic Zones bleiben gesperrt. Das Relationsfeld bietet die `relation`-Attribute
des Ziels an (bei geratenem Modell die strukturierten Felder). Das Eingabefeld für einen festen Wert richtet
sich nach dem Zieltyp (Checkbox, Zahl, Text). `Regel speichern` schreibt die ganze Liste
(`PUT <configPath>` mit `{ data: { mappings } }`), ersetzt dabei nur die Regel der eigenen Quelle und
übernimmt die Antwort; fehlt das Prop in Strapi, nennt die Meldung `mappings`.

### 12.13 Collection-Layout und verknüpfte Items

Mehrere Deployments teilen sich einen `viewer-setting`; jede Collection wird **einmal** konfiguriert,
das Deployment legt nur die Rollen fest. Beispiel Xylothek, beide auf `/api/viewer-setting`:

| Deployment | `primaryCollection` | `secondaryCollections` |
| --- | --- | --- |
| Karteikarten | `index_cards` | `["collection_items"]` |
| Sammlungsobjekte | `collection_items` | `["index_cards"]` |

**Strapi:** je Collection ein JSON-Prop am Viewer-Settings-Typ, der Prop-Name ist die Collection-ID:

```json
"collection_items": {
  "itemsPath": "/api/collection-items",
  "label": { "de": "Sammlungsobjekte", "en": "Collection items" },
  "itemLabelField": "label",
  "fields": { "label": { "type": "normal", "order": 0 } },
  "relations": { "index_cards": "index_cards" },
  "replacements": {}
}
```

| Schlüssel | Bedeutung |
| --- | --- |
| `itemsPath`, `scanField`, `createKeyField`, `hierarchyFields`, … | wie in `settings` (v1); Hierarchie und `markAsEditedBasis` wirken nur, wenn die Collection primär ist |
| `label` | Name der Collection: Abschnittstitel unter dem Item, Unter-Tab der Konfiguration |
| `itemLabelField` | in der Liste das Label; als sekundäre Collection der Titel der Klappbox |
| `relations` | optional: `{ "<andere Collection-ID>": "<Relationsattribut dieser Collection>" }`; ohne Eintrag sucht der Viewer im Schema das Relationsattribut, dessen `target` die andere Collection ist (Content-Type-Builder-Leserecht nötig) |
| `replacements` | Ersetzungsregeln dieser Collection (nur als primäre Collection angewendet) |

**Lesen** (`services/viewerSettingsLayout.js`): Ohne `primaryCollection` wird `settings` gelesen wie
bisher (v1). Mit `primaryCollection` wird das Prop der primären Collection ohne `replacements` und ohne
Viewer-Einstellungen als `settings` weitergereicht; der Rest der App sieht keinen Unterschied. Fehlt das
Prop, schlägt das Laden mit dem Prop-Namen in der Meldung fehl; ein fehlendes sekundäres Prop zeigt nur
im Abschnitt einen Fehler. `useOnlineSettingsStore` hält dazu `isCollectionLayout`,
`primaryCollectionId` und `secondaryCollections` (`[{ id, config, error }]`).

**Viewer-Einstellungen und Titel** kommen im Collection-Layout nur aus der Grundkonfiguration; der
Bereich `Viewer-Einstellungen` im Tab `Einstellungen` ist gesperrt und sagt das. `appTitle` der
Grundkonfiguration schlägt `wording.appTitle`; alle anderen Wording-Handles kommen weiter aus dem
gemeinsamen `wording`.

**Verknüpfte Items** (`composables/useSecondaryItems.js`, `components/SecondaryItemsSection.vue`):

```
Item gewählt (gespeichert, kein Entwurf)
  -> je sekundärer Collection: Relationsattribut (relations bzw. Schema, je Collection gecacht)
  -> GET <itemsPath>?filters[<attr>][documentId][$eq]=<documentId>&pagination[pageSize]=100
  -> normalizeStrapiItem + Defaults der Feldkonfiguration -> Klappboxen (alle zu)
```

- Je sekundärer Collection ein eigener Konfigurationszustand: `useUserConfigStore('secondary:<id>')`;
  `useFieldMapping(scope)` und `ItemFieldEditor` (`configScope`, `fieldIdPrefix`) rendern damit.
- Änderungen sind reguläre Pending-Updates (`itemsPath::id`), zählen im Unsaved-Counter und werden vom
  gemeinsamen Speichern mitgeschrieben. Jede Klappbox hat zusätzlich `Item speichern` für nur dieses
  Item. Beim Speichern nimmt `buildSaveContext` Feldkonfiguration, Scan-, Wikidata- und
  Create-Key-Felder der Collection des Eintrags (`settingsForItemsPath`), mit derselben Konfliktprüfung
  wie in [12.8](#128-update-flow-bestehende-items).
- Ungespeicherte Änderungen bleiben beim Wechsel des Items erhalten: lädt das Item später erneut, wird
  das bearbeitete Objekt des Pending-Eintrags gezeigt.
- Nach `Item ableiten` wird der Abschnitt neu geladen und das neue Item geöffnet.
- **Verknüpfung lösen** (`unlinkItem`): nach Rückfrage `PUT <itemsPath>/<documentId>` mit
  `{ data: { <attr>: { disconnect: [{ documentId: <gewähltes Item> }] } } }`. Nur die Verknüpfung zum
  gewählten Item fällt weg; das Objekt und seine anderen Verknüpfungen bleiben.
- **Löschen** (`deleteItem`): nach Rückfrage `DELETE <itemsPath>/<documentId>`, endgültig (bei Draft &
  Publish alle Fassungen). Braucht die Berechtigung `delete` auf der sekundären Collection.
- Beide wirken sofort (wie `Item ableiten`), verwerfen ungespeicherte Änderungen des Objekts (die
  Rückfrage sagt das) und nehmen es aus der Liste. Ein Fehler bleibt als Meldung im Abschnitt stehen,
  das Objekt bleibt in der Liste.
- Höchstens 100 verknüpfte Items je Collection und Item (`LINKED_ITEMS_PAGE_SIZE`).

**Konfiguration:** Im Tab `Konfiguration` gibt es dann je Collection einen Unter-Tab. Die primäre zeigt
das bisherige Panel samt Ableitungsregel-Editor; eine sekundäre (`SecondaryCollectionConfig.vue`) zeigt
die Feldkonfiguration ohne Hierarchie und Bearbeitungsstand-Sortierung, mit dem Datenmodell ihrer
Collection. `Konfiguration anwenden` schreibt nur das Prop dieser Collection (Lesen, Zusammenführen,
`PUT`) und gilt damit in jedem Deployment, das die Collection zeigt. `Datenmodell neu laden` lädt dort
außer dem Datenmodell auch die Konfiguration der Collection frisch aus Strapi
(`reloadCollectionConfig` → `reloadSecondaryCollectionSettings`), sodass eine anderswo gespeicherte
Änderung ohne Seiten-Reload erscheint; nicht angewendete Änderungen im Tab werden nur nach Rückfrage
verworfen. (Die primäre Collection lädt ihre Konfiguration weiterhin nur beim Laden der Settings.)

**Nicht enthalten:** verknüpfte Items anlegen (außer per `Item ableiten`) oder vorhandene Items neu
verknüpfen; Ersetzungen und Suche über sekundäre Items; offline gibt es kein Collection-Layout.

**Umstellung einer Instanz:** JSON-Props je Collection in Strapi anlegen, `settings` (und
`replacements`) von Hand in das Prop der Collection kopieren, `primaryCollection` und
`secondaryCollections` in die Grundkonfiguration der Deployments eintragen. `settings` bleibt für
Deployments ohne `primaryCollection` lesbar.

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
- `prefillWith` (Feld-Ebene, siehe 7.1): Beim Wechsel auf ein Item wird der Wert des referenzierten
  `normal`-Felds in die Autosuggest-Eingabe übernommen; die Suche startet automatisch nur, wenn noch
  keine Entity im Feld selektiert ist. Solange der Suchtext der vorbefüllte ist, zeigt das Feld rechts
  ein x zum Löschen.
- `alsoGetDataFrom`: Beim Hinzufügen einer Entity werden die rohen Statements je konfigurierter
  Property nachgeladen und unter `statementData[PROPERTY_ID]` gespeichert. Ist `statementData`
  vorhanden, zeigt die selektierte Entity-Liste einen Toggle (`Show/Hide statement data`) und rendert
  die Daten als formatierten JSON-Block.
- Bereits ausgewählte Entities werden aus der Suggestion-Liste gefiltert; die Liste ist auf `6rem`
  Höhe begrenzt und scrollt vertikal.
- **Stale-Protection:** `WikidataAutosuggestInput.vue` hält pro Query einen `AbortController`; bei
  neuer Eingabe oder Unmount werden laufende Requests abgebrochen. Abgebrochene Requests erzeugen weder
  Fehleranzeige noch Error-Logging.
- **Auswahl gehört zum Item:** Nach dem Auswählen laufen noch Label- und Statement-Requests, erst dann
  wird die Entity geschrieben. `ItemFieldEditor` ist in `App.vue` per `:key` an das selektierte Item
  gebunden; wechselt der Nutzer vorher das Item, wird der Editor ausgehängt und die laufende Auswahl
  abgebrochen (`abortPendingSelection`) - sie landet also nie im nächsten Item.
- **Fehlende Daten:** Schlägt ein Statement- oder Label-Request fehl (auch Timeout), wird die Entity
  trotzdem übernommen, trägt aber `missingData: { statements: [<PropertyIds>], labels: <bool> }`. Das
  Feld zeigt dazu einen Hinweis und `Reload data`; der Button wiederholt die Requests
  (`completeEntity`, per `defineExpose`) und ersetzt die Entity. Online wandert `missingData` wie alle
  Zusatzschlüssel nach `additional_data` und bleibt damit nach dem Neuladen sichtbar.

---

## 14 UI-Architektur (`App.vue`)

Aufbau der Seite:

- **Topbar** (Titel, Online-Panel, Transfer-Controls) oberhalb der Tabs. Ab `769px` ist sie sticky
  (`top: 0`, `z-index: 37`) und damit unabhaengig von der Scrollposition sichtbar - insbesondere die
  Save-Changes-UI aus `OnlineAccessPanel`. Beim Scrollen ueber `24px` erhaelt sie die Klasse
  `topbar-condensed`: der Titel wird ausgeblendet und das vertikale Padding reduziert, damit die
  Controls einzeilig passen und der Sticky-Stack weniger Hoehe kostet; unter `8px` Scrollposition
  klappt sie wieder auf (Hysterese gegen Flackern, weil das Einklappen die Dokumenthoehe verringert).
  Unterhalb von `769px` bleibt die Topbar wie bisher im normalen Fluss. Die Header-Controls sind so
  ausgerichtet, dass sie bei ausreichend Platz in einem horizontalen Fluss stehen.
- **Tab-Leiste** (sticky) mit fünf Bereichen: `Editieren`, `Konfiguration`, `Ersetzungen`,
  `Einstellungen`, `Info`. Interner Tab-Key des Settings-Tabs ist weiterhin `database-connection`.
  Tastatursteuerung: Left/Right (zyklisch), Home/End, Enter/Space.
- **Edit-Tab:** sticky Header-Stack mit Listenkopf (`Digitalisate` + Suche); bei konfigurierter
  Hierarchie (online aus den Strapi-Settings, offline aus der angewendeten User-Config) zuerst die
  Level-1-Boxen, danach einklappbare Level-2-Gruppen mit eigener Item-Liste.
- **Liste:** Kartenansicht der gefilterten Items inkl. Scan-Vorschau; ohne `scan`-Spalte automatische
  Umschaltung auf die textbasierte Listenansicht.
- **Sidebar:** Felder des selektierten Items und größere Scan-Vorschau (Desktop sticky mit internem
  Scroll). Ein Expand/Collapse-Button schaltet auf volle Inhaltsbreite um. Mit `deriveItems` und einer
  Regel für die geladene Collection steht im Kopf der Button `Item ableiten` (siehe [12.12](#1212-items-ableiten)).
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
  Watchern und Lifecycle-Events.
- Die Höhen von Topbar, Tab-Reihe und Edit-Header werden per `ResizeObserver` gemessen und als
  CSS-Variablen (`--ve-header-offset`, `--ve-tabs-row-height`, `--ve-edit-sticky-stack-height`) auf
  `.app-shell` für die Sticky-Offsets gesetzt. Beobachtet wird explizit die **Border-Box**, weil das
  Ein-/Ausklappen der Topbar nur das Padding ändert und die Content-Box (Default des
  `ResizeObserver`) dabei unverändert bleibt.
- `onMounted` wartet auf keine Anfrage mehr: Grundkonfiguration und Wording sind bereits vor dem Mount
  geladen (`main.js`), das Verbindungsprofil wird synchron initialisiert.

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
> Grundkonfiguration bzw. der Datenquelle. Der Token-Wert `#0066CC` ist damit nur der Fallback, nicht die effektive Farbe.
> `--color-primary-hover` wird nicht mitgesetzt.

Globaler Seitenhintergrund:
`radial-gradient(circle at top, #F8FAFC 0%, #EEF1F5 60%, #E7ECF2 100%)`.

Layoutverhalten:

- Grid-Layout für Desktop (`list/sidebar/status`) plus sticky Header-Stack im Edit-Tab. Der Stack ist
  dreistufig: Topbar (`z-index: 37`), Tab-Reihe (`36`), Edit-Kopfzeile (`35`); jede Ebene setzt ihr
  `top` aus der Summe der Höhen darüber. `--ve-sticky-top-offset` fällt auf `58px` zurück, falls die
  gemessene Topbar-Höhe (noch) nicht vorliegt.
- Responsive Umschaltung auf einspaltiges Layout bei `max-width: 768px`
- Mit gewähltem Item: Liste `minmax(15rem, 1fr)`, Editierbereich `2fr`; ab `1600px` Viewport-Breite
  `2fr / 3fr`. Alle Spuren mit `minmax(0, …)` bzw. fester Untergrenze, damit breite Inhalte die
  Spalten nicht aufblähen.
- Niedrige Viewports (`min-width: 769px` und `max-height: 820px`): Die Edit-Kopfzeile (Suche,
  `Neues Item`) ist nicht sticky und scrollt mit; nur Topbar und Tab-Reihe bleiben stehen. Die
  Sidebar rechnet ihr `top`/`max-height` dann ohne `--ve-edit-sticky-stack-height`.
- Gescrollte Topbar bis `1440px` Breite: Der reine Offline-Hinweis (`.auth-note-inline`) entfällt,
  damit die Controls einzeilig passen.
- Tabs schrumpfen (`flex: 0 1 14rem`, mindestens `7rem`, Text mit Ellipse) statt horizontal zu scrollen.
- Scan und Felder im Editierbereich richten sich per Container Query nach dessen Breite
  (`container: sidebar-content`), nicht nach dem Viewport: unter `32rem` steht der Scan über den
  Feldern (max. `40vh` hoch), ab `32rem` nebeneinander im Verhältnis Scan `2fr` / Felder `3fr`, ab
  `64rem` (z. B. erweiterter Modus auf breiten Bildschirmen) `1fr / 1fr`.
- Feldbreiten (`ItemFieldEditor`, `container: field-grid`): Unter `36rem` Feldspaltenbreite werden
  33-%-Felder zu 50 %, unter `24rem` sind alle Felder volle Breite.
- Im erweiterten Modus wird die Sidebar nicht sticky gerendert und nutzt die volle Inhaltsbreite
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

Komponenten (`.vue`) haben keine Tests (kein DOM-Testsetup); das betrifft u. a. den Auswahlabbruch und `missingData` im Wikidata-Feld.

### Composables

| Datei | Geprüftes Verhalten |
| --- | --- |
| `composables/csvFormat.test.js` | Quoted Zellen mit Zeilenumbruch, Trennzeichen und `""`; CRLF als Satzende und in Quotes; leere Zeilen und BOM; nicht geschlossenes Anführungszeichen als Fehler mit Zeile; `toCsvCell`-Ausgabe liest sich zurück |
| `composables/useViewerData.test.js` | Validierung von `parseJsonPayload` (Top-Level-Array, eingebettete `data`/`config`, `suspendedItems`), `looksLikeImageUrl`, CSV-Randfälle (`splitCsvLine` mit Quotes/escaped Quotes, leere und fehlende trailing Spalten, Spaltenüberschuss als Fehlerpfad, Whitespace-erhaltender Roundtrip, Export-Import-Roundtrip mehrzeiliger Werte, Zeilenangabe nach mehrzeiliger Zelle), Mindestlänge der Suche, Label-Feld-Priorisierung, Sortierung nach Bearbeitungsstand inkl. invertiertem Modus und Zusammenspiel mit `suspendEditing`, Suspend-Toggle per UID, Import/Export der Suspend-Indizes, Kern-Flow (Init → Filter → Select → Update → Reset), Wikidata-Werte als Entity-Arrays inkl. Metadaten-Roundtrip, `appendOnlineDraftItem` und `syncSnapshotItemAtIndex`, `applyReplacementsToLoadedItems` (Wertänderung, `_searchText`, `isDirty`; keine Wirkung ohne Treffer) |
| `composables/userConfigValidation.test.js` | Gültige Config-Payloads; Ablehnung fehlender/ungültiger `fields`, unbekannter Feldtypen, ungültiger `itemLabelField`/`markAsEditedBasis`/`showOnlyNonEmptyFields`/`fieldWidth`/`hint`/`readOnly`; `readOnly` verboten für `wikidata-autosuggest`; `autosuggest` nur auf Wikidata-Feldern; `prefillWith`-Regeln; `alsoGetDataFrom` als String und Repeater inkl. Property-ID-Prüfung; Candidate-Regeln (`targetField` Pflicht, kein Candidate-Ziel, `inputType`); Typen der Viewer-Einstellungen (`language`, `languageMode`, `primaryColor`, `dataInspectionMode`) |
| `composables/useFieldMapping.test.js` | Leere Wikidata-Felder bleiben bei `showOnlyNonEmptyFields` sichtbar; `suspendEditing` und `__onlineMeta` erscheinen nie als editierbare Felder; Candidate-gesteuertes Prefill/Force-Search für Autosuggest-Bindings |
| `composables/useDataImportExport.test.js` | Eine noch nicht angewendete User-Config wird vor JSON- **und** CSV-Export automatisch angewendet; JSON-Export schreibt die Viewer-Einstellungen der Datenquelle in `config`; JSON-Import übernimmt sie, CSV-Import und ungültige `config` fallen auf die Grundkonfiguration zurück; eine ohne Daten vorbereitete Feldkonfiguration bleibt beim ersten Import ohne `config` erhalten und geht in `Neu beginnen` ein, wird sonst ersetzt |
| `composables/useSelectionNavigation.test.js` | Navigation folgt der aktuellen gefilterten Reihenfolge nach Umsortierung; Vorwärts-Navigation ist bei nur einem Item deaktiviert |
| `composables/useWikidataSearch.test.js` | Resilientes Merge-Verhalten bei Ausfall einer Suchsprache; `AbortError`-Pfad ohne Warning-Logging; `claimPresence` mit Objekt-Defs; Nachladen roher Statement-Daten; Nachladen lokalisierter Labels/Descriptions (`de`/`en`) |
| `composables/replacementRules.test.js` | Ersetzbare Feldtypen (`normal`/`text`, ohne sichtbare Read-only-Felder und Reservierte, ausgeblendete auch read-only enthalten); literales, case-sensitives Ersetzen aller Vorkommen; Reihenfolge `allFields` vor feldspezifisch; Löschen per leerem Ersetzungstext; Ignorieren nicht-primitiver Regelwerte; Änderungsliste je Item-Index |
| `composables/useReplacementsApply.test.js` | Offline-Lauf ändert nur geladene Items und rührt die Online-Pipeline nicht an; Online-Lauf trackt Deltas der geladenen Items und reicht die geladenen IDs an den Collection-Durchlauf; Fehlerfall des Collection-Durchlaufs; Lauf ohne Regeln bleibt wirkungslos |
| `composables/hierarchyConfig.test.js` | Normalisierung von Hierarchie-Feldlisten (Array und kommaseparierter String); Settings-Auflösung inkl. Durchfallen bei weniger als zwei Einträgen und Feld-Auto-Erkennung; Level-1-Optionen mit Trefferzahl, alphabetischer Sortierung und `isUnassigned`-Bucket am Ende; `firstLevelStaticList` fixiert Reihenfolge, fehlende Datenwerte bleiben erreichbar; Level-2-Optionen nur innerhalb des gewählten Level-1-Werts; Zugehörigkeitsprüfung zu einem Level-1-Wert |
| `composables/searchQuery.test.js` | Tokenisierung (lowercase, Whitespace); Mindestlänge drei Zeichen; `null`/`undefined` als leere Anfrage |
| `composables/useCollectionSearch.test.js` | Suchbereich: lokal in einer Kategorie, bestandsweit ohne Auswahl, Schalter überschreibt; ohne Hierarchie keine Trefferansicht; Panel-Zustand (Suchfeld online ohne Items aktiv); offline: nur Kategorie-Treffer navigierbar, Trefferansicht live, Zurück leert Anfrage und schließt das Item, Schalter aus behält die Anfrage; online: Suche erst bei Submit, nicht in einer Kategorie ohne Schalter, Fehler/Abbruch behalten die Kategorieansicht, entfernte Felder, leere Anfrage kehrt zurück, abgebrochene Rückkehr bleibt in den Treffern, Schalter aus lädt die Kategorie neu |
| `composables/valueChecks.test.js` | Leere Strings/Arrays/Objekte gelten als leer, `0` und `false` als gefüllt |
| `composables/requestSequence.test.js` | Nur der neueste Lauf ist aktuell; `invalidate` macht laufende Läufe veraltet; ein langsamerer früherer Request schreibt nicht nach einem neueren |
| `composables/connectionProfile.test.js` | Normalisierung von `baseUrl` (Trim, trailing Slash) und `configPath` (führender Slash); Pflichtfeld-Validierung; `createSavedConnectionProfile` mit `updatedAt`; JSON-Parsing; `joinBaseUrlAndPath` |
| `composables/derivationRules.test.js` | Normalisieren der Regeln (`null` → keine, Pfade ohne Query/Slash, unbrauchbare Regeln/Zeilen verworfen, Label als String); Regel je Quelle; Ersetzen der eigenen Regel ohne die anderen; Validierung (Ziel fehlt/gleich Quelle, Relation fehlt, keine Felder, Zielfeld doppelt); Button-Label je Sprache mit Fallback; Zielwerte mit Präfix, Kopie und Konstante, leere Quellen ausgelassen, `0`/`false` übernommen; wählbare strukturierte Felder; Kompatibilität (Komponenten-UID, `repeatable`, Typ); unpassende Zeilen; Bereinigen von Komponenten (Einträge-`id`, Medien/Relationen, verschachtelt, JSON unverändert); kein Präfix für Objekte; zu populierende Felder; `connect` über `documentId` bzw. `id`; Ergebnisbeschreibung |
| `composables/useItemDerivation.test.js` | Aktion nur mit Schalter und Regel für die geladene Collection; Beschriftung aus der Regel, sonst Default; Regel-Editor nur bei schreibbaren Settings; Vorschau aus Serverwerten plus lokalen Änderungen; Anlegen mit Relation und Ergebnis; Vorab-Speichern vor dem POST; kein Anlegen, wenn das Speichern scheitert; Entwurf wird über die neue Identität verknüpft; Meldung bei unklarem Ausgang; kein Schließen während des Anlegens; Komponente populiert und ohne `id`/Medien gesendet (Beispiel `collectors`); Modelle beim Anlegen nachgeladen, wenn die Quelle ein Entwurf war; Anlegen auch ohne lesbares Schema |
| `composables/useDerivationRuleDraft.test.js` | Entwurf aus der gespeicherten Regel inkl. Laden des Zielmodells; nur Relationsattribute als Relationsfeld; ohne Regel nicht speicherbar; unvollständige Zeile blockiert; Speichern über den Store und Abgleich danach; Entfernen einer Zeile; unpassende Komponente blockiert das Speichern |
| `composables/useOnlineSave.test.js` | Ohne angemeldete Online-Sitzung kein Speichern (`false`); nichts ausstehend → `true`; Items und Regeln speichern und als gespeichert markieren; nur Regeln; `false` bei fehlgeschlagenen Regeln; Teilfehler hält erstellte Items synchron |
| `composables/linkedItems.test.js` | Gespeichertes Item ist Verknüpfungsziel, Entwurf nicht; Schlüssel aus Collection-Pfad und ID; konfigurierte Felder mit Defaults und normalisiert; Kopfzeile aus dem Label-Feld, sonst die ID; Sprach-Fallback de → en → beliebig |
| `composables/onlineSaveConflicts.test.js` | Leere Werte gelten als gleich; Zahl und String-Form gleich, Objekt-Schlüsselreihenfolge egal; `false` bleibt von leer verschieden; Konflikt, wenn der Serverwert weder Basis noch gesendeter Wert ist; kein Konflikt ohne Basis oder Serverwert |
| `composables/useSecondaryItems.test.js` | Ein Abschnitt je sekundärer Collection mit eigener Feldkonfiguration; Laden über die konfigurierte Relation; Bearbeitung als ausstehende Änderung, auch nach Neuladen; Zurücknehmen; nach dem Ableiten wird das neue Item geöffnet; Entwurf zeigt keine verknüpften Items; Konfiguration anwenden schreibt nur das eigene Attribut; Konfiguration neu laden (mit Rückfrage bei nicht angewendeten Änderungen); Lösen, Löschen, Ablehnen der Rückfrage, Fehler; eigenes Speichern |
| `composables/useRemoteFieldModel.test.js` | Lädt erst, wenn benötigt, und nur einmal je Kontext; lädt neu bei anderer Collection und bei `reload`; leert das Modell offline bzw. abgemeldet; `loadStructuredFieldKeys` lädt bei Bedarf genau einmal und liefert die strukturierten Felder, ohne Modell eine leere Liste; Fehlerstatus mit Meldung |

### Fields und Services

| Datei | Geprüftes Verhalten |
| --- | --- |
| `fields/fieldRegistry.test.js` | Registrierte Feldtypen bleiben stabil; Fallback auf abgeleiteten Editor-Typ bei unbekanntem Typ; Editor-Bindings für Checkbox, Read-only-Text und Candidate; Defaults je Typ; Normalisierung beim Config-Apply inkl. best-effort Integer-Coercion; kanonische Form für fehlerhafte Wikidata-Werte; `autosuggest`-Config bleibt opaker Pass-through; Edit-Normalisierung inkl. Legacy-Pfad und `configuredType`-gesteuerter Integer-Logik |
| `services/strapiSearch.test.js` | Durchsuchbare Felder (Texttypen, ohne Typ, Hierarchie-Felder; ohne Checkbox/Integer/Wikidata); Filteraufbau UND über Tokens, ODER über Felder; Request enthält die Filter; abgelehntes Feld wird entfernt und die Suche wiederholt; Fehler ohne verbleibendes Feld; mehr Treffer als die Obergrenze brechen nach der ersten Seite ab (mit `total`) bzw. sobald überschritten (ohne `total`); andere Fehler werden durchgereicht |
| `services/strapiDataModel.test.js` | Felder des passenden Content-Types ohne Systemfelder; vorgeschlagener Viewer-Typ je Strapi-Typ, strukturierte Typen markiert; kein passender Content-Type; Beispiel-Item (v5 und v4 `attributes`) mit geratenen Typen; Schema zuerst, Fallback auf Beispiel-Item mit `populate=*`, dann ohne `populate`; Fehler, wenn nichts lesbar ist; Collection-Types nur `api::`-Collection-Types nach Anzeigename, leere Liste ohne Leserecht; Komponenten-UID und `repeatable`; Komponenten-Schemas je UID, `{}` ohne Leserecht |
| `services/strapiCollectionConfig.test.js` | Filter über die Relation zum primären Item (`documentId`, bei Strapi 4 `id`); Attribut frisch lesen, nur dieses senden, Antwort übernehmen; ohne Attribut Fehler und kein Schreiben |
| `services/viewerSettingsLayout.test.js` | v1 ohne `primaryCollection` (auch Ersetzungen in `settings`, Fehler ohne `settings`); v2 reicht das primäre Attribut als Settings weiter, meldet fehlende Attribute; Zurückführen erhält Ersetzungen bzw. ungeänderte Schlüssel |
| `services/strapiApi.test.js` | Normalisierung flacher und `attributes`-basierter Zeilen inkl. `documentId`/`id`-Fallback und hartem Fehler ohne stabile ID; Update-Payload mit `data`-Wrapper; Update-Request gegen den aufgelösten Item-Pfad; `populate[n]`-Aufbau; Ermittlung der Wikidata-Feldschlüssel aus Settings; Wikidata-Mapping Strapi ↔ Viewer in beide Richtungen; Settings lesen (inkl. optionalem Wording) und schreiben über `configPath`; Ersetzungsregeln aus `data.replacements` inkl. Legacy-Fallback auf `data.settings.replacements`, Schreiben nach `data.replacements` und Fehler bei fehlendem Prop; Datenmodell-Prüfung inkl. `wikidata_id`-Mismatch und Retry nach abgelehntem `populate`-Key; Item-Fetch-Retry ohne ungültigen `populate`-Key; 2xx ohne JSON bricht nach einem Request ab (Items und Datenmodell-Prüfung), `204` liefert `null`; Timeout und Netzwerkfehler als `outcomeUnknown`; 401 mit Token erreicht den Unauthorized-Handler, ohne Token nicht |

### Stores

| Datei | Geprüftes Verhalten |
| --- | --- |
| `stores/useAppConfigStore.test.js` | Lokales Wording als Default; sprachweise Überschreibung durch Backend-Wording; reine Backend-Handles; Rückfall auf lokales Wording nach `clearOnlineWording`; geschützte Settings-Tab-Handles bleiben lokal; Inline-Fallback ohne Wording; eingebaute Defaults; Laden von Grundkonfiguration und Wording aus `app-config/`; Normalisierung bzw. Verwerfen eines mitgelieferten Profils; Defaults bei fehlender oder ungültiger Datei; Überlagerung der Viewer-Einstellungen durch die Datenquelle inkl. Sprache; Entfernen des alten localStorage-Snapshots; Export eines bearbeiteten Entwurfs als Dateiinhalt; `deriveItems` nur bei literalem `true` |
| `stores/useUserConfigStore.test.js` | Initialisierung minimaler Autosuggest-Config beim Typwechsel; Erhalt unbekannter Autosuggest-Schlüssel; Entfernen von `autosuggest`/`readOnly` bei Typwechsel; Candidate-Initialisierung, -Aktualisierung und Abwehr ungültiger Ziele; Persistenz und Bereinigung von `itemLabelField`; leere Feldkonfiguration nach `initializeUserConfig`; Hinzufügen aus Datenschlüsseln ohne reservierte und bereits konfigurierte Schlüssel |
| `stores/useAuthStore.test.js` | Login speichert das JWT; `restoreSession` lädt Token und Nutzer; Login ohne Credentials schlägt fehl; 401 in der Sitzung lässt Sitzung und Nutzer bestehen und verwirft das Token; fehlgeschlagener Neu-Login hält die Sitzung offen; erneuter Login beendet den Ablauf; Logout schließt die Sitzung; abgelehntes gespeichertes Token beim Start zählt nicht als Ablauf |
| `stores/useConnectionProfileStore.test.js` | Speichern nur nach bestandenem Verbindungstest und Neuladen; kein Speichern bei fehlgeschlagenem Test; Ablehnung ungültiger Profile ohne Backend-Aufruf; JSON-Import; mitgeliefertes Profil hat Vorrang vor einem gespeicherten und lässt sich weder speichern noch löschen |
| `stores/useOnlineModeStore.test.js` | Speichern/Restore des App-Modus mit Profil; Ablehnung ungültiger Modi; kein Wechsel auf `online` ohne Profil und automatischer Wechsel nach dem Speichern; gespeichertes `online` ohne Profil wird `offline`; Rückfall auf `offline` beim Entfernen des Profils; deaktiviertes Umschalten bei fixiertem `connectionMode` |
| `stores/useOnlineSettingsStore.test.js` | Laden aus `response.data.settings`; Persistieren gegen den Singleton-Endpoint; lokaler State bleibt bei fehlgeschlagenem Persist erhalten; Persistieren der Ersetzungsregeln inkl. Fehlerpfad |
| `stores/useDerivationRulesStore.test.js` | `null` heißt keine Regeln; Speichern ersetzt nur die Regel der eigenen Quelle; fehlgeschlagenes Speichern behält die geladenen Regeln und meldet den Fehler |
| `stores/useOnlineItemsStore.test.js` | Laden und Sanitizing über `settings.itemsPath`; `attributes`-Form mit numerischem ID-Fallback; harter Fehler ohne stabile ID; Level-1-Optionen ohne Voll-Item-Fetch; `firstLevelStaticList` ohne Item-Requests; Hierarchie-Erkennung über den Legacy-Schlüssel `hierarchy_fields`; bestandsweite Suche ohne ausgeschlossene (strukturierte) Felder, die als nicht durchsucht gemeldet werden; zu kurze Anfrage ohne Request und ohne Laden des Datenmodells |
| `stores/useOnlineUpdatesStore.test.js` | Delta-Tracking inkl. Revert auf den Snapshot-Wert; Teilfehler bleiben pending und werden gemeldet; Draft-Tracking (unberührter Entwurf zählt als pending, persistierte Items nicht); POST nur mit nicht-leeren Feldern und Übernahme der `documentId`; fehlgeschlagener Create bleibt retry-fähig; erstellte Items wechseln danach auf den Update-Pfad; unklarer Create-Ausgang ohne `createKeyField` warnt vor Duplikaten, mit `createKeyField` findet das nächste Speichern das Item statt erneut zu posten bzw. postet mit demselben Schlüssel; Ersetzungslauf über die Collection registriert Deltas nur für nicht geladene Treffer, meldet Fetch-Fehler ohne Pending-Updates und verlangt einen `itemsPath` |

---

## 17 Bekannte Grenzen

- Import akzeptiert Top-Level-Array oder `data`-Array; `data` als Objekt ist ungültig.
- Der CSV-Parser ist bewusst minimal; exotische CSV-Formate werden nicht vollständig abgedeckt.
- Editierbar sind nur Registry-unterstützte Feldtypen; unbekannte komplexe Strukturen bleiben als
  Rohdaten sichtbar und werden nicht semantisch aufbereitet.
- Deep Clone via JSON-Serialisierung unterstützt keine Spezialtypen (`Date`, `Map`, Funktionen).
- Die Bildvorschau basiert auf URL-Pattern und prüft die Erreichbarkeit nicht vor dem Laden.
- Ersetzungen kennen kein Undo und keinen Dry-Run: ein Lauf ändert die Werte sofort
  (siehe [Kapitel 11](#11-ersetzungen-replacements)). Rückweg ist nur `Reset` vor dem Speichern.
- Ein Online-Ersetzungslauf lädt die gesamte Collection einmal paginiert nach; bei großen Collections
  ist das entsprechend teuer.
- Ersetzungen greifen nur auf String-Werte in Feldern der Typen `normal` und `text`.
- Items, Auswahl, Dirty-State und Ersetzungen überleben keinen Reload.
- Die Kartenliste rendert alle gefilterten Items ohne Paginierung; Bilder laden lazy (`loading="lazy"`). Bei sehr großen Collections mit Scans ist das nicht gemessen.
- Logout widerruft das JWT nicht serverseitig (siehe [12.2](#122-login-modal)).
- Im Online-Modus ohne Hierarchie werden alle Items paginiert vollständig geladen; es gibt kein
  virtuelles Scrolling.
- Die bestandsweite Online-Suche nutzt `$containsi` über alle durchsuchbaren Felder; die Datenbank prüft
  dafür jede Zeile. Bei sehr großen Collections ist sie entsprechend langsam (nicht gemessen). Über 500
  Treffer lädt sie nicht und bittet um eine genauere Suche. Wikidata- und andere strukturierte Felder
  werden nicht durchsucht.

---

## 18 Erweiterungspunkte

- Schema-basierte Feldvalidierung (z. B. pro Key-Regeln)
- Undo/Redo statt nur globalem Reset
- Virtuelles Scrolling/Pagination für große Datensätze in der Liste
- Dry-Run/Vorschau und Undo für Ersetzungsläufe (heute wird direkt angewendet)
- Regex- oder Wortgrenzen-Modus für Ersetzungen (heute nur literale Teilzeichenketten)
- Feinere i18n/Locale-Unterstützung über DE/EN hinaus
- Konfigurierbare Auth-Endpunkte im Verbindungsprofil (heute fest `/api/auth/local` und `/api/users/me`)
