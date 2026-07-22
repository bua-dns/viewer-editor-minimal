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
