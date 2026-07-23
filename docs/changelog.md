# Changelog

## 2026-07-22

- Cleaned up the header area so controls align in a single horizontal flow when space allows.
- Simplified authenticated online header state to only show the `Abmelden` button (removed the user label next to it).
- Removed unnecessary online status success messages from the header:
  - `Online-Konfiguration aus response.data.settings geladen.`
  - `Online-Items geladen: ...`
- Removed the unnecessary online transfer note:
  - `Online-Modus aktiv: JSON/CSV Upload und Download sind deaktiviert.`
- Replaced the password show/hide text button with icon-only eye / eye-off SVG controls in the login UI.
- Moved login inputs (`Identifier`, `Passwort`) into a modal window opened via `Anmelden` in online mode.
- Added modal close behavior for backdrop click and auto-close on mode switch/auth success.
- Unified login modal field appearance so identifier and password inputs share the same sizing behavior.
- Fixed global form styling so password inputs use the same base styles as text inputs by extending `src/assets/styles/base/_index.scss` to include `input[type='password']`.

---

Implemented — I started from your annotated plan and wired the first end-to-end Strapi persistence flow for online mode.
- Added backend identity + update helpers in src/services/strapiApi.js:
  - normalizeStrapiItem(...) supports both flattened rows and { id, attributes }
  - uses documentId first (Strapi v5), falls back to id
  - stores hidden row metadata in __onlineMeta
  - added buildStrapiUpdatePayload(...)
  - added updateCollectionItemInStrapi(...) (PUT <itemsPath>/<documentId> with { data: changedFields })
- Updated online item ingestion in src/stores/useOnlineItemsStore.js to use the new normalizer and fail fast if no stable id exists.
- Added online dirty/save tracking store src/stores/useOnlineUpdatesStore.js:
  - tracks per-item changed fields against snapshot baseline
  - removes deltas when user reverts a field back to original
  - sequential save orchestration with partial-failure handling
  - save status state: idle | saving | success | error
- Integrated save flow in src/App.vue:
  - field edits in online mode now register deltas
  - added onSaveOnlineChanges to persist only changed fields
  - on full success: calls markAsSaved(...) to sync baseline + clear dirty
  - clears online pending updates when leaving online mode/reloading online data/reset
- Extended src/components/OnlineAccessPanel.vue:
  - added Save changes button (with Saving... / Saved states)
  - shows unsaved online item count
  - shows save error + retry action
  - auto-clears success feedback after short timeout
- Hid internal metadata from editor/config surfaces:
  - src/App.vue excludes __onlineMeta from availableFieldKeys
  - src/composables/useFieldMapping.js excludes __onlineMeta from displayed fields
  - src/stores/useUserConfigStore.js excludes __onlineMeta from config keys
- Added wording keys for save UX in config/wording.js.
- Minor reset return adjustment in src/composables/useDataImportExport.js so app can clear online pending updates only when reset actually happened.