# Changelog

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
