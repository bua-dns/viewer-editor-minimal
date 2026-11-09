# Changelog

## 2026-11 - Safer online saving

- Switching the level-1 group with unsaved online changes now asks before discarding them.
- Saving checks each changed field against the server first. If someone else changed it since it was
  loaded, the item is not written and the save names the fields; saving again overwrites deliberately.
  Each updated item costs one extra `GET` per save.
- Edits made while a save is running are no longer lost; they stay pending for the next save.
- The "unassigned" level-1 group is filtered on the server (null or empty) instead of loading the
  whole collection; it falls back to the old behaviour if Strapi rejects the filter.
- The footer credit is rendered as text, not HTML. Line breaks in the `footerIdentityCredit` wording
  are written as `\n`; a `<br>` in an older backend override still works.

## 2026-09 - Two config layers: basic config and data source

- Config now has two layers. The **basic config** is one runtime file,
  `public/app-config/viewer-editor-app-config.v1.json`, loaded before the app mounts. Everything that
  belongs to a data set lives with the **data source**: the `config` of the JSON file offline,
  `viewer-setting.settings` online. The data source wins, key by key.
- Removed: `config/app.config.js`, `config/wording.js`, `public/connection-profile/`, the
  `defaultAppConfig` and `defaultConnectionProfile` keys, the `githubRepo` setting and the GitHub link
  in the footer, the localStorage snapshot of the app settings (`viewerEditor.appConfig.v1`) and the
  sessionStorage copy of the field config (`viewerEditor.userConfig.v1`). Both old keys are deleted on
  start.
- `config/wording.json` moved to `public/app-config/wording.json` and is loaded at runtime.
- The basic config holds `connectionMode` (default `switchable`), an optional inline
  `connectionProfile`, and the defaults of the viewer settings `language`, `languageMode` (default
  `multi`), `primaryColor` and `dataInspectionMode`.
  The `Einstellungen` tab shows them read-only and downloads the file for `public/app-config/`
  (optionally with the current connection profile).
- A shipped `connectionProfile` is fixed and shown read-only. Without one, the user enters a profile in
  the `Einstellungen` tab; it is saved to localStorage only after the connection test passes. Choosing
  `Online` without a profile keeps the app offline, opens the tab, and switches once a profile is saved.
- The viewer settings can be overridden by the data source. The `Einstellungen` tab edits them while a
  data source is open: offline they go into the next JSON download, online they are written back to
  `viewer-setting.settings` like `Konfiguration anwenden`.
- Field config has no default any more. A data source without `config` (plain JSON array, CSV) starts
  without fields; the `Konfiguration` tab lists the keys found in the data with `Hinzufügen` and
  `Alle hinzufügen`. `public/sample-data.json` now ships with a `config`.
- Offline, the `Konfiguration` tab is available without data. A config drafted there is kept when the
  first data without a config of its own is loaded, and `Neu beginnen` writes it into the new data set.
- Offline, `Neues Item` is available as soon as a field config is applied, also with no data loaded. The
  new item gets the type defaults of the configured fields and goes into the next download.
- **For deployments:** move the values of `config/app.config.js` and the file in
  `public/connection-profile/` into `public/app-config/viewer-editor-app-config.v1.json` (profile inlined
  as `connectionProfile`). Existing JSON files and Strapi settings stay valid unchanged.

## 2026-09 - Hierarchy view in offline mode

- The hierarchy view (level-1 boxes, collapsible level-2 groups) now works with local JSON files.
  It follows the applied user config: `hierarchyFields` from the imported file's `config`, or as set
  and applied in the `Konfiguration` tab. Before, those settings were read and exported but the Edit
  tab ignored them offline and always showed a flat list. Online mode is unchanged and still takes
  the hierarchy from the Strapi settings.
- Offline, boxes and groups are counted from the loaded items, so there are no bucket requests. With
  `firstLevelStaticList`, its entries come first in list order; values in the data but missing from
  the list are appended, so no item becomes unreachable.
- Previous/next in the sidebar and the auto-advance after `Bearbeitung aussetzen` stay inside the
  selected level-1 category instead of jumping into other categories.
- New `src/composables/hierarchyConfig.js` holds the hierarchy helpers that `App.vue` used to define
  inline, as pure functions with their own test file.

## 2026-09 - Runtime app config from public/app-config

- A JSON app config placed in `public/app-config/` is now loaded at startup and replaces
  `config/app.config.js` as the base layer, so deployment settings no longer have to be baked into
  the build. Produce the file with `App-Einstellungen als JSON herunterladen` in the
  `Einstellungen` tab.
- The filename comes from the new build-only key `defaultAppConfig` in `config/app.config.js`
  (default `viewer-editor-app-config.v1.json`); empty disables the fetch. It is deliberately not
  runtime-editable, because it decides where the config is fetched from and so cannot come from the
  file it addresses.
- Precedence is unchanged where it matters: a config saved in the `Einstellungen` tab
  (`viewerEditor.appConfig.v1`) still wins over the file, and is neither overwritten nor cleared by
  it. `Gespeicherte App-Einstellungen loeschen` now falls back to the deployed file rather than to
  `app.config.js`. The tab shows which base is active and whether localStorage is overriding it.
