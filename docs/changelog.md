# Changelog

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