- If the fetch, the JSON parse or the object check fails, `app.config.js` stays the base and the app
  starts normally; the reason lands in `lastAppConfigLoadError` and a `console.warn`.
- Load order in `onMounted` is now binding: app config, then app mode, then connection profile - the
  file can carry `connectionMode` and `defaultConnectionProfile`, which are read right after.
- New `src/composables/publicConfigUrls.js` holds the runtime path-prefix resolution and the
  first-available fetch that the connection profile loader already used; `useConnectionProfileStore`
  now shares it instead of keeping its own copy.

## 2026-09 - Sticky topbar

- The topbar (title, online panel, transfer controls) is sticky from `769px` upward, so the
  save-changes UI stays reachable without scrolling back to the top of the item list.
- Scrolling past `24px` condenses it: the title is hidden and the vertical padding shrinks, so the
  controls fit on one row and the sticky stack costs less height; it expands again below `8px`
  (hysteresis, because condensing shortens the document). Below `769px` nothing changes.
- `--ve-header-offset` was referenced by the sticky offsets but never set; `App.vue` now measures the
  topbar alongside the tab row and edit header and writes all three onto `.app-shell`.
- Fixed two defects this surfaced: the sticky measurement was wired up *after* the awaited
  `loadConnectionProfileFromDefault` call, so a slow or failing profile request left the offsets
  unset and the sticky layers overlapped; and the `ResizeObserver` watched the default content-box,
  which does not change when only padding changes - it now observes the border-box.

## 2026-09 - Replacements applied to the data, online included

- Replacements are no longer collect-and-export only: adding a rule, or pressing `Ersetzungen anwenden`
  in the replacements tab, now rewrites the data. Matching is literal, substring based and
  case-sensitive; only fields of type `normal` and `text` are touched, read-only and reserved fields
  (`scan`, `suspendEditing`, `__onlineMeta`) are excluded. `allFields` means every configured field
  that qualifies.
- Online a run covers the **whole collection**: loaded items change in place and become regular field
  deltas, all remaining items are fetched, matched and registered as pending updates. Nothing is
  written until `Änderungen speichern` - the run only produces pending changes.
- Online the rules themselves live in a dedicated JSON prop `replacements` of the viewer settings
  singleton (legacy `settings.replacements` is still read). They are written with the same save action,
  so the save button is now also active when only rules changed.
- Rules loaded from Strapi or from a JSON import are never applied automatically; loading a bucket in
  hierarchy mode no longer discards unsaved rules.
- Replacements tab gained a per-rule remove button, an explicit apply button and a result summary;
  the field dropdown now offers only fields a rule can actually touch.
- New modules: `src/composables/replacementRules.js` (pure rule logic) and
  `src/composables/useReplacementsApply.js` (run orchestration).
- No undo and no dry run: a run changes values immediately, `Reset` before saving is the only way back.

## 2026-09 - Configurable scan source field

- Added optional online settings key `scanField` (legacy form `scan_field`, default `scan`) that names the Strapi field holding the image URL.
- `normalizeStrapiItem` now maps the configured source field onto `scan`, so data models that keep the URL under another key (e.g. `scan_url`) render scan previews without further changes; the rest of the UI still reads `item.scan` only.
- Behaviour is unchanged for existing instances: without `scanField` the source stays `scan`.

## 2026-08 - Sidebar suspend toggle and configurable field widths

- Moved the sidebar `suspendEditing` control (`Bearbeitung aussetzen`) into the edit form header, positioned next to the close button.
- Added new field configuration option `fieldWidth` with allowed values `33%`, `50%`, and `100%` to control how many editor fields share one row (3/2/1).
- Updated configuration validation and normalization so unsupported or missing `fieldWidth` values safely fall back to `100%`.
- Updated edit sidebar placement so all fields configured as `checkbox` render below the scan preview and above the `Ersetzen` block.

## 2026-07 - Online hierarchy and loading flow

- Added hierarchical item navigation via optional settings keys like `hierarchyFields` / `hierarchy_fields` (level 1 = category boxes, level 2 = collapsible header bars).
- Updated online loading flow for hierarchy mode: no upfront full-item fetch; first load level-1 buckets, then fetch items only for the selected level-1 value.
- Added robust hierarchy config parsing (legacy and nested shapes) plus fallback auto-detection when fields `level_1` and `level_2` exist.
- Ensured level-1 boxes are rendered immediately in hierarchy mode, even before any item cards are loaded.
- Added optional `firstLevelStaticList` support in online settings: when hierarchy mode is active and this list is present, level-1 boxes are rendered from config and no item or bucket fetch is done on startup; items are loaded only after selecting a level-1 box.
- Added top-header online toggle `Configuration only`: when enabled, startup loads only `response.data.settings` and skips all item requests.
- Extended configuration UI so hierarchy can be edited directly in the viewer (`hierarchyFields` list + `firstLevelStaticList` preset values for level 1).

## 2026-07 - Configuration-only settings hydration fix

- Fixed an online-mode regression where `Configuration only` could end up with an empty configuration UI after startup.
- The app now always keeps fetched Strapi settings (`response.data.settings`) as the active User-Config state in `Configuration only` mode, even when no items are loaded.

These changes are now reflected in `README.md`, `docs/technical-documentation.md`, and `docs/conventions.md`.
