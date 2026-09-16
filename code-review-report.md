# Code Review Report — Modularity, Maintainability, Technical Debt

## 1 Overall assessment

The codebase has a real architecture, not an accidental one. It has a frozen field-type registry
with an explicit contract (`src/fields/fieldRegistry.js`), a Vue-free rule engine for replacements
(`src/composables/replacementRules.js`), a pure validator/normalizer pair for connection profiles
(`src/composables/connectionProfile.js`), and a Strapi HTTP layer that really is confined to one
module (`src/services/strapiApi.js`). 183 tests pass, and several of them pin down non-obvious
decisions (integer coercion rules, partial-language Wikidata merges, retry after a rejected
`populate` key) instead of restating the code. `docs/technical-documentation.md` is unusually
detailed and mostly accurate, including its own chapter on known limits.

Four themes account for nearly every finding below.

**Failures and unsaved work are not reliably shown to the user.** This theme carries the most risk,
and the first revision of this review missed it. Since commit `643adf3`, nothing renders import,
parse and embedded-config errors. The code still sets them, but the UI never shows them (MAINT-07).
A JSON file with an invalid embedded `config` loads its data anyway, and the next export silently
swaps the file's configuration for an auto-generated one. Pending online edits are thrown away
without warning when the user opens another hierarchy category, logs out, switches mode or toggles
`Configuration only`. The close-tab warning does not cover pending changes that exist only on the
server side (MOD-08). A partially failed save leaves successfully saved items without a new
baseline, so undoing one of those edits is silently dropped (DEBT-07). Each of these is a small fix.
Together they mean the user cannot trust the app to report what happened.

**The composition root has absorbed the architecture.** `src/App.vue` has 1,355 lines, with 37
top-level functions, 18 computed values and 11 watchers. Git shows it changed in **67 of 107
commits** up to the baseline, and in 13 of the 15 non-documentation commits among the last 20. It
is not just large. It owns decisions that belong elsewhere: how hierarchy fields are read from
Strapi settings, the exact order of the online initialisation flow, and when pending changes are
discarded. It is a `.vue` file and the project has no DOM test environment, so no test can reach
any of that logic. MOD-08 and MAINT-07 both live in exactly that untested layer.

**The same knowledge is re-derived instead of shared.** This is not cosmetic duplication.
Hierarchy resolution is implemented three times with *different* accepted key sets (MOD-02). Four
modules interpret the autosuggest `defs` shape (MOD-04). The reserved-field-key list and the allowed
field widths each exist in four places (MOD-03). `hasNonEmptyValue` decides both whether an item
counts as "edited" and which fields get POSTed, and it is copied across three layers (MAINT-03).
For settings that use a documented legacy shape, one of these divergences produces a blank Edit tab.

**Small deliberate shortcuts have outlived their reason.** A `v-html` that exists only to render a
`<br>` now renders text the backend controls (DEBT-01). A retry loop that works around one Strapi
quirk spins forever on another (DEBT-02). None of these is expensive to fix, which is also why
leaving them for another year has felt cheap.

**Worth keeping, and worth using as the template for the rest:** `fieldRegistry.js`,
`replacementRules.js`, `connectionProfile.js`, `publicConfigUrls.js` and `useReplacementsApply.js`
share one shape. They use pure functions or explicitly injected dependencies, hold no module-global
reactive state, import Vue only where needed, and have test files that check behaviour rather than
structure. `useReplacementsApply.js` in particular shows that the online/offline split *can* be
built as an injectable seam. Most recommendations below extend that existing pattern rather than
introduce a new one.

---

## 2 Scope and verification

### Reviewed baseline

| Item | Value |
| --- | --- |
| Repository | `viewer-editor-minimal-version` (HU Ur- und Frühgeschichte Kartei viewer) |
| Baseline commit | `54f233a` "load the app config from public/app-config at startup" |
| Revision 2 checked against | `24d85ff` on `session/2026-09-15-code-review`; its only change after `54f233a` is this report, so the application code is identical |
| Branch at first review | `sticky-topbar-and-runtime-app-config` (default branch: `main`) |
| Working tree | Clean at the start of both revisions. Neither revision changed anything except this report |
| Reviewed source | About 7,900 lines of first-party `src/` + `config/` code, about 3,100 lines of tests |

### Revision history

- **Revision 1 (2026-09-15):** First review with 19 findings.
- **Revision 2 (2026-09-16):** Checked every finding, line reference and numeric claim against the
  code again. Results:
  - **4 new findings.** MAINT-07 (P1), MOD-08 (P1), DEBT-07 (P2) and DEBT-08 (P3). Three of them
    were reproduced by running code.
  - **About 40 line references corrected**, mainly in `src/App.vue`, `useAppConfigStore.js`,
    `useConnectionProfileStore.js`, `strapiApi.js` and the documentation. Many were off by
    15–40 lines.
  - **Claims that were wrong and are now fixed:**
    - "`App.vue` changed in every one of the last 20 feature commits". Actually 13 of the 15
      non-documentation commits.
    - "`config/wording.js` was still edited 29 commits into its own obsolescence". It was converted
      to JSON in its last commit.
    - "`ListPanel` declares 33 props". It declares 38.
    - "`_planning/` is gitignored". It is tracked.
    - "`loadUserConfigFromSession` does not guard storage access". It does.
    - "§5 of the documentation promises guarded `sessionStorage`". It promises this only for
      `localStorage`.
    - "the `wikidata_autosuggest` branches are unreachable". The branch in `strapiApi.js` is
      reachable.
    - "`userConfigValidation.test.js` pins message content". It does not.
  - **Three open questions resolved.** Q4, Q6 and Q7 of revision 1; see §6.

### Areas inspected

Read in full:

- `src/App.vue`
- all stores and composables under `src/stores/` and `src/composables/`
- `src/services/strapiApi.js` and `src/fields/`
- `config/app.config.js`, `vite.config.js`, `package.json`
- `README.md`, `docs/technical-documentation.md`, `docs/conventions.md`
- both files under `public/app-config/` and `public/connection-profile/`
- `src/assets/styles/index.scss`, `legacy.scss` and `components/_index.scss`

Read at least through the script block and `defineProps`: all 17 components under
`src/components/`. Read substantially in full: `ListPanel.vue`, `ItemFieldEditor.vue`,
`DatabaseConnectionPanel.vue`, `OnlineAccessPanel.vue`, `UserConfigPanel.vue`,
`WikidataAutosuggestInput.vue` and `config/AutosuggestFieldConfig.vue`.

Sampled rather than read line by line:

- the `<template>` and `<style>` blocks of the larger SFCs
- `src/assets/styles/layout/_index.scss` (431 lines), `tokens/` and `base/`
- the 19 `*.test.js` files, read for setup patterns and for what they assert
- `config/wording.json`: 251 entries, inspected structurally and by key diff

### Workflows traced end to end

1. **Local JSON import → config apply → export.**
   `DataTransferControls` → `useDataImportExport.onDataFileSelected` →
   `useViewerData.importFromJsonText` → `parseJsonPayload` → `applyImportedConfigIfPresent` →
   `applyImportedConfigPayload` → `applyUserConfigToRawItems` → `onDownload`. Includes the
   invalid-file and invalid-embedded-config failure paths, and where their messages are displayed.
   This trace found MAINT-07.
2. **Online startup.** `App.vue onMounted` (app config → data mode → app mode → connection profile →
   `restoreSession`), then the watcher on `[appMode, isAuthenticated, onlineConfigOnly, baseUrl,
   configPath]` → `fetchOnlineSettings` → `setOnlineWording` → `applyImportedConfigPayload` →
   `fetchOnlineItems`. Includes the `Configuration only` early exit, the teardown branch and the
   `markOnlineSettingsInvalid` failure path.
3. **Hierarchy navigation.** `useOnlineItemsStore.fetchOnlineItems` (static list, level-1 value
   fetch, or flat) → `onSelectHierarchyLevel1` → `fetchOnlineItemsForHierarchyLevel1` → `ListPanel`
   level-2 grouping. This trace found MOD-02 and MOD-08.
4. **Edit → delta → save.** `ItemFieldEditor` → `onFieldChange` → `useViewerData.updateField` →
   `trackOnlineFieldChange` → `saveOnlineUpdates` (creates before updates) → `markAsSaved`.
   Includes the partial-failure path and `syncSnapshotItemAtIndex`. This trace found DEBT-07.
5. **Replacements run over a whole collection.** `ReplacementsUnit` →
   `useReplacementsApply.applyReplacementsNow` → `applyReplacementsToLoadedItems` +
   `trackOnlineReplacementUpdatesForRemainingItems` → pending updates → save, or discard (MOD-08).
6. **Runtime config resolution.** `resolvePublicConfigUrls` → `fetchFirstAvailableConfigText` →
   `loadEditableAppConfigFromDefault` / `loadConnectionProfileFromDefault`, success and failure
   branches. This trace found DEBT-03 and DEBT-04.
7. **Suspend-editing toggle.** Sidebar checkbox → `onSuspendEditingToggle` (with auto-advance) →
   `toggleSuspendEditingByUid` → the auto-unsuspend watcher. This trace found DEBT-08.

### Checks run

| Check | Command | Result |
| --- | --- | --- |
| Test suite | `npx vitest run` | **Pass**: 19 files, 183 tests, 3.7 s (re-run 2026-09-16) |
| Probe: paginated fetch loop | temporary vitest file | **Reproduced DEBT-02**: identical requests until the stub aborted at 51 calls |
| Probe: app-config reset | temporary vitest file | **Reproduced DEBT-03**: storage entry removed, `hasSavedEditableAppConfig === true` |
| Probe: invalid embedded config | temporary vitest file (real `useViewerData`, `useUserConfigStore`, `useDataImportExport`) | **Reproduced MAINT-07**: data loaded despite the error; export replaced the config |
| Probe: partial save failure | temporary vitest file (real `useViewerData`, `useOnlineUpdatesStore`, stubbed `fetch`) | **Reproduced DEBT-07**: reverting a saved field produces no pending update |
| Probe: suspend last item | temporary vitest file with `App.vue:568-584` and `:918-931` copied verbatim | **Reproduced DEBT-08**: suspension of the last list item is reverted immediately |
| Lint | — | **Not run: no linter configured** (no ESLint/Prettier config, no lint script) |
| Type check | — | **Not run: no type checking exists** (plain JS, no TS, no `checkJs`) |
| Production build | `vite build` | **Not run.** Not rebuilt, to avoid overwriting the untracked `dist/`. Its `index.html` (2026-09-04 12:24) uses base `/viewer-hu-pre-and-early-history/`, matching `vite.config.js` |
| CI | — | **None exists** (no `.github/`, `.gitlab-ci.yml` or hooks) |

In revision 1, the probe files were created inside `src/`, run once and deleted. In revision 2, all
probe files and a separate vitest config lived in the session scratchpad **outside the repository**
and pointed at the repository as root. `git status` was clean after every run in both revisions.
No application file, config file, dependency or existing document was modified.

The DEBT-08 probe runs copies of the two `App.vue` code blocks against the real `useViewerData`,
because mounting `App.vue` is not possible without a DOM environment (MAINT-01). It demonstrates the
behaviour of that code; it does not exercise the mounted component.

### Exclusions and limitations

- `node_modules/` and `dist/` were excluded from code inspection, as instructed. The review assessed
  how dependencies are *used*, not their contents.
- `_INTERN/` is gitignored working material and was read only for the task brief.
  `_planning/journal.md` is tracked. It was skimmed for project context and contains no
  implementation claims.
- **No behaviour was checked in a running browser or against a live Strapi instance.** Everything
  about online mode comes from reading the code and the existing tests, except the probes above,
  which are labelled as such. Findings that depend on a specific server response (the trigger for
  DEBT-02, the MOD-02 settings shapes) describe the scenario explicitly instead of claiming it was
  seen in production.
- `config/wording.json` was compared with `config/wording.js` by key, not by translation quality.
- Visual/CSS correctness and accessibility beyond the ARIA attributes visible in the markup were not
  assessed.

---

## 3 Prioritized findings index

| ID | Title | Category | Priority | Confidence | Affected area | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| MAINT-07 | Import and config-validation errors are recorded but never displayed; an invalid embedded config is silently replaced on export | Maintainability / Correctness | P1 | High (verified) | `App.vue`, `useDataImportExport`, `useViewerData` | S |
| MOD-08 | Nobody owns unsaved online changes; navigation and session events discard them silently | Modularity / State ownership | P1 | High | `App.vue`, `useOnlineUpdatesStore` | S–M |
| MOD-01 | `App.vue` owns orchestration that belongs in testable modules | Modularity | P1 | High | `src/App.vue` | L |
| MOD-02 | Hierarchy configuration is resolved three times, with divergent key sets | Modularity | P1 | High | `App.vue`, `useOnlineItemsStore`, `useUserConfigStore` | M |
| DEBT-01 | Backend-controlled wording is rendered through `v-html` | Debt / Security | P1 | High | `footer/Identity.vue`, `useAppConfigStore` | S |
| MAINT-01 | No component test seam, no lint, no type check, no CI | Maintainability | P1 | High | tooling, `package.json` | M |
| MOD-03 | The field-type contract leaks outside the registry | Modularity | P2 | High | `fieldRegistry`, `ItemFieldEditor`, 5 further modules | M |
| MOD-04 | The autosuggest config schema has four independent interpreters | Modularity | P2 | High | `useWikidataSearch`, 3 components | M |
| MOD-05 | Parameter-bag composables and prop-bag components | Modularity | P2 | High | `useDataImportExport`, `ListPanel`, `App.vue` | M |
| MOD-06 | Two opposite dependency conventions in the Strapi layer | Modularity | P2 | High | `src/stores/useOnline*.js`, `useAuthStore` | M |
| MAINT-02 | Error messages bypass the wording system, in two languages | Maintainability | P2 | High | `useViewerData`, `userConfigValidation`, online stores | M |
| MAINT-03 | No shared utility module; a business rule is copied three times | Maintainability | P2 | High | repo-wide | S |
| MAINT-05 | Documentation has drifted on deployment-critical and failure-path facts | Maintainability | P2 | High | `README.md`, `docs/technical-documentation.md` | S |
| DEBT-02 | Unbounded request loop when Strapi answers 200 with a non-JSON body | Debt / Reliability | P2 | High (verified) | `strapiApi.js` | S |
| DEBT-03 | After clearing saved app settings, the UI still says they are active | Debt / Correctness | P2 | High (verified) | `useAppConfigStore`, `DatabaseConnectionPanel` | S |
| DEBT-04 | A failed default-profile fetch discards a valid stored connection profile | Debt / Reliability | P2 | High | `useConnectionProfileStore` | S |
| DEBT-07 | After a partially failed save, successfully saved items keep a stale baseline | Debt / Correctness | P2 | High (verified) | `App.vue`, `useOnlineUpdatesStore` | S |
| MOD-07 | Dataset-specific assumptions embedded in generic components | Modularity | P3 | High | `ListPanel.vue`, `WikidataAutosuggestInput.vue` | S |
| MAINT-04 | `sessionStorage` access is unguarded while `localStorage` is guarded | Maintainability | P3 | High | `useDataTransferStore`, `useUserConfigStore`, `App.vue` | S |
| MAINT-06 | The app-config shape is declared three times and never validated | Maintainability | P3 | High | `app.config.js`, `useAppConfigStore`, `DatabaseConnectionPanel` | S–M |
| DEBT-05 | Dead, stale and inconsistently reachable code paths | Debt | P3 | High | `config/wording.js`, `useAuthStore`, `App.vue`, `useAppConfigStore`, `strapiApi` | S |
| DEBT-06 | Collection-wide saves are sequential, unbatched and report no progress | Debt / Performance | P3 | Medium | `useOnlineUpdatesStore` | M |
| DEBT-08 | Suspending the selected item is reverted when it is last in the list | Debt / Correctness | P3 | High (verified by harness) | `App.vue` | S |

Effort assumes a developer who already knows this codebase. `S` is under a day, `M` is one to three
days, and `L` is more than three days, best split across several changes.

---

## 4 Detailed findings

### MAINT-07 — Import and config-validation errors are recorded but never displayed; an invalid embedded config is silently replaced on export

- **Category:** Maintainability / diagnosability, correctness · **Priority:** P1 · **Confidence:** High
  (data loss **verified by execution**; the missing render site is established by grep and git history)
- **Location:**
  - Error state: `errorMessage` at `src/composables/useViewerData.js:246` and
    `modeErrorMessage` at `src/stores/useDataTransferStore.js:7`.
  - Writers: `useViewerData.js:336,351,356`; `src/composables/useDataImportExport.js:181,192,230`.
  - Unused bindings: `src/App.vue:46` (`modeErrorMessage`) and `:127` (`errorMessage`).
  - Former render site, removed in commit `643adf3`: today's status panel at `src/App.vue:1313-1318`.
  - Import order: `useDataImportExport.js:190-204` and `:176-188`; export at `:251-275`.

**Observed.** Both refs are written on every import failure path:

- invalid JSON or CSV (`'JSON ist ungueltig (Parse-Fehler).'`)
- a file whose type does not match the selected mode
- a failed sample-data fetch
- an embedded `config` rejected by `validateImportedConfigPayload`

`App.vue` destructures both refs, but **no template in `src/` references either one**. A grep for
`errorMessage` and `modeErrorMessage` across `src/**/*.vue` finds only `StartFromScratchModal.vue`'s
own, unrelated prop. The render site was removed by commit `643adf3` (2026-05-21, "reorganize status
and footer layout across tabs"):

```diff
-          <p v-if="errorMessage" class="error">{{ errorMessage }}</p>
-          <p v-else-if="modeErrorMessage" class="error">{{ modeErrorMessage }}</p>
+          <p v-else>{{ t('noFileLoaded', 'Noch keine Datei geladen') }}</p>
```

The import runs in two steps with no rollback between them. `onDataFileSelected` first commits the
data (`parseDataFileContent` → `initializeFromJsonArray`) and only afterwards validates the embedded
config (`applyImportedConfigIfPresent`). When the second step fails, it sets `errorMessage` and
returns `false`, and the caller ignores that return value (`useDataImportExport.js:203`).

**Verification.** A temporary probe wired the real `useViewerData`, `useUserConfigStore` and
`useDataImportExport` together. It imported a file whose `config` labels `title` as `"Titel"` with
type `text`, sets `itemLabelField: "title"`, and gives a second field an unknown type. Then it
exported:

```
PROBE items loaded = 1 | errorMessage = "JSON-Config ist ungueltig: Feldtyp bei note wird nicht unterstuetzt."
PROBE exported config itemLabelField = "" | title = {"type":"normal", ... "label":"", ...}
```

**Root cause.** Two independent gaps meet here.

1. The data layer reports errors by writing a loose ref, and the only thing connecting that ref to
   the screen is a template line in `App.vue`. Nothing checks that connection, so a layout
   refactoring could delete it without any test failing (see MAINT-01).
2. The documented strict validation (`docs/technical-documentation.md` §9.2 step 5: *"bei Fehler
   harter Abbruch mit Fehlermeldung"*, step 6: *"der alte Stand bleibt erhalten"*) runs *after* the
   state change, so it cannot abort anything.

**Concrete consequence.**

- **In the offline workflow, which is the core use case, every import failure is silent.** Choosing
  a malformed file, or a `.csv` in JSON mode, does nothing visible.
- **Data loss.** When a file's embedded configuration contains one invalid entry (for example, a
  type name from a newer version or a typo), the items still load. They show with a default
  configuration that has no labels, no field types and no caption field, and nothing says why. If
  the user edits and downloads, `onDownload` writes `createUserConfigPayload()`, which is the
  auto-derived default. The original configuration in their file is replaced. Every later import of
  that file then has the degraded config.
- The German validation messages (MAINT-02) are, for the offline path, not shown at all.

**Recommendation.** Two small changes at the boundary where they belong:

1. **Make import atomic.** Validate the embedded config *before* committing the data. In
   `importFromJsonText`, call `validateImportedConfigPayload(result.config)` once `parseJsonPayload`
   succeeds and before `initializeFromJsonArray`. That module is pure, so importing it into
   `useViewerData.js` adds no Vue or store coupling. On failure, set the error and return `false`,
   so the previous state remains as §9.2 promises. `applyImportedConfigIfPresent` then only applies
   an already-validated config.
2. **Restore a render site close to the controls that cause the errors.** Pass the two messages to
   `DataTransferControls` in the header, where the import is triggered. Then the message is visible
   on every tab, not only in the Edit tab's status panel. Add a component test for it once MAINT-01
   is in place, so a layout change cannot remove it silently again.

**Expected benefit.** Import failures become visible, and an invalid config can no longer produce a
file whose configuration was silently replaced. The documented §9.2 contract becomes true.

**Effort:** S. Both changes are small. The validation move needs a `useViewerData.test.js` case for
the rejected-config path.

**Risks.** Files that currently "work" with a partly invalid config will be rejected outright. That
is the documented behaviour, but it is stricter than what users see today. The error message must
therefore be visible *before* this ships.

**Dependencies.** None for the fix. MAINT-01 is needed for the regression test on the render site.
MAINT-02 decides the language of the restored messages.

**Acceptance criterion.**

- Importing a JSON file with an invalid embedded `config` leaves `rawItems` and `importFileName`
  unchanged, and shows the validation message in the header.
- Importing a `.csv` in JSON mode shows the mode-mismatch message.
- A test asserts the rejected-config case at composable level.
- `grep -rn "errorMessage" src/**/*.vue` finds a render site for both refs.

---

### MOD-08 — Nobody owns unsaved online changes; navigation and session events discard them silently

- **Category:** Modularity / state ownership · **Priority:** P1 · **Confidence:** High (static; the
  call chains are direct and short)
- **Location:**
  - Pending set: `src/stores/useOnlineUpdatesStore.js:19-20` (module-global) and
    `clearOnlineUpdates` at `:44-49`.
  - Discard sites in `src/App.vue`:
    - `:502` in `onSelectHierarchyLevel1`
    - `:1046` in the watcher's teardown branch
    - `:1065` and `:1088` when the online initialisation watcher re-runs
  - Close-tab guard: `src/App.vue:380-385` (`hasPendingChanges`) and `:782-786`
    (`beforeUnloadListener`).
  - Triggers with no guard: `src/components/OnlineAccessPanel.vue:52,56,74` (`setAppMode`,
    `setOnlineConfigOnly`, `logout`) and `src/components/ListPanel.vue:369`.

**Observed.** Pending online deltas are keyed by `itemsPath::id` and are independent of which items
are currently loaded. They are thrown away in four situations, and none of them checks
`hasPendingOnlineChanges` first:

| Trigger | Path | Discards |
| --- | --- | --- |
| Clicking any level-1 box (including the one already active) | `onSelectHierarchyLevel1` → `clearOnlineUpdates()` (`App.vue:502`) | all pending updates and creates |
| Logout, switching to offline, session loss | watcher teardown (`App.vue:1042-1051`) | all |
| Toggling `Configuration only`; changing `baseUrl`/`configPath` | watcher re-run → `clearOnlineUpdates()` (`:1065`) | all |
| Reset | `onReset` (`App.vue:742-747`) | all. This one is intended and documented (§12.9) |

No component asks for confirmation before any of these triggers.

The close-tab guard does not see pending online updates at all:

```js
const hasPendingChanges = computed(() => { ... return isDirty.value || hasReplacementsChanges.value })
function beforeUnloadListener(event) {
  if (!hasPendingChanges.value && !hasUnappliedUserConfigChanges.value) return
```

`hasPendingUpdates` is not part of this condition. `isDirty` is set only when *loaded* items change
(`useViewerData.js:414`), and `initializeFromJsonArray` resets it (`:327`).

**Root cause.** The lifecycle of the pending-change set has no owner. `App.vue` clears it as a side
effect of re-initialising the view model. That treats "which items are loaded" and "which changes
are unsaved" as one thing, although the store keeps them separate. The close-tab guard was written
for the offline model, where `isDirty` covered all unsaved work, and was never extended when online
deltas became a second, independent source of unsaved work.

**Concrete consequence.** Two scenarios follow directly from the code.

1. **The documented collection-wide replacements workflow** (`docs/technical-documentation.md`
   §11.3: *"Im Hierarchie-Modus sind Änderungen an nicht geladenen Items daher erst nach dem
   Speichern … sichtbar"*).
   1. In hierarchy mode, the user runs the saved replacement rules while no bucket is loaded.
   2. `applyReplacementsToLoadedItems` finds nothing, so `isDirty` stays `false`. The rules did not
      change, so `hasReplacementsChanges` is `false`.
   3. `trackOnlineReplacementUpdatesForRemainingItems` registers N pending updates, and the header
      shows "Unsaved online changes in items: N".
   4. The user clicks a category box to check the result. All N updates disappear, the counter
      vanishes, and no message appears. Closing the tab instead gives no warning either.
2. **Ordinary editing.** The user edits several cards in category A and then clicks category B
   before saving. The edits are lost, and category A reloads with server values when they return.

The lost work can be large, since a replacements run can cover a whole collection. The user has no
indication anything was lost.

**Recommendation.** Decide ownership once, then enforce it at the two boundaries:

1. **Guard the discard points (S).** Add one `confirmDiscardPendingOnlineChanges()` check in
   `App.vue`, backed by an in-app dialog; the codebase already has modal patterns. Call it before
   `onSelectHierarchyLevel1` fetches, and before the mode, `Configuration only` and logout actions
   take effect. Those actions live in `OnlineAccessPanel`. Have them emit an intent that `App.vue`
   confirms, instead of calling the stores directly.
2. **Extend the close-tab guard (S).** Add `hasPendingOnlineChanges` to the `beforeUnloadListener`
   condition.
3. **Longer term (M), with MOD-01.** Move "when may pending changes be discarded" into the extracted
   `useOnlineSession`, so it is decided in one tested place instead of at four call sites. Whether
   pending edits should *survive* a bucket switch rather than block it is a product decision (see
   Q6). Updates are technically safe to keep, because `saveOnlineUpdates` uses only
   `entry.changedFields`. The view, however, would reload server values on top of unsaved deltas,
   which needs design work.

**Expected benefit.** Unsaved work is never discarded without an explicit decision, and closing the
tab warns whenever something is unsaved.

**Effort:** S for steps 1–2, assuming a small confirm dialog. M for step 3.

**Risks.** A confirmation on every bucket click would be annoying. Show it only when
`hasPendingOnlineChanges` is true. Reset keeps its current semantics.

**Dependencies.** Step 3 belongs with MOD-01. A test for the guard needs MAINT-01.

**Acceptance criterion.**

- With pending online updates, selecting a level-1 box, logging out, switching mode or toggling
  `Configuration only` does not clear `pendingUpdatesById` unless the user confirms.
- `beforeunload` calls `preventDefault` when `hasPendingUpdates` is true and `isDirty` is false.
- Both are covered by a component or extracted-module test.

---

### MOD-01 — `App.vue` owns orchestration that belongs in testable modules

- **Category:** Modularity / cohesion · **Priority:** P1 · **Confidence:** High
- **Location:** `src/App.vue:1-1107` (script block). Representative regions:
  - `:199-372`: hierarchy state and derivation
  - `:1033-1097`: online initialisation watcher
  - `:522-566`: save orchestration
  - `:794-846`: sticky-layout measurement, plus the `activeTab` watcher at `:1021-1031`

**Observed.** The file is 1,355 lines. Its script has 37 top-level functions, 18 computed values and
11 `watch` blocks, and the template creates `ListPanel` twice with 30+ props each. Its
responsibilities include:

- deriving hierarchy field keys from raw Strapi settings
- building level-1/level-2 option lists from `rawItems`
- sequencing the online initialisation
- deciding when pending online changes are discarded (MOD-08)
- merging the user config into the settings payload before write-back
- measuring three sticky elements with a `ResizeObserver` and writing CSS custom properties
- managing lightbox, extended-edit, modal and image-failure UI state
- owning the `beforeunload` and `Escape` handlers

The documentation states the intent plainly (`docs/technical-documentation.md:1006`, §14):
*"`App.vue` bleibt Composition-Root und beschränkt sich auf Verdrahtung von Komponenten, Stores,
Watchern und Lifecycle-Events."* Wiring is the stated contract. The code has grown beyond it.

**Root cause.** Each new feature needed a place where two or more stores meet. The composition root
was the only such place, and no seam was added as the count grew. So cross-store coordination piled
up in `App.vue` by default rather than by decision. The two real seams that were extracted
(`useDataImportExport`, `useReplacementsApply`) show the pattern was understood. It just was not
applied to the online flow or the hierarchy.

**Concrete consequence.** This is measurable. Up to the baseline, `git log` shows `src/App.vue`
modified in **67 of 107 commits (63%)**. Among the last 20 commits it was touched by 13 of the 15
that were not documentation-only; the exceptions are `60c95dd` and `128b759`. Vitest has no DOM
environment configured (see MAINT-01), so *none* of this logic has a test. The file that changes
most often has no regression protection at all, and the two P1 correctness findings of this review
(MAINT-07, MOD-08) both sit in it. Two developers adding unrelated features would very likely
conflict in it.

**Recommendation.** Do not split `App.vue` by line count. Extract by *responsibility*, reusing the
`useReplacementsApply` pattern: explicit dependency injection, a returned set of actions, and no Vue
component needed to test it. In priority order:

1. `useStickyHeaderMetrics.js`: the `ResizeObserver`, listeners and CSS-variable writes
   (`src/App.vue:794-846`, plus the `onBeforeUnmount` and `activeTab` wiring). Self-contained, with
   no dependencies on the rest; the cheapest extraction.
2. `useHierarchyNavigation.js`: owns `hierarchicalFields`, level-1/level-2 option building,
   selection and expansion state, and `onSelectHierarchyLevel1`. This extraction also fixes MOD-02,
   so do both at once.
3. `useOnlineSession.js`: owns the initialisation watcher (`src/App.vue:1033-1097`), the teardown
   branch, the discard policy for pending changes (MOD-08), and the `onSaveOnlineChanges` and
   `onApplyUserConfig` write-back. Its inputs are already explicit (`appMode`, `isAuthenticated`,
   `connectionProfile`, `onlineConfigOnly`). Passing them in instead of closing over them makes the
   sequence testable.

Leave the tab state, lightbox state and template in `App.vue`; those really are composition-root
concerns.

**Expected benefit.** The online initialisation sequence, the discard policy and the hierarchy rules
become unit-testable without a DOM. `App.vue` shrinks to roughly 600–700 lines of wiring, and feature
work stops converging on one file.

**Effort:** L. Assumes the three extractions land as separate commits, each with tests, and that the
MAINT-01 test environment is in place first; otherwise the extractions cannot be verified.

**Risks.** Extracting the watchers is the risky part. `onMounted` contains an ordering comment
marked as binding (`App.vue:848-849`: *"Reihenfolge ist bindend"*), and the sticky wiring must run
before the first `await` (`:830-833`). Extract each sequence *as it stands*, with the ordering
comments carried across, before changing anything about it.

**Dependencies.** Should follow MAINT-01. Step 2 carries MOD-02's fix, and step 3 carries MOD-08's
long-term fix. MOD-06 makes step 3 considerably easier.

**Acceptance criterion.**

- `src/App.vue` no longer contains `normalizeHierarchyFields`,
  `buildHierarchyLevel2OptionsFromRawItems`, the `ResizeObserver` wiring, or the body of the online
  initialisation watcher.
- Each extracted module has a test file that covers at least its failure path.
- `npx vitest run` stays green.
- The tab, edit and online flows behave identically in a manual smoke test.

---

### MOD-02 — Hierarchy configuration is resolved three times, with divergent key sets

- **Category:** Modularity / coupling · **Priority:** P1 · **Confidence:** High
- **Location:**
  - `src/App.vue:281-307`: `hierarchicalFields` computed
  - `src/stores/useOnlineItemsStore.js:26-87`: `normalizeHierarchyFields(settings)`
  - `src/stores/useUserConfigStore.js:106-146`: `resolveHierarchyFieldsFromConfig(configPayload)`
  - `src/components/ListPanel.vue:241-247`: a fourth normalisation of the resulting values

**Observed.** Three separate implementations read the same tolerant settings shape, and they do not
accept the same keys:

| Source key | `App.vue` | `useOnlineItemsStore` | `useUserConfigStore` |
| --- | --- | --- | --- |
| `hierarchyFields` / `hierarchy_fields` / `hierarchicalFields` | yes | yes | yes |
| `hierarchy.fields` | yes | yes | yes |
| `config.hierarchyFields` | yes | yes | **no** |
| `config.hierarchy_fields` | **no** | yes | **no** |
| `hierarchy.{level1,level2}` object | yes | yes | yes |
| auto-detect `level_1`/`level_2` (or `level1`/`level2`) in `settings.fields` | yes | yes | **no** |

They also resolve conflicts differently. `App.vue` checks each tier for at least two entries and
falls through to the next tier otherwise. The store takes the first *array* it finds, even with
fewer than two entries, and then skips straight to auto-detection. So
`{ hierarchyFields: ['a'], hierarchy: { fields: ['a', 'b'] } }` enables the hierarchy in `App.vue`
but not in the store.

The static level-1 list is split the same way: `useOnlineItemsStore.js:89-102` accepts
`config.firstLevelStaticList`, and `useUserConfigStore.js:148-156` does not.

The store already publishes its normalised result, and `App.vue` already imports it and then ignores
it. `src/App.vue:83` destructures `hierarchyFields: onlineHierarchyFields`, never uses that binding,
and re-derives the same value at `:281`.

**Root cause.** `App.vue` needs the hierarchy field keys for rendering, `useOnlineItemsStore` needs
them to choose a fetch strategy, and `useUserConfigStore` needs them to round-trip the Configuration
tab. Instead of one resolver with three consumers, each consumer grew its own. Each was extended
with a new tolerated key at a different time, so they drifted apart without any single change
looking wrong. `docs/technical-documentation.md` §12.5 (`:797-801`) documents the store's key set as
if it were the only one.

**Concrete consequence.** Take a Strapi settings singleton that nests the hierarchy as
`settings.config.hierarchy_fields`, a shape the documentation explicitly lists. The two modules
disagree:

1. `fetchOnlineItems` sees two hierarchy fields and takes the hierarchy branch. It fetches only the
   level-1 field values, populates `hierarchyLevel1Options`, and returns `items: []` with
   `hierarchyEnabled: true` (`useOnlineItemsStore.js:178-214`).
2. In `App.vue`, `hierarchicalFields` returns `[]`, so `hierarchyEnabled` is `false`, so
   `hierarchyLevel1Options` returns `[]` (`App.vue:312-318`) and `ListPanel` receives
   `hierarchy-fields: []`.
3. `ListPanel.hasHierarchy` is false, so it renders the flat list, which is empty.

The user sees the Edit tab with *"Nach dem Upload erscheinen hier die Einträge."*, with no error, no
level-1 boxes, and no sign that the data was never requested. Debugging this requires knowing that
two functions answer the same question differently.

A second consequence affects the Configuration tab. `useUserConfigStore` accepts neither `config.*`
form nor auto-detection, so a working hierarchy configured in any of those shapes round-trips as
*empty* hierarchy fields. Pressing `Konfiguration anwenden` in online mode then writes
`hierarchyFields: []` back to Strapi at top level (`App.vue:603-612` merges
`createUserConfigPayload()`, `useUserConfigStore.js:625`). The original nested keys survive the
merge but are now *shadowed*. The store's resolver finds the empty top-level array first
(`useOnlineItemsStore.js:36`) and never looks further. The hierarchy is effectively switched off for
every user of that instance, and restoring it requires editing the settings record by hand.

**Recommendation.** Create `src/composables/hierarchyConfig.js` exporting
`resolveHierarchyFields(settings)` and `resolveFirstLevelStaticList(settings)`:

- pure functions accepting the **union** of the three current key sets
- one explicit rule for conflicts: take the first candidate with at least two entries, as `App.vue`
  does
- a test that pins every accepted shape

Make all three call sites use it. In `App.vue`, prefer the store's already-normalised
`onlineHierarchyFields` over re-deriving it, and delete the local copy. Do this as part of MOD-01's
`useHierarchyNavigation` extraction, so the hierarchy code is touched once, not twice.

**Expected benefit.** One answer to "is the hierarchy active, and on which fields", pinned by tests.
The `config.hierarchy_fields` blank screen becomes impossible, and `Konfiguration anwenden` can no
longer switch off a hierarchy it failed to read.

**Effort:** M. The resolver itself takes an afternoon. Agreeing the union of accepted shapes and
writing the shape-matrix test is most of the work.

**Risks.** Widening `useUserConfigStore`'s accepted set changes what `Konfiguration anwenden` writes
back for instances that use a `config.*` shape: the actual fields instead of an empty list. That is
the intended fix, but it is still a behaviour change against live data. Check it against a copy of
the production settings singleton before the first write-back.

**Dependencies.** Best sequenced with MOD-01 step 2. Shares its root cause with MOD-03 and MOD-04.
Q2 decides whether the union can later be narrowed.

**Acceptance criterion.**

- A single exported `resolveHierarchyFields` is the only implementation in `src/`.
- A test asserts identical output for every input shape listed in §12.5 and for the conflict case
  above.
- A settings payload using `config.hierarchy_fields` renders level-1 boxes in the Edit tab.

---

### DEBT-01 — Backend-controlled wording is rendered through `v-html`

- **Category:** Technical debt / security · **Priority:** P1 · **Confidence:** High
- **Location:** `src/components/footer/Identity.vue:22`. Wording merge at
  `src/stores/useAppConfigStore.js:279-295`. Injection point at `src/App.vue:1059`
  (`setOnlineWording(result.wording)`). Secondary sink at `src/components/footer/Identity.vue:14`.

**Observed.**

```vue
<span class="identity-credit" v-html="t('footerIdentityCredit', 'A tool by ...')" />
```

`t()` resolves against `mergedWording`, which merges the dictionary returned by `GET <configPath>`
(`data.wording`) over the local one. Only two handles are protected from backend override:
`localWordingOverrideKeys = new Set(['tabDatabaseConnection', 'dbConnectionOpenTab'])`
(`useAppConfigStore.js:9`). `footerIdentityCredit` is not among them. The Strapi settings singleton
can therefore supply its value, which is then inserted as raw HTML.

Regular users of the application can write to that singleton. `Konfiguration anwenden` in online
mode sends `PUT <configPath>` (`useOnlineSettingsStore.persistOnlineSettings` →
`updateViewerSettingsInStrapi`), and `Änderungen speichern` sends a second `PUT` to the same path for
`replacements`.

**Root cause.** The `v-html` is older than the backend-wording feature. It exists for one reason: the
shipped value contains a `<br>` (`"Ein Tool von Digitales Netzwerk Sammlungen<br>Berlin University
Alliance"` in `config/wording.json`). A presentational shortcut that was harmless for a build-time
constant became a sink once the same dictionary gained a remote source.

**Concrete consequence.** Anyone who can write the viewer-settings singleton can inject script that
runs in every other user's browser. The JWT is kept in `localStorage` (`useAuthStore.js:5`,
`viewerEditor.authToken.v1`), so injected script can read it. In practice, "can edit the viewer
configuration" becomes "can act as any other user of this Strapi instance", a privilege boundary the
application otherwise keeps. The payload is stored, so it runs for every user on every page load
until someone cleans the settings record. How severe this is depends on who can write the singleton
(Q3).

A second, lower-severity case of the same kind sits eight lines above. `:href="githubRepoUrl"`
(`Identity.vue:14`) is bound without checking the protocol, and `normalizeGithubRepoUrl`
(`useAppConfigStore.js:18-20`) only trims. The value can come from the runtime-loaded
`public/app-config/*.json`, so a `javascript:` URL there becomes a link that runs script when
clicked. The exposure is much narrower, since it needs control of the deployed file or the user's
own `localStorage`, but the shape and the fix are the same.

**Recommendation.** Two small, independent changes:

1. Remove the `v-html`. Render the credit as text and express the line break structurally: either
   split the handle on `\n` and emit one `<span>` per line, or let CSS (`white-space: pre-line`)
   handle it. In the same commit, change the two `footerIdentityCredit` values in
   `config/wording.json` from `<br>` to `\n`.
2. Validate `githubRepo` in `normalizeGithubRepoUrl`. Parse it with `new URL(...)` and return `''`
   unless the protocol is `http:` or `https:`. That check already exists in
   `connectionProfile.js:3-5` (`isHttpProtocol`); export and import it rather than rewriting it
   (see MAINT-03).

Do **not** add a sanitiser library. Nothing in this application needs backend HTML, and a
sanitiser would keep the sink while making it look safe.

**Expected benefit.** The remote-wording feature no longer carries a script-execution channel, and
the rule "config is data, never markup" actually holds.

**Effort:** S. Under an hour, including the wording-file edit.

**Risks.** Cosmetic only: check the footer line break again at desktop and mobile widths. If a
deployment has already customised `footerIdentityCredit` with HTML in its Strapi settings, that
markup will start showing as literal text. That is intended, but worth announcing.

**Dependencies.** None.

**Acceptance criterion.**

- `grep -rn "v-html" src/` returns nothing outside `InfoPanel.vue`. That file renders a `.md` file
  bundled at build time, with `html: false` (`InfoPanel.vue:26`), and is not a concern.
- A wording override of `footerIdentityCredit` containing `<img src=x onerror=alert(1)>` renders as
  visible text.
- `githubRepo: "javascript:alert(1)"` produces no rendered link.

---

### MAINT-01 — No component test seam, no lint, no type check, no CI

- **Category:** Maintainability / testability · **Priority:** P1 · **Confidence:** High
- **Location:** `package.json:6-17`; `vite.config.js` (no `test` block); repository root (no
  `.github/`, no ESLint/Prettier config, no `tsconfig.json`, no hooks).

**Observed.** The suite is real and passing (19 files, 183 tests), but every test targets
`src/composables/`, `src/stores/`, `src/services/` or `src/fields/`. **No `.vue` file has a test**,
and the tooling to write one is not installed. `vite.config.js` declares no `test` configuration, so
vitest runs in its default `node` environment, and `jsdom`, `happy-dom` and `@vue/test-utils` are
missing from `devDependencies`.

On top of that:

- **No linter.** That is how the unused `onlineHierarchyFields`, `errorMessage` and
  `modeErrorMessage` bindings in `App.vue`, and the dead `supportedLanguages` computed, went
  unnoticed.
- **No type or JSDoc checking.** The 26-key parameter object of `useDataImportExport` has no checked
  contract.
- **No CI.** `pnpm test` runs only when someone remembers.

**Root cause.** The test environment was set up for the layers that were easy to test, and the
component layer was left for later. Without it, "this logic needs a test" turned into "extract it to
a composable". That instinct is good and produced several of the well-designed modules praised
above, but it has a ceiling. Logic that is really about component composition, such as `App.vue`'s
watchers and templates, has nowhere else to go.

**Concrete consequence.** The untested surface is exactly the surface that changes most:

| File | Commits up to the baseline | Tests |
| --- | --- | --- |
| `App.vue` | 67 of 107 | none |
| `UserConfigPanel.vue` | 15 | none |
| `ListPanel.vue` | 11 | none |
| `ItemFieldEditor.vue` | 10 | none |

This is not hypothetical. MAINT-07 is a regression, introduced by a layout commit, that removed the
only display of import errors, and it went unnoticed for four months. MOD-08 and DEBT-08 are
behaviour bugs in the same untested layer. Every finding in this report that lives in a `.vue` file
cannot currently be fixed *with proof* that behaviour was preserved: MAINT-07's render site, MOD-08,
MOD-01, the `App.vue` half of MOD-02, MOD-05, MOD-07, DEBT-01 and DEBT-08. This finding gates most
of the others.

**Recommendation.** Two steps, smallest first.

1. **Enable component testing.** Add `jsdom` (or `happy-dom`) and `@vue/test-utils` to
   `devDependencies`, and a `test: { environment: 'jsdom' }` block to `vite.config.js`. Then write
   tests for the highest-value behaviours rather than for coverage:
   - the import error message is visible (MAINT-07)
   - the pending-changes guard (MOD-08)
   - `ListPanel`'s caption resolution and hierarchy grouping
   - `ItemFieldEditor`'s registry-driven rendering
2. **Add a lint and a check script.** ESLint with `eslint-plugin-vue`'s recommended set plus
   `no-unused-vars` would have flagged DEBT-05's dead bindings and the orphaned error refs of
   MAINT-07 for free. Add `"check": "eslint . && vitest run"`. If the project ever gains a second
   contributor, add a GitHub Actions workflow that runs it on push.

Type checking is *not* recommended at this stage. Converting to TypeScript is a large change with no
demonstrated defect to justify it here. The parameter-bag contracts that would benefit most (MOD-05)
are better fixed by shrinking them than by typing them.

**Expected benefit.** Makes MOD-01, MOD-02, MOD-05, MOD-07 and MOD-08 safe to implement, and gives a
regression test for MAINT-07. Unused-code and common-mistake classes get caught before review
instead of during it.

**Effort:** M, for the environment plus the first four component tests. Adding the dependencies
takes minutes; writing tests that check behaviour rather than markup is the actual work.

**Risks.** `jsdom` enlarges the dev dependency tree but does not affect the production bundle.
Component tests written against markup rather than behaviour become their own maintenance burden.
Assert on rendered text, emitted events and props passed to children, not on class names or DOM
structure.

**Dependencies.** Prerequisite for MOD-01, MOD-05 and MOD-07, and for the regression tests of
MAINT-07, MOD-08 and DEBT-08.

**Acceptance criterion.**

- `vite.config.js` declares a jsdom test environment.
- At least four `*.test.js` files mount `.vue` components.
- `npx eslint .` runs and reports zero errors on a configured rule set.
- Both checks can be run through `package.json` scripts.

---

### MOD-03 — The field-type contract leaks outside the registry

- **Category:** Modularity / abstraction · **Priority:** P2 · **Confidence:** High
- **Location:** `src/fields/fieldRegistry.js` (the intended single source). Leaks at:
  - `src/components/ItemFieldEditor.vue:76-79`
  - `src/stores/useUserConfigStore.js:10-11,59-61`
  - `src/composables/userConfigValidation.js:7-17`
  - `src/composables/useFieldMapping.js:6,14,85-88`
  - `src/composables/replacementRules.js:6`
  - `src/components/UserConfigPanel.vue:49-53`
  - `src/App.vue:387-397`
  - `src/services/strapiApi.js:220-223`

**Observed.** `docs/technical-documentation.md` §8.1 (`:477`) states that `fieldRegistry.js` is
*"der **einzige** Registrierungsort für Feldtypen"*. §8.4 gives a two-step recipe for adding one:
define the contract functions in the registry, and the type *"steht danach automatisch in der
Config-Auswahl und in der Config-Validierung zur Verfügung"*. That is true for the list of types,
but several related facts live elsewhere:

- **Component resolution.** The registry returns a component *name string*,
  `component: 'ViewerWikidataField'` (`fieldRegistry.js:239`). A hard-coded conditional in the
  consumer resolves it: `if (componentId === 'ViewerWikidataField') return ViewerWikidataField`
  (`ItemFieldEditor.vue:77`). A new type with a custom component needs edits in both files, which
  the documented recipe does not mention.
- **Reserved field keys** (`scan`, `suspendEditing`, `__onlineMeta`) are declared four times:
  `useUserConfigStore.js:10`, `replacementRules.js:6`, `useFieldMapping.js:85-88` and
  `App.vue:391-392`.
- **Allowed field widths** (`33%`/`50%`/`100%`) are declared four times: `useUserConfigStore.js:11`,
  `useFieldMapping.js:6`, `userConfigValidation.js:16` and `UserConfigPanel.vue:49-53`.
- **Candidate input-type normalisation** exists as three identical functions: `fieldRegistry.js:58`,
  `useUserConfigStore.js:59` and `userConfigValidation.js:7`.
- **The `wikidata_autosuggest` underscore alias** is accepted by `useFieldMapping.js:14` and
  `strapiApi.js:222`, but not by the registry or the validator (see DEBT-05).

**Root cause.** The registry was correctly scoped to *behaviour* (rendering, defaults, value
normalisation) but never given the *vocabulary* around it: which keys are reserved, which widths are
legal, which spellings of a type name are accepted. Each consumer needed one of those facts before a
shared home existed and declared it locally.

**Concrete consequence.** Adding a seventh field type or a fourth field width means finding four to
six unrelated files and hoping none was missed, and the documented recipe is actively misleading
about this. The failure is quiet. If one reserved-key list is missed, an internal key such as
`__onlineMeta` becomes editable in one place while staying hidden everywhere else.

**Recommendation.** Move the vocabulary into `src/fields/fieldRegistry.js` and import it from there:

- Export `RESERVED_FIELD_KEYS` and a predicate `isReservedFieldKey(key)`, and replace all four local
  lists.
- Export `ALLOWED_FIELD_WIDTHS` and `normalizeFieldWidth(value)`, and replace all four.
- Export the existing `normalizeCandidateInputType` and delete the two copies.
- Let the registry entry carry the component *itself* instead of a name string. The registry is
  already imported by `.vue` files, so importing `ViewerWikidataField.vue` there adds no new
  coupling direction. It replaces a string indirection whose only purpose is to avoid the import.
  `resolveEditorComponent` in `ItemFieldEditor.vue` then disappears.
- Update `docs/technical-documentation.md` §8.4 to describe whatever the recipe actually becomes.

**Expected benefit.** The documented one-file extension point becomes true, and five kinds of
"forgot to update the other list" become impossible.

**Effort:** M. The work is mechanical, but it touches nine files and needs the existing
`fieldRegistry.test.js` and `userConfigValidation.test.js` extended to pin the newly shared
constants.

**Risks.** Low. The one judgement call is putting the component in the registry. Check that
importing an SFC into `fieldRegistry.js` does not pull Vue's runtime into pure tests that currently
import the registry (`replacementRules.js` imports `resolveConfiguredFieldType`). If it does, keep
the component map in a separate `src/fields/fieldComponents.js` that only `ItemFieldEditor` imports.
That is still one place, and still not a string lookup.

**Dependencies.** Shares its root cause with MOD-02 and MOD-04. MAINT-03 covers the generic utilities
that are not field-specific.

**Acceptance criterion.**

- `grep -rn "'suspendEditing'" src/` and `grep -rn "'33%'" src/` each return exactly one non-test
  definition.
- `ItemFieldEditor.vue` contains no conditional on a component name.
- Adding a new field type requires editing only files under `src/fields/`.
- §8.4 of the technical documentation describes the actual steps.

---

### MOD-04 — The autosuggest config schema has four independent interpreters

- **Category:** Modularity / abstraction · **Priority:** P2 · **Confidence:** High
- **Location:**
  - `src/composables/useWikidataSearch.js:25-92`: `PRIORITY_BLOCK_HANDLERS[*].getRequiredProperties`
  - `src/components/WikidataAutosuggestInput.vue:100`: `getPropertyIdsForPrioritizeRule`
  - `src/components/ViewerWikidataField.vue:55`: `getPropertyIdsForRule` (same job, third name)
  - `src/components/config/AutosuggestFieldConfig.vue:75-111` and `:116-140`:
    `normalizeAlsoGetDataFromDefs` and `claimPresenceDefs`
  - `src/components/WikidataAutosuggestInput.vue:179-215`: `normalizeAlsoGetDataFromPropertyDefs`
  - `src/composables/userConfigValidation.js` (e.g. `:198-201`): validates the same shapes a fifth
    time

**Observed.** The `autosuggest` config accepts several historical shapes per field
(`docs/conventions.md:49-58`). `defs` entries can be plain strings or objects, the property id can
be under `propertyId` or `property`, and the label can be under `label` or `propertyLabel`. Every
module that touches this config re-implements that tolerance.
`normalizeAlsoGetDataFromPropertyDefs` (`WikidataAutosuggestInput.vue:179-215`) and
`normalizeAlsoGetDataFromDefs` (`AutosuggestFieldConfig.vue:75-111`) are identical apart from the
function name; a `diff` after renaming reports no difference.

The documentation describes this config as an opaque pass-through (`docs/technical-documentation.md`
§8.2, `:500`: *"Der Wrapper reicht `field.autosuggest` unverändert an `WikidataAutosuggestInput.vue`
weiter; die Viewer-Core-Logik interpretiert keine autosuggest-Schlüssel"*). That is accurate for the
*core*: `useViewerData`, `fieldRegistry` and the stores really do treat it as opaque, which is a good
decision. It is not accurate for the four modules above, each of which knows the schema in detail.

**Root cause.** The pass-through boundary was drawn correctly at the core, but no schema module was
created on the other side of it. Each Wikidata-related module became its own schema authority. The
GUI editor writes a shape, the input component reads it, the search composable reads it again, and
the validator checks a fourth interpretation.

**Concrete consequence.** Supporting a new `defs` spelling, or dropping a legacy one, requires four
coordinated edits, with no compiler or test to catch a miss. The realistic failure is one-sided
drift. The GUI editor writes `{ propertyId, propertyLabel }` for `claimPresence` and
`{ propertyId, label }` for `alsoGetDataFrom` (`docs/conventions.md:50,58`). That distinction exists
only because two of the four readers happened to use different key names. A maintainer who unifies
it in the editor without also updating `useWikidataSearch.js` and both components would silently
break prioritisation, and no test would fail.

**Recommendation.** Add `src/fields/autosuggestSchema.js` exporting the normalisers the four
consumers need: `normalizePropertyDefs(defs)`, `normalizeAlsoGetDataFrom(value)`,
`getPropertyIdsFromDefs(defs)` and `getPropertyLabelFromDef(def)`. Make them pure functions, with a
test that pins every legacy shape listed in `docs/conventions.md`. Have all four modules import them
and delete the local copies. Keep the *core* pass-through exactly as it is; this consolidates the
readers and does not move interpretation into the core.

**Expected benefit.** One schema definition, pinned by tests. The GUI editor and the runtime readers
provably agree, and adding or retiring a legacy shape is a one-file change.

**Effort:** M. The extraction is small; listing the accepted shapes from four implementations and
agreeing their union is the work.

**Risks.** Low, as long as the extracted functions start as the *union* of current behaviour. Do not
tighten the accepted shapes in the same change, or live Strapi settings that use a legacy form would
break silently.

**Dependencies.** Same root cause as MOD-02 and MOD-03, but can be implemented independently.

**Acceptance criterion.**

- `grep -rn "propertyLabel" src/` shows the fallback chain defined in exactly one module.
- `useWikidataSearch.js`, `WikidataAutosuggestInput.vue`, `ViewerWikidataField.vue` and
  `AutosuggestFieldConfig.vue` all import it.
- The existing `useWikidataSearch.test.js` object-defs test still passes unchanged.

---

### MOD-05 — Parameter-bag composables and prop-bag components

- **Category:** Modularity / interfaces · **Priority:** P2 · **Confidence:** High
- **Location:**
  - `src/composables/useDataImportExport.js:3-29`: 26-key destructure
  - `src/App.vue:707-740`: the matching 26-key call site
  - `src/components/ListPanel.vue:4-158`: 38 props
  - `src/App.vue:1177-1204` and `:1211-1237`: two `ListPanel` instances

**Observed.** `useDataImportExport` takes a single object with 26 keys: refs, computed values,
mutators and callbacks from four different owners. `App.vue` supplies all 26 at the call site. The
composable does not encapsulate the data flow; it moves a block of `App.vue` elsewhere and receives
the surrounding scope as an argument list.

`ListPanel.vue` declares 38 props. 15 of them are pre-resolved `t(...)` strings, and two are
*functions* (`looksLikeImageUrl`, `hasListImageFailed`) passed down from the parent. The component is
then created twice, differing only in `render-header` / `render-body`: once for the sticky header
region (`App.vue:1177`) and once for the list body (`App.vue:1211`). The prop lists of the two
instances are largely duplicated.

The duplication has already drifted. The header instance receives all eight hierarchy props
(`hierarchy-fields`, `hierarchy-level1-options`, `selected-hierarchy-level1`,
`has-selected-hierarchy-level1`, `expanded-hierarchy-level2-values`, and three labels) but binds none
of the matching handlers. The hierarchy UI renders only under `v-if="props.renderBody"`
(`ListPanel.vue:357`), so those eight props do nothing on that instance.

**Root cause.** Both shapes come from the same move: code was relocated without relocating its
dependencies. `useDataImportExport` was extracted from `App.vue` and given its closure as
parameters. `ListPanel` was split into header and body regions by a flag rather than into two
components, because the sticky-header layout needed the header rendered outside the scrolling panel.

**Concrete consequence.** Adding one dependency to the import/export path means editing the
destructure *and* the call site in lockstep, with no checked contract between them. A mismatch fails
at runtime as `undefined is not a function`, not at build time. Adding one prop to `ListPanel` means
editing two instances, and the eight dead hierarchy props show that this is missed in practice.
Passing `looksLikeImageUrl` as a prop also means `ListPanel` cannot be rendered in a test without the
parent's helpers, which is part of why it has no test.

**Recommendation.** Two separate changes, each valuable on its own:

1. **`ListPanel`.**
   - Split it into `ListPanelHeader.vue` and `ListPanelBody.vue`, each taking only the props it
     uses, and delete the `renderHeader`/`renderBody` flags.
   - Replace the two function props. `looksLikeImageUrl` is a pure helper in
     `useViewerData.js:179` and can simply be imported. `hasListImageFailed` is per-item UI state
     that belongs to the body component.
   - Where a component needs many labels, call `t()` inside it, as `DataTransferControls`,
     `OnlineAccessPanel` and `ReplacementsUnit` already do, instead of threading 15 strings through
     the parent.
2. **`useDataImportExport`.** Rather than a generic refactor, shrink the bag by letting the
   composable import the stores it needs directly:
   - `useDataTransferStore`: `createEditedFileName`, `appendEditedTimestamp`,
     `setModeErrorMessage`, `dataMode`
   - `useUserConfigStore`: `clearUserConfigSession`, `applyImportedConfigPayload`,
     `applyUserConfigToRawItems`, `createUserConfigPayload`, `hasUnappliedUserConfigChanges`
   - `useReplacementsStore`: `createReplacementsPayload`, `resetReplacements`
   - `useAppConfigStore`: `t`

   That removes 12 of the 26 keys without inventing a new abstraction. The remaining keys are bound
   to the `useViewerData` instance and must stay injected, because `useViewerData` is a factory, not
   a module singleton.

**Expected benefit.** Two focused components that can each be mounted in a test. Header/body prop
drift becomes structurally impossible, and the import/export contract is cut in half.

**Effort:** M. The `ListPanel` split is the larger half and needs MAINT-01's test environment so it
can be verified instead of eyeballed.

**Risks.** The sticky-header layout depends on the header being rendered outside the scrolling
panel and measured by the `ResizeObserver` (`App.vue:834-846`, `docs/technical-documentation.md`
§14). The split must keep the DOM structure that the CSS and the observer expect. Do the split with
no markup changes at all, then check the sticky offsets at desktop width and at the
`max-width: 768px` breakpoint.

**Dependencies.** Needs MAINT-01. Interacts with MOD-01, since the header instance's props come from
`App.vue`. MOD-06's reasoning (explicit dependencies at I/O boundaries) does not apply here: these
are UI-side store reads, not network calls.

**Acceptance criterion.**

- No component in `src/components/` declares a prop of `type: Function`.
- `ListPanel` no longer exists as a dual-mode component.
- The hierarchy props appear in exactly one instance.
- `useDataImportExport` takes fewer than 15 injected keys.

---

### MOD-06 — Two opposite dependency conventions in the Strapi layer

- **Category:** Modularity / hidden dependencies · **Priority:** P2 · **Confidence:** High
- **Location:**
  - `src/stores/useOnlineItemsStore.js:148-149,247-248`
  - `src/stores/useOnlineSettingsStore.js:28-29,68-69,103-104`
  - `src/stores/useOnlineUpdatesStore.js:235-239`
  - `src/stores/useAuthStore.js:44,63,112`
  - for contrast: `src/composables/useReplacementsApply.js:15-27`

**Observed.** The online stores get their dependencies in two different ways. Some are declared in
the signature: `fetchOnlineItems({ settings })`, `saveOnlineUpdates({ profile, token })`,
`trackOnlineReplacementUpdatesForRemainingItems({ profile, token, ... })`. Others are fetched inside
the function body:

```js
async function fetchOnlineItems({ settings }) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()
  ...
```

And `saveOnlineUpdates`, whose signature already declares `profile` and `token`, additionally reaches
into a third store for field configs:

```js
async function saveOnlineUpdates({ profile, token = '' }) {
  const { settings } = useOnlineSettingsStore()
```

`useReplacementsApply` does the opposite and injects all eleven of its dependencies explicitly
(`useReplacementsApply.js:15-27`), which is why it has the most readable test in the suite.

**Root cause.** Module-global stores make fetching dependencies in the body *possible* at no visible
cost, and no convention was written down, so each function decided case by case. As a result, a
signature no longer tells you what a function needs.

**Concrete consequence.** `fetchOnlineItems({ settings })` looks like its only input is `settings`,
but it silently requires a saved connection profile and an auth token from two other module-global
stores. The tests show the cost. `useOnlineItemsStore.test.js:21-36` must build a `localStorage`
mock, save a profile into `useConnectionProfileStore`, and then assign `authStore.token.value =
'token-1'` directly, bypassing the store's public API because there is no other way to inject a
token. The online-store test files repeat that setup, and six test files each carry their own copy
of `createLocalStorageMock` (see MAINT-03). The codebase is already aware of leakage between tests:
`useAppConfigStore.test.js:136-141` has an `afterEach` comment explaining that module-global state
must be reset by hand so a loaded default config *"nicht in andere Tests leckt"*.

**Recommendation.** Keep the store pattern. It is adequate for an application of this size, and a
state library would be a larger change than the problem justifies. Instead, write the convention
down and apply it to the network layer only: **every function that performs I/O takes `profile` and
`token` as explicit parameters.**

- Add them to the signatures of `fetchOnlineItems`, `fetchOnlineItemsForHierarchyLevel1`,
  `fetchOnlineSettings`, `persistOnlineSettings` and `persistOnlineReplacements`.
- Pass `fieldConfigs` into `saveOnlineUpdates` instead of fetching `useOnlineSettingsStore` inside
  it.
- `App.vue` already holds `connectionProfile` and `token` and passes them to `saveOnlineUpdates`, so
  most call sites change by one argument.
- Record the rule in `docs/conventions.md`.

**Expected benefit.** Signatures tell the truth. Each online store can be tested with two literal
arguments instead of three primed module globals, and most of the shared test scaffolding goes away.

**Effort:** M, for five signatures plus their call sites and the affected test files.

**Risks.** Low and mechanical, but touching every online entry point at once makes a wide diff. Use
one commit per store so a regression can be bisected.

**Dependencies.** Makes MOD-01's `useOnlineSession` extraction much easier, so do this first.

**Acceptance criterion.**

- No function in `src/stores/useOnline*.js` calls `useConnectionProfileStore()`, `useAuthStore()` or
  `useOnlineSettingsStore()` inside its body.
- No test file assigns `authStore.token.value` directly.
- `docs/conventions.md` states the rule.

---

### MAINT-02 — Error messages bypass the wording system, in two languages

- **Category:** Maintainability / consistency · **Priority:** P2 · **Confidence:** High
- **Location:**
  - German literals: `src/composables/useViewerData.js:49,57,59,69,76,83,154,351` and
    `src/composables/userConfigValidation.js` (36 `error:` returns).
  - English literals: `src/stores/useOnlineItemsStore.js:153,160,241,252,259,318`,
    `src/stores/useOnlineSettingsStore.js:33,62,97,128`,
    `src/stores/useOnlineUpdatesStore.js:160,208,270,291,312,324` and
    `src/stores/useAuthStore.js:38,46,67,73,108,125,139`.
  - Display points: `src/components/OnlineAccessPanel.vue:186-212`. The offline display point is
    currently missing (MAINT-07).

**Observed.** The application has a complete two-language wording system: 251 handles in
`config/wording.json`, a `t(key, fallback)` resolver with a documented fallback chain, and optional
backend overrides. Runtime error messages do not use it. Instead:

- The data layer produces **German** literals, for example `'JSON ist ungueltig (Parse-Fehler).'`,
  `'CSV enthaelt leere Spaltennamen.'`, and every branch of `userConfigValidation.js`
  (`'JSON-Config ist ungueltig: …'`).
- The store layer produces **English** literals, for example `'Could not load online items.'`,
  `'No saved connection profile found.'` and
  `` `${failed.length} update(s) failed. ${failed[0].error}` ``.

The two meet in one place. `App.vue:1072-1074` sends a failed config validation to
`markOnlineSettingsInvalid(applyResult.error)`, which writes it to `lastSettingsError`.
`OnlineAccessPanel.vue:193-195` renders that in the same status area as `lastItemsError`,
`lastAuthError` and the save error. One status area can therefore show a German validation message
next to an English fetch message, in either UI language.

For one of these areas the documentation claims the opposite. `docs/technical-documentation.md`
§12.8 (`:872-873`) says *"alle Texte der Save-UX liegen als Wording-Handles vor"*, while
`useOnlineUpdatesStore.js:324` builds the save error by string concatenation in English.

A related constraint: `t()` has no parameter interpolation, so any message that carries a value is
assembled by concatenation at the call site, for example
`` `${t('startFromScratchScanInvalidRow', 'Ungueltige URL in Zeile')} ${invalidEntry.rowNumber}: ${invalidEntry.url}` ``
(`useDataImportExport.js:126`). `UserConfigPanel.vue:87-90` shows the sharper form of the problem.
The fallback string interpolates `${fieldKey}`, but the translated handle cannot. The handle
`candidateTargetFieldError` exists in `config/wording.json`, so the field name is already missing from
that message.

**Root cause.** The wording system was built for UI chrome such as labels, buttons and tabs. Error
strings were written where they were thrown, in whatever language the author was working in at the
time. No rule says which layer owns user-facing text.

**Concrete consequence.**

- An English-UI user who loads a Strapi settings payload with an invalid config sees a German
  validation error. That is exactly the situation where a clear message matters most.
- Once MAINT-07 restores the offline error display, the same applies to every malformed JSON or CSV
  import.
- A third UI language is impossible without first finding and rerouting every literal.
- Because the two languages correspond to two layers, the inconsistency looks arbitrary rather than
  like a known gap.

**Recommendation.** Establish the boundary instead of translating every string at once:

1. **Rule:** modules below the component layer return *stable, machine-readable* error codes plus
   an English detail for developers, and components map codes to wording handles for display.
   Record this in `docs/conventions.md`.
2. **Start where it is visible: the validator.** `validateImportedConfigPayload` already returns
   `{ ok: false, error }`. Extend it to `{ ok: false, code, detail, params }` and add handles for
   each code. Its messages appear in both the online flow and (after MAINT-07) the offline import.
3. **Add interpolation to `t()`.** `t(key, fallback, params)` with a simple `{name}` replacement is
   about ten lines and removes the need for concatenation in all future messages.
4. Correct the §12.8 documentation claim, or make it true.

The remaining English store-layer strings can be migrated incrementally; at least they are
consistent with each other.

**Expected benefit.** One language per UI language, translatable messages, and error text that can
change without touching data-layer modules.

**Effort:** M for steps 1–3. The validator has 36 error returns. `userConfigValidation.test.js`
asserts only `ok === false` (20 assertions) and never the message text, so changing the return shape
does not break its assertions. The work after that is incremental.

**Risks.** Everything that reads `error` today (`useDataImportExport.js:181`, `App.vue:506,1073`)
must switch to the new shape. Keep `error` as a deprecated alias next to `code` for one release so
nothing that reads it breaks silently.

**Dependencies.** Coordinate with MAINT-07, which restores the display the messages go to. Doing
this after MOD-06 means fewer call sites move twice.

**Acceptance criterion.**

- No German string literal remains in `src/composables/` or `src/stores/`.
- `t()` supports `{param}` interpolation, with a test.
- With the UI in English, a malformed JSON import shows an English message.
- §12.8 of the technical documentation matches the code.

---

### MAINT-03 — No shared utility module; a business rule is copied three times

- **Category:** Maintainability / duplication · **Priority:** P2 · **Confidence:** High
- **Location:**

  | Helper | Copies | Locations |
  | --- | --- | --- |
  | `isPlainObject` | 10 | `useAppConfigStore.js:258`, `useUserConfigStore.js:31`, `useViewerData.js:13`, `replacementRules.js:8`, `userConfigValidation.js:3`, `strapiApi.js:5`, `wikidataAutosuggestField.js:1`, `ViewerWikidataField.vue:21`, `WikidataAutosuggestInput.vue:48`, `AutosuggestFieldConfig.vue:33` |
  | JSON deep clone | 5 helpers, plus 2 inline uses | `useViewerData.js:17`, `useUserConfigStore.js:35`, `useOnlineUpdatesStore.js:24`, `useReplacementsStore.js:13`, `AutosuggestFieldConfig.vue:37` |
  | `getLocalStorageSafe` | 4 | `useAppConfigStore.js:67`, `useAuthStore.js:12`, `useConnectionProfileStore.js:16`, `useOnlineModeStore.js:22` |
  | **`hasNonEmptyValue`** | **3** | `useViewerData.js:540`, `ListPanel.vue:217`, `strapiApi.js:741` (as `hasNonEmptyOnlineFieldValue`) |
  | `splitCsvLine` | 2 | `useViewerData.js:100`, `useDataImportExport.js:64` |
  | Browser download | 3 | `useDataImportExport.js:~236`, `DatabaseConnectionPanel.vue:125`, `DatabaseConnectionPanel.vue:184` |
  | `createLocalStorageMock` | 6 | across test files |
  | `normalizeConnectionMode` | 2 | `useAppConfigStore.js:26`, `useOnlineModeStore.js:8` |

**Observed.** There is no `src/utils/` or equivalent, and roughly a dozen small helpers are redefined
wherever they are needed. Most of this is harmless: `isPlainObject` is four lines and will not drift
in any meaningful way. Three cases are not harmless:

- **`hasNonEmptyValue` is a business rule, not a utility.** The same five-line function decides three
  different things in three layers:
  - whether an item counts as *edited* for sorting (`useViewerData.js:279`)
  - whether an item shows an edit icon instead of a suspend checkbox (`ListPanel.vue:225-228`)
  - **which fields are included in a `POST` to Strapi** (`strapiApi.js:749`)

  `docs/technical-documentation.md` §7.2 documents the semantics once (`''`, `null`, `undefined`,
  `[]` and `{}` are empty; `false` and `0` are values), as though there were a single definition.
  A change to one copy would desynchronise list sorting from what is actually saved, and no test
  relates the three.
- **`splitCsvLine` is a parser.** The copy at `useViewerData.js:100` is tested through
  `__test.splitCsvLine`. The identical copy at `useDataImportExport.js:64`, used by the
  start-from-scratch CSV path, is not tested. A quoting fix applied to the tested copy would leave
  the untested one behind.
- **`triggerBrowserDownload`** exists as a named helper in `useDataImportExport.js` and twice more
  inline in `DatabaseConnectionPanel.vue`. `docs/technical-documentation.md` §10 (`:614`) calls it
  *"die zentrale Helper-Funktion"*, which is true of one of the three call sites.

**Root cause.** No shared module was set up early, so copying four lines was always cheaper than
creating one. The habit then extended to helpers where copying is risky.

**Concrete consequence.** For the trivial helpers, the cost is only noise. For `hasNonEmptyValue`,
it is a silent divergence between what the list shows and what gets saved. For `splitCsvLine`, it is
a parser fix that reaches only one of two import paths.

**Recommendation.** Two moves of a deliberately different kind:

1. **Add `src/utils/` for the truly generic helpers:** `isPlainObject`, `clonePlainValue`,
   `getLocalStorageSafe` (with a `getSessionStorageSafe` sibling, see MAINT-04) and
   `triggerBrowserDownload`. Import them everywhere and delete the copies. Add `createStorageMock`
   to a `src/test-utils.js` and use it in the six test files.
2. **Move the two non-generic helpers into their owning modules.**
   - Export `hasNonEmptyValue` from `src/fields/fieldRegistry.js`, since it is a statement about
     field values and belongs with the field contract (MOD-03). Have `useViewerData`, `ListPanel`
     and `strapiApi` import it.
   - Export `splitCsvLine` from `useViewerData.js` (it is already exposed on `__test`; make it a
     real export) and have `useDataImportExport` import it.

Step 2 is the one that matters; step 1 is cleanup that can go along with it.

**Expected benefit.** The "edited" rule and the CSV quoting rule each get one definition and one
test. About 25 redundant function definitions disappear.

**Effort:** S. The work is mechanical, and the existing suite verifies each replacement separately.

**Risks.** Very low. One subtlety: `hasNonEmptyValue` in `useViewerData.js` and
`hasNonEmptyOnlineFieldValue` in `strapiApi.js` are currently identical. Confirm that before merging
them, because a future difference between "counts as edited" and "worth saving" would be a
legitimate design choice, not a bug.

**Dependencies.** The `hasNonEmptyValue` half of step 2 belongs with MOD-03.

**Acceptance criterion.**

- `grep -rn "function isPlainObject" src/` returns one result.
- `grep -rn "function hasNonEmptyValue" src/` returns one result.
- `splitCsvLine` is defined once.
- `DatabaseConnectionPanel.vue` contains no `URL.createObjectURL` call.
- The suite stays green.

---

### MAINT-05 — Documentation has drifted on deployment-critical and failure-path facts

- **Category:** Maintainability / documentation · **Priority:** P2 · **Confidence:** High
- **Location:** `README.md:56` and `docs/technical-documentation.md:68` vs `vite.config.js:7`;
  `docs/technical-documentation.md:310` vs `src/stores/useConnectionProfileStore.js:212-238` and
  `src/App.vue:859`; `:99` (wording count); `:1079` (test count); §9.2, §10, §12.8 and §8.4 as noted
  below.

**Observed.** The documentation is detailed and mostly correct, which makes the incorrect parts more
costly: a reader has no reason to doubt it. Confirmed differences:

| Claim | Documented | Actual |
| --- | --- | --- |
| Vite `base` / deploy path | `/viewer-editor-strapi/` (README + technical doc) | `/viewer-hu-pre-and-early-history/` (`vite.config.js:7`) |
| JSON import failure (§9.2, `:575-577`) | *"harter Abbruch mit Fehlermeldung"*; *"der alte Stand bleibt erhalten"* | Data is committed before the config is validated, and the message is never displayed (MAINT-07) |
| Partial save failure (§12.8, `:866-867`) | *"bei Teilfehlern bleibt ein konsistenter, retry-fähiger Pending-Stand erhalten"* | Successfully saved items keep a stale baseline (DEBT-07) |
| Connection profile restore (§5, `:310`) | *"beim App-Start; wird bei gesetztem `defaultConnectionProfile` ggf. durch das geladene Default-Profil überschrieben"* | `loadConnectionProfileFromStorage` is **never called** when `defaultConnectionProfile` is set, which it is in the shipped `config/app.config.js:13` (see DEBT-04) |
| `config/wording.json` (§3, `:99`) | 238 handles | 251 handles |
| Test suite (§16, `:1079`) | 19 files, 176 tests | 19 files, **183** tests |
| `triggerBrowserDownload` (§10, `:614`) | *"die zentrale Helper-Funktion"* | one of three implementations (MAINT-03) |
| Save-UX texts (§12.8, `:872-873`) | *"alle Texte … liegen als Wording-Handles vor"* | error strings are English literals (MAINT-02) |
| Adding a field type (§8.4) | two steps, registry only | also requires `ItemFieldEditor.vue` (MOD-03) |

The base-path entry has the most serious consequences. The technical documentation even adds detail,
*"früher genutzte Pfade stehen dort auskommentiert"*, which is true (`vite.config.js:5-6` hold two
commented-out values) and makes the stated active value look verified. It is not: the active `base`
is a third value that appears in neither document.

**Root cause.** The technical documentation carries an explicit verification stamp, *"verifiziert am
2026-09-03 gegen Commit `256758f`"* (`:3`), and five commits have landed since. Three of them
(`3ba37d3`, `17e77dc`, `54f233a`) changed features. The stamp is good practice. What is missing is
anything that fails when the stamp goes stale. The §9.2 and §12.8 rows are older: they describe the
intended failure behaviour, and nothing ever tested whether the code delivers it.

**Concrete consequence.**

- A deployer following either document configures the wrong subpath, and every asset URL returns
  404 in production with no warning at build time.
- The §9.2 and §12.8 rows describe guarantees the code does not provide. That is the worst kind of
  drift, because it steers debugging away from the actual cause.
- The connection-profile row describes a `localStorage` restore that does not happen, which sends
  anyone debugging DEBT-04 to the wrong place.
- The remaining rows cost a maintainer a few minutes each and, together, some trust in a document
  that deserves it.

**Recommendation.** Correct the nine rows, preferably in the same commits that fix MAINT-07, DEBT-07,
MAINT-03, MAINT-02 and MOD-03, so documentation and code change together. Then make recurrence less
likely at low cost:

- Stop stating the `base` value in prose. Both documents should point at `vite.config.js` as the
  source of truth for the deploy path; it is a short file and needs no mirror.
- Drop the exact handle and test counts; they carry little information and are sure to drift.
  Alternatively, a short `pnpm run docs:check` could assert them.
- Replace the single verification stamp with a short "verified against" table listing the specific
  claims that were checked, so the next reviewer knows what the stamp covers.

**Expected benefit.** The deploy path is correct in the one place that matters, and the documented
failure guarantees match the code.

**Effort:** S. The corrections take about an hour; the optional check script another hour.

**Risks.** None to the application.

**Dependencies.** The §9.2, §12.8, §10 and §8.4 rows are corrected together with MAINT-07, DEBT-07,
MAINT-03 and MOD-03 respectively.

**Acceptance criterion.**

- Neither `README.md` nor `docs/technical-documentation.md` states a literal base path.
- §9.2 and §12.8 describe behaviour a test demonstrates.
- The §5 connection-profile row describes the actual startup behaviour.
- The wording and test counts are either accurate or removed.

---

### DEBT-02 — Unbounded request loop when Strapi answers 200 with a non-JSON body

- **Category:** Technical debt / reliability · **Priority:** P2 · **Confidence:** High (**verified by
  execution**)
- **Location:** `src/services/strapiApi.js:388-455` (`fetchAllCollectionItemsFromStrapi`, loop at
  `:411-440`) and `src/services/strapiApi.js:488-530` (`checkDataModelImplementationInStrapi`, loop
  at `:502-530`). Root cause at `src/services/strapiApi.js:9-15` and `:44-52`.

**Observed.** Both functions drive their retry with a loop whose only exit condition is a truthy
payload:

```js
let payload = null
while (!payload) {
  const pagedPath = buildItemsPathWithPopulate(...)
  try {
    payload = await strapiFetchJson({ profile, path: pagedPath, method: 'GET', token })
  } catch (error) {
    const invalidKey = parseInvalidStrapiQueryKey(error)
    if (!invalidKey) throw error
    ...
    effectivePopulateFields = effectivePopulateFields.filter(...)
  }
}
```

The loop is correct for the case it was written for. Strapi rejects an `invalid key <name>` that is
a current `populate` key, the key is dropped, the list shrinks, and the loop ends. But
`strapiFetchJson` can *succeed* and still return a falsy value. `parseJsonResponseSafe`
(`strapiApi.js:9-15`) returns `null` when `response.json()` throws, and `strapiFetchJson` passes
that `null` through whenever `response.ok` is true (`strapiApi.js:52`). A 200 response whose body is
not JSON therefore leaves `payload` null, re-enters the loop and sends the identical request again.

**Verification.** Reproduced with a temporary vitest file in both revisions. A `fetch` stub that
returns `{ ok: true, status: 200, json: () => { throw new SyntaxError(...) } }` made
`fetchAllCollectionItemsFromStrapi` send identical requests until the stub itself aborted at
**51 calls**. Without that guard, the loop does not end.

**Root cause.** A compatibility workaround was written as an open loop whose termination rests on an
unstated argument ("the populate list shrinks"). That argument silently assumes every successful
response yields a payload. Nothing makes it explicit: there is no retry cap, and no distinction
between "no response yet" and "the response had no usable JSON". The same block was then copied into
the data-model check, so the defect exists twice.

**Concrete consequence.** Plausible triggers, all outside the app's control: a reverse proxy or WAF
returning an HTML interstitial with status 200, a captive portal on the client network, or a
misconfigured gateway. The result is a browser tab sending requests in a tight loop against the
Strapi instance until the user closes it. There is no error, no timeout and no upper bound, and a
long session effectively floods the server from the client. This affects every online item load
(flat, hierarchy bucket, level-1 values, collection-wide replacements) and the Settings tab's
data-model check.

**Recommendation.** A few lines, applied in both places:

1. **Treat a successful but empty response as an error, not a retry signal.** In `strapiFetchJson`,
   when `response.ok` and `payload === null`, throw
   `createHttpError('Response body is not valid JSON.', response.status, null)`. This is the correct
   fix: every caller of `strapiFetchJson` expects JSON, and a null payload is already treated as a
   failure everywhere else.
2. **Bound the retry loops anyway.** Use
   `for (let attempt = 0; attempt <= effectivePopulateFields.length; attempt += 1)` and throw after
   the last attempt. The number of populate keys is the natural bound, because each iteration
   removes at most one.
3. **Extract the shared retry into one helper**, so the next fix lands once.

**Expected benefit.** A malformed gateway response produces one clear error instead of an endless
request loop, and the compatibility workaround gets an explicit, provable bound.

**Effort:** S. Well under a day, including one test that pins the 200/non-JSON case and one that
pins the existing `invalid key` retry.

**Risks.** Step 1 changes behaviour for any endpoint that legitimately returns 200 with an empty
body. No call site in this codebase does, since every consumer reads `payload.data` or
`payload.jwt`, but confirm against the deployed Strapi version before shipping.

**Dependencies.** None.

**Acceptance criterion.**

- A test stubs `fetch` to return 200 with a non-JSON body and asserts that
  `fetchAllCollectionItemsFromStrapi` rejects after a bounded number of calls.
- The existing `strapiApi.test.js` retry tests still pass.
- The retry block appears once in the module.

---

### DEBT-03 — After clearing saved app settings, the UI still says they are active

- **Category:** Technical debt / correctness · **Priority:** P2 · **Confidence:** High (**verified by
  execution**)
- **Location:** `src/stores/useAppConfigStore.js:93-101` (`applyEditableConfigSnapshot`), `:215-221`
  (`clearEditableAppConfig`), `:348` (`hasSavedEditableAppConfig`). UI consequence at
  `src/components/DatabaseConnectionPanel.vue:405,419,435,444-446`.

**Observed.** `hasSavedEditableAppConfig` is derived from whether a timestamp is present:

```js
hasSavedEditableAppConfig: computed(() => Boolean(editableConfig.value.updatedAt)),
```

`clearEditableAppConfig` removes the `localStorage` entry and re-applies the base layer. But
`applyEditableConfigSnapshot` keeps the previous timestamp when the incoming snapshot has none:

```js
updatedAt: String(input.updatedAt || editableConfig.value.updatedAt || '').trim(),
```

`baseConfig.value` comes from `normalizeAppConfigInput`, which returns only the seven editable keys
and never an `updatedAt`. So the stale timestamp survives the clear.

**Verification.** Reproduced with a temporary vitest file in both revisions (revision 2 output):

```
PROBE DEBT-03 storage = null hasSaved = true updatedAt = 2026-09-16T10:01:21.402Z color = #1f7a8c
```

The `localStorage` entry really is removed, and the values really do fall back to the base. The
reset *works*; only the report of it is wrong.

**Root cause.** `updatedAt` serves two purposes that conflict on this path. It is a display value
("last saved at") and it is the persistence flag. `applyEditableConfigSnapshot` keeps it on purpose,
so that re-applying a snapshot does not blank the display. That is correct for every caller except
the one whose whole job is to say "there is no saved snapshot any more". The test "applies the
default file over the build defaults" in `useAppConfigStore.test.js` asserts
`hasSavedEditableAppConfig === false`, but only on a path where nothing was ever saved, so the
stale-timestamp case is untested.

**Concrete consequence.** After the user clicks *"Clear saved app settings"* in the Settings tab,
`DatabaseConnectionPanel.vue:435-446` still shows *"Locally saved app settings are active and take
precedence over the base…"* together with *"Last saved: 2026-…"*. Both the *Download* and *Clear*
buttons (`:405`, `:419`) stay enabled. The panel tells the user the opposite of what happened. The
natural reaction is to click Clear again, see no change, and conclude the reset is broken, on a
settings screen whose whole purpose is to show which configuration layer is in force. The state
corrects itself on the next page load, which makes the problem intermittent and harder to trust.

**Recommendation.** Separate the flag from the display value. Two options, in order of preference:

1. **Track persistence explicitly.** Back `hasSavedEditableAppConfig` with a ref that
   `saveEditableAppConfig`, `importEditableAppConfigFromJsonText` and `clearEditableAppConfig` set.
   Initialise it from `hasSavedAppConfigInStorage()` (`useAppConfigStore.js:125-129`), which already
   asks the actual question. Also blank `updatedAt` on clear.
2. **Or, minimally,** have `clearEditableAppConfig` reset the timestamp explicitly:
   `applyEditableConfigSnapshot({ ...baseConfig.value, updatedAt: '' })`. Note that `''` is falsy,
   so the current `||` chain would still keep the old value. This option also needs
   `applyEditableConfigSnapshot` to distinguish "no `updatedAt` key" from "`updatedAt: ''`".

Option 1 is better, because the flag then means what its name says instead of depending on an
invariant about a display field.

**Expected benefit.** The Settings tab reports the active configuration layer correctly, which is
the one thing it exists to do.

**Effort:** S. A small fix plus the regression test that should have existed.

**Risks.** None beyond the fix itself.

**Dependencies.** None. Related to MAINT-06 (the same key set, declared three times).

**Acceptance criterion.**

- A test calls `saveEditableAppConfig(...)` then `clearEditableAppConfig()` and asserts
  `hasSavedEditableAppConfig.value === false` and `editableAppConfig.value.updatedAt === ''`.
- After clearing in the Settings tab, the "locally saved … take precedence" note and the "Last
  saved" line disappear, and the Clear button becomes disabled.

---

### DEBT-04 — A failed default-profile fetch discards a valid stored connection profile

- **Category:** Technical debt / reliability · **Priority:** P2 · **Confidence:** High
- **Location:** `src/stores/useConnectionProfileStore.js:212-286` (`loadConnectionProfileFromDefault`),
  specifically the three failure branches at `:224`, `:245` and `:262`. Call site at
  `src/App.vue:859`. For contrast: `src/stores/useAppConfigStore.js:131-201`.

**Observed.** `loadConnectionProfileFromDefault` falls back to `localStorage` in exactly one case:
when no default filename is configured at all (`:214-216`). In every failure case after that, it sets
the in-memory profile to `null`:

```js
const fetched = await fetchFirstAvailableConfigText(profileUrls)
if (!fetched.ok) {
  ...
  connectionProfile.value = null      // a valid stored profile is discarded
```

The same assignment appears in the invalid-JSON branch (`:245`) and the invalid-profile branch
(`:262`). `loadConnectionProfileFromStorage` exists, validates correctly and is exported, but none of
these paths reaches it. `config/app.config.js:13` ships with
`defaultConnectionProfile: 'viewer-editor-connection-profile.v1.json'`, and `App.vue:859` calls only
`loadConnectionProfileFromDefault`. **In the shipped configuration, the stored profile is not read at
startup at all.**

Its sibling loader, written for the same pattern against the same `publicConfigUrls` helper, does
the opposite and says so in a comment (`useAppConfigStore.js:131-134`): *"Schlaegt das Laden fehl,
bleibt `config/app.config.js` die Basis - die App startet also immer."*

**Root cause.** The two runtime-config loaders were written at different times with different
precedence models. The app config treats the remote file as a *base layer* under `localStorage`; the
connection profile treats it as an *override* above it. Both models are defensible. What is not
defensible is that only one of them has defined behaviour when the fetch fails. The connection
profile's failure path was never specified, so it defaults to "no profile".

**Concrete consequence.** Whenever `public/connection-profile/*.json` cannot be reached, the app
starts with `connectionProfile === null`. Causes include a partial deploy, a CDN hiccup, an
offline-first reload, or a 404 from a wrong `base` path, which MAINT-05 shows is easy to hit. Every
online feature is then unavailable:

- `fetchOnlineSettings` returns `'No saved connection profile found.'`
  (`useOnlineSettingsStore.js:33`).
- The Settings tab's form renders empty, because `buildDraftProfile` returns blanks
  (`useConnectionProfileStore.js:110-119`).
- `restoreSession` clears the session with *"Session could not be restored because no connection
  profile is configured."* (`useAuthStore.js:122-126`), which throws away a valid JWT.

The user's saved profile is still in `localStorage` and still valid. The application simply refuses
to use it, and shows an empty configuration form that invites re-entering it.

Overwriting `localStorage` on *success* (`:280-283`) is documented and deliberate (§12.1), which suits
a centrally managed deployment. This finding concerns only the failure path, which is neither
documented nor deliberate.

**Recommendation.** Give the failure path the behaviour its sibling already has. In each of the three
failure branches, replace `connectionProfile.value = null` with a call to
`loadConnectionProfileFromStorage()`. Keep `lastConnectionProfileLoadError` populated, so that
`OnlineAccessPanel`'s diagnostic (`OnlineAccessPanel.vue:29-45`) still reports why the default was
not used. Note that `loadConnectionProfileFromStorage` also writes `lastConnectionProfileLoadError`,
so restore the default-load error afterwards. Then document both loaders' precedence and failure
behaviour side by side in §4.4 and §12.1, and correct the §5 table row (see MAINT-05).

**Expected benefit.** A temporary failure to fetch a bundled file no longer takes a correctly
configured user offline, or presents an empty form that invites overwriting a working profile.

**Effort:** S. Three one-line changes plus a test per branch.

**Risks.** A behaviour change for managed deployments. A user who saved a profile pointing at a
different Strapi instance will keep using it while the default file is temporarily unreachable,
instead of being cut off. That is the intended improvement, but state it explicitly in case the
current behaviour was ever relied on to force a central profile.

**Dependencies.** None. Related to MAINT-05, whose §5 row describes behaviour that does not exist.

**Acceptance criterion.**

- With a saved profile in `localStorage` and a `fetch` stub that fails, the store keeps the stored
  profile and `lastConnectionProfileLoadError` describes the default-load failure.
- The same holds for an invalid-JSON response and an invalid-profile response.
- §4.4 and §12.1 describe both loaders' failure behaviour.

---

### DEBT-07 — After a partially failed save, successfully saved items keep a stale baseline

- **Category:** Technical debt / correctness · **Priority:** P2 · **Confidence:** High (**verified by
  execution**)
- **Location:**
  - `src/App.vue:546-565` (`onSaveOnlineChanges`, partial-failure branch)
  - `src/stores/useOnlineUpdatesStore.js:296-315` (update loop, `removePendingUpdate` at `:306`) and
    `:323-332` (return value)
  - `src/stores/useOnlineUpdatesStore.js:124-129` (delta computed against the snapshot)
  - `src/composables/useViewerData.js:459-465` (`markAsSaved`)

**Observed.** On full success, `onSaveOnlineChanges` calls `markAsSaved`, which copies `rawItems`
into `importSnapshot`. On partial failure, it re-baselines only *created* items
(`syncSnapshotItemAtIndex`, `App.vue:558-565`). Updates that succeeded in the same run are removed
from the pending set (`useOnlineUpdatesStore.js:306`), but their `importSnapshot` entries keep the
values from *before* the save. `saveOnlineUpdates` does not report which updates succeeded; its
result carries only `failed` and `createdItems`.

`trackOnlineFieldChange` computes each delta against that snapshot and drops the delta when the new
value equals the baseline:

```js
const baselineValue = snapshotItem?.[key]
if (isEqualValue(nextValue, baselineValue)) {
  delete currentEntry.changedFields[key]
```

**Verification.** A temporary probe used the real `useViewerData` and `useOnlineUpdatesStore` with a
stubbed `fetch`:

1. Item A `title: foo → bar` and item B `title: x → y` are pending.
2. The save succeeds for A and fails for B.
3. The user reverts A to `foo`.

```
PROBE partial save ok = false pending after = [ '/api/items::B' ]
PROBE after revert A->foo pending = {"/api/items::B":{...,"changedFields":{"title":"y"}}}
```

No update for A is registered.

**Root cause.** Baseline sync on partial failure was implemented for the create path, which needed
it to turn drafts into regular items (§12.9). The update path was left out because
`saveOnlineUpdates` does not return the information needed to do it. The responsibility is split
across two modules: the store knows what succeeded, and `App.vue` owns the snapshot.

**Concrete consequence.** After any partial failure, reverting a field on an item that *was* saved
produces no pending change. The UI shows the reverted value, the unsaved counter does not count it,
and the server keeps the edited value. The divergence can also become permanent. If the user then
retries successfully (B saves), `markAsSaved` makes the reverted UI value the new baseline, while
Strapi still holds the edited value. Nothing indicates the mismatch until a reload shows the server
value. `docs/technical-documentation.md` §12.8 promises the opposite: *"bei Teilfehlern bleibt ein
konsistenter, retry-fähiger Pending-Stand erhalten."*

**Recommendation.** Let the store report what it saved, and let the owner of the snapshot use it.
`saveOnlineUpdates` already collects `failed`; also collect `savedUpdates` as `{ itemsPath, id }`.
In `onSaveOnlineChanges`, re-baseline the loaded items whose `__onlineMeta` matches, using the same
`syncSnapshotItemAtIndex` used for creates. When MOD-01 lands, move this into `useOnlineSession`, so
"save" and "re-baseline" live together.

**Expected benefit.** The documented partial-failure guarantee becomes true, and reverts after a
partial failure reach the server.

**Effort:** S. A new return field, a loop in the caller, and one regression test (the probe above is
a ready-made starting point).

**Risks.** Low. Items saved in a bucket that is no longer loaded have no snapshot entry, so skipping
them is correct.

**Dependencies.** None. MOD-01 step 3 is the natural long-term home. Correct §12.8 together with
MAINT-05.

**Acceptance criterion.** A test covers this sequence: two pending updates; the save succeeds for
one and fails for the other; reverting the saved one produces a pending update for it; after a
successful retry, no field differs between `importSnapshot` and the values written to the stubbed
server.

---

### MOD-07 — Dataset-specific assumptions embedded in generic components

- **Category:** Modularity / abstraction · **Priority:** P3 · **Confidence:** High
- **Location:** `src/components/ListPanel.vue:203-215` (`resolveItemCaption`) and
  `src/components/WikidataAutosuggestInput.vue:330-331` (`deriveGeoNamesValues`, keyed on `P1566`).

**Observed.** `ListPanel.vue` is a generic list/card renderer parameterised by
`itemCaptionFieldKey`. Its caption resolution nevertheless hard-codes a field name from this
particular collection:

```js
function resolveItemCaption(item) {
  const configuredCaptionKey = props.itemCaptionFieldKey
  if (configuredCaptionKey && ...) { ... }
  const inventoryNumber = String(item?.inventory_number ?? '').trim()
  if (inventoryNumber) return inventoryNumber
  ...
```

Similarly, `WikidataAutosuggestInput.vue` special-cases the Wikidata property `P1566` (GeoNames ID)
to write a `geoNames` array into the selected entity. This is documented in
`docs/technical-documentation.md` §13, but implemented inside a component the same document
describes as generic.

**Root cause.** Both are convenience defaults added while working with one dataset. The generic
mechanisms (`itemLabelField`, `alsoGetDataFrom`) already existed but had not been configured for it.
The shortcut was cheaper than the configuration and was never revisited.

**Concrete consequence.** Limited but real. Any dataset that happens to have an `inventory_number`
column gets it as the card caption whenever `itemLabelField` is unset or empty for an item. This
happens silently, and cannot be switched off without editing the component. The README and the
technical documentation both present the viewer as a general-purpose tool for JSON/CSV lists, so the
next dataset onboarded will either be surprised by this or discover it by reading the component. The
`P1566` case is narrower, since it only adds a field. Still, it means the "opaque pass-through"
boundary (MOD-04) has one property-specific exception that a reader of the documentation would not
expect.

**Recommendation.** In proportion to the impact, and without building new machinery:

- Delete the `inventory_number` branch from `resolveItemCaption`. Set
  `config.itemLabelField: "inventory_number"` in the deployment's Strapi settings and in
  `public/sample-data.json`. The configured mechanism already produces exactly this result, so the
  hard-coded fallback is redundant.
- Leave `P1566` where it is for now, but move the property id to a named constant with a comment
  explaining that it is a convenience shortcut for `alsoGetDataFrom`, and mention the exception in
  §13. Removing it would change the shape of entity payloads that are already saved, which is not
  worth doing on its own.

**Expected benefit.** The props fully describe the list component's captions, and the one remaining
domain exception is labelled instead of hidden.

**Effort:** S. The code change takes minutes. The actual task is confirming that the deployed
settings carry `itemLabelField` before removing the fallback.

**Risks.** Removing the fallback before the settings are updated would blank the captions for the
live collection. Check the deployed `data.settings.itemLabelField` first, and ship the settings
change ahead of the code change.

**Dependencies.** None. Best done together with MAINT-01, so the caption behaviour gets its first
test.

**Acceptance criterion.**

- `grep -rn "inventory_number" src/` returns no result.
- `public/sample-data.json` sets `config.itemLabelField`, and the sample cards still show captions.
- The `P1566` literal appears once, as a named constant with a comment.

---

### MAINT-04 — `sessionStorage` access is unguarded while `localStorage` is guarded

- **Category:** Maintainability / robustness · **Priority:** P3 · **Confidence:** High
- **Location:**
  - `src/stores/useDataTransferStore.js:12,23`
  - `src/stores/useUserConfigStore.js:336,340` (`persistUserConfigToSession`,
    `clearUserConfigSession`)
  - startup call site `src/App.vue:855`
  - for contrast: the four `getLocalStorageSafe` definitions (MAINT-03)

**Observed.** Every `localStorage` access goes through a `try/catch` accessor, and
`docs/technical-documentation.md` §5 (`:304-305`) states that rule for `localStorage`. The two stores
that use `sessionStorage` do not follow the same pattern consistently:

```js
function persistUserConfigToSession() {
  const payload = { ... }
  sessionStorage.setItem(USER_CONFIG_SESSION_KEY, JSON.stringify(payload))   // unguarded
}
```

`loadUserConfigFromSession` *is* guarded: its `try` covers the `getItem` call. The unguarded
accessors are `persistUserConfigToSession`, `clearUserConfigSession`,
`useDataTransferStore.loadDataModeFromSession` and `setDataMode`.

**Root cause.** The guard was introduced for `localStorage` and never extended to the sibling API,
which has the same failure mode.

**Concrete consequence.** Browsers throw on *any* access to `window.sessionStorage` when site data is
blocked, for example with "block all cookies" in Chromium or with some enterprise policies. The
failure is then not contained:

- **Startup is cut short.** `loadDataModeFromSession()` runs in `onMounted` right after the first
  `await` (`App.vue:855`). A throw there skips everything after it: app-mode restore, loading the
  connection profile, `restoreSession`, and registering the `beforeunload` and `Escape` listeners.
  Online mode is then unusable, and the close-tab warning is never installed.
- **User-config actions abort part way through.** `persistUserConfigToSession` is called from 17
  places in `useUserConfigStore.js`. The worst case is `applyUserConfigToRawItems`: by the time it
  calls `persistUserConfigToSession` at `:474`, it has already changed `rawItems` and reassigned the
  applied config, so the throw leaves the applied state without its saved counterpart.

The likelihood is low. The failure is out of proportion to it, and silent, because the user just
sees controls that do nothing.

**Recommendation.** Add `getSessionStorageSafe()` next to `getLocalStorageSafe()` in the shared
`src/utils/` module proposed in MAINT-03, and route the four accessors through it. Extend the §5
sentence to cover both storage APIs once the code matches.

**Expected benefit.** A browser with blocked storage degrades to "config is not remembered across a
reload" instead of "online mode never starts" or "the Configuration tab silently stops responding".

**Effort:** S. Under an hour, and it goes along with MAINT-03's utility extraction.

**Risks.** None. Failure becomes a no-op, which is already the behaviour for `localStorage`.

**Dependencies.** Best done as part of MAINT-03.

**Acceptance criterion.**

- No bare `sessionStorage.` reference remains in `src/` outside the safe accessor.
- A test that makes the accessor throw shows `applyUserConfigToRawItems` completing, and
  `loadDataModeFromSession` returning without an exception.

---

### MAINT-06 — The app-config shape is declared three times and never validated

- **Category:** Maintainability / data contracts · **Priority:** P3 · **Confidence:** High
- **Location:** `config/app.config.js:5-17`; `src/stores/useAppConfigStore.js:45-56`
  (`normalizeAppConfigInput`); `src/components/DatabaseConnectionPanel.vue:14-22` and `:65-76`
  (`appConfigForm` and `hydrateAppConfigFormFromStore`).

**Observed.** The seven editable app-config keys are listed in three places: the build defaults
object, the store's normaliser, and the Settings-tab form with its own per-key fallbacks. The form's
defaults do not all match the normaliser's. `appConfigForm.languageMode` defaults to `'single'`
(`DatabaseConnectionPanel.vue:16,69`), while `normalizeLanguageMode` defaults to `'multi'`
(`useAppConfigStore.js:11-16`). The primary-colour fallback matches (`#0066CC`) only by coincidence
of copying.

There is also no validator for this config. `normalizeAppConfigInput` coerces silently: an unknown
`connectionMode` becomes `'switchable'`, any non-empty string is accepted as `primaryColor`, and a
malformed value produces no diagnostic. The structurally similar connection profile is handled the
opposite way. `validateConnectionProfile` (`connectionProfile.js:46-91`) returns per-field errors
that `DatabaseConnectionPanel` shows next to the offending input.

**Root cause.** The app config started as a build-time constants file, where silent defaults were
fine because review caught typos. It became a runtime-loaded, user-editable, importable and
exportable artefact without getting the validation that change requires. The Settings form was added
last and declared the shape a third time, because no shared descriptor existed.

**Concrete consequence.**

- The default mismatch cannot trigger today, because `buildEditableAppConfigDraft` always returns a
  normalised value and the form's `|| 'single'` fallback never fires. It is still evidence that the
  three declarations drift without anything noticing.
- Adding an eighth key requires three coordinated edits. If the form edit is forgotten, the key is
  saved and exported but cannot be edited.
- A typo in a hand-edited `public/app-config/*.json` (`"connectionMode": "onlnie"`) silently yields
  `switchable`. The operator's only clue is that the app behaves differently from the file they
  wrote. JSON exported from the Settings tab round-trips fine; a hand-written file does not report
  its own errors.

**Recommendation.** Introduce a single descriptor and derive everything else from it:

```js
// useAppConfigStore.js
const APP_CONFIG_KEYS = {
  language:     { normalize: normalizeLanguage,     default: 'de' },
  languageMode: { normalize: normalizeLanguageMode, default: 'multi' },
  // ...
}
```

- `normalizeAppConfigInput` iterates over it.
- `DatabaseConnectionPanel` builds its form from it instead of a literal.
- `config/app.config.js` keeps only the values.
- Add `validateAppConfigInput(input)` returning `{ ok, errors }`, in the shape
  `validateConnectionProfile` already uses. Call it from `importEditableAppConfigFromJsonText` and
  `loadEditableAppConfigFromDefault`, and show the errors where the profile's errors are already
  shown.
- Include the `http`/`https` check for `githubRepo` from DEBT-01.

**Expected benefit.** One declaration of the config shape, and consistent validation and error
reporting for both runtime-loaded config files.

**Effort:** S–M. The descriptor is small; wiring the validator into two loaders and the panel is the
larger half.

**Risks.** Overly strict validation would reject configs that currently load with coerced values.
Start by reporting errors without rejecting: show them in the Settings tab while still applying the
normalised result, and tighten only once the deployed files are known to be clean.

**Dependencies.** Implement the `githubRepo` check together with DEBT-01. Related to DEBT-03.

**Acceptance criterion.**

- The seven keys are listed in exactly one module.
- `DatabaseConnectionPanel` contains no literal list of config keys.
- Importing an app-config JSON with an invalid `connectionMode` shows a field-level error instead of
  silently using a default.

---

### DEBT-05 — Dead, stale and inconsistently reachable code paths

- **Category:** Technical debt · **Priority:** P3 · **Confidence:** High
- **Location:** as listed below.

**Observed.** Five independent leftovers, grouped because they share one cause and one remedy.

| # | Item | Location | Status |
| --- | --- | --- | --- |
| 1 | `config/wording.js` | whole file, 865 lines | Imported by nothing (`app.config.js:3` imports `wording.json`). Contains 215 handles, a strict subset of `wording.json`'s 251. It was converted into `wording.json` in commit `6717317` (2026-08-25), which is also its last edit. Its 29 commits all predate that conversion. The documentation already marks it *"Legacy/unbenutzt … kann entfernt werden"* (`docs/technical-documentation.md:100-103`). |
| 2 | `handleUnauthorized` | `src/stores/useAuthStore.js:105-109,157` | Defined and exported; called from nowhere. |
| 3 | `supportedLanguages` | `src/stores/useAppConfigStore.js:316-332,350` | A computed deriving available languages from the merged wording; nothing uses it. `App.vue:1166-1173` hard-codes DE and EN buttons. |
| 4 | Offline hierarchy path | `src/App.vue:199` (`offlineSelectedHierarchyLevel1Value`), `:227-250` (`buildHierarchyLevel1OptionsFromRawItems`), offline branches at `:317`, `:325`, `:333` | Unreachable. `hierarchyEnabled` derives from `onlineSettings.value` (`App.vue:281-310`), which is `null` unless online mode is authenticated (the watcher teardown at `:1044` clears it), so the offline branches can never run. `onlineHierarchyFields` is also destructured at `:83` and never read. |
| 5 | `wikidata_autosuggest` alias | `src/composables/useFieldMapping.js:14`, `src/services/strapiApi.js:222` | **Inconsistently reachable.** `useFieldMapping` operates on the applied, validated config, and `validateImportedConfigPayload` accepts only registered type names (`userConfigValidation.js:62-73`), so that branch is dead. `strapiApi.js:222` *is* reachable: `checkDataModelImplementationInStrapi` (`:488-497`) reads the raw, unvalidated settings and populates and checks underscore-typed fields. The Settings tab's data-model check can therefore report such a field as correctly implemented, while the main online flow rejects the same settings with *"Feldtyp … wird nicht unterstuetzt"*. |

**Root cause.** Each is a feature that was replaced rather than removed:

- `wording.js` by `wording.json`
- `supportedLanguages` by a hard-coded two-button switch
- the offline hierarchy by the decision to derive the hierarchy from Strapi settings only
- the underscore alias by a stricter validator that only some paths go through

With no linter (MAINT-01), nothing reports an unused binding, so the leftovers are invisible in
review.

**Concrete consequence.** Mostly cognitive, but not only.

- **Item 5** is the most misleading. Two modules advertise tolerance for a settings shape the
  application rejects, and the one diagnostic tool (the data-model check) disagrees with the runtime.
- **Item 1** is a trap, because a maintainer adding a handle there sees no effect and no error. The
  "Legacy" note in the documentation limits the risk, though only for readers who check.
- **Items 3 and 4** cost reading time.
- **Item 2** hides a real gap. There is no 401 recovery anywhere in the app, so an expired JWT
  produces repeated `Request failed with HTTP 401` messages, with no automatic logout and no prompt
  to log in again.

**Recommendation.**

1. **Delete `config/wording.js`.** The documentation already concludes that it can go. First confirm
   that no deployment script references it (`grep -rn "wording'" src/ config/` finds only the file
   itself).
2. **Wire up `handleUnauthorized` or delete it.** Wiring it up is the better answer and is small:
   call it when `error.status === 401`, either in `strapiFetchJson` or at each store's catch site.
   That turns an expired session into a clean logout and login prompt. If that is out of scope now,
   delete the function and open an issue for 401 handling, so the gap is recorded instead of
   half-implemented. Coordinate with MOD-08, since a 401 logout must not silently discard pending
   changes either.
3. **Delete `supportedLanguages`, or use it to drive the language switch.** The latter is a small
   change (`v-for` over `supportedLanguages` in `App.vue:1166-1173`) and would make the switch
   reflect the merged backend wording, which appears to have been the original intent.
4. **Delete the offline hierarchy helpers and the unused binding** as part of MOD-02's
   consolidation. That remedy touches the same code, so do it once.
5. **Either add `wikidata_autosuggest` to the validator's accepted set, or remove the two tolerant
   branches.** Decide by checking whether any deployed Strapi settings use the underscore form (Q2).
   If none do, remove the branches, so the data-model check and the runtime agree.

**Expected benefit.** About 900 lines and five misleading signals removed. One real gap (401
handling) is either closed or explicitly recorded, and the data-model check stops contradicting the
runtime.

**Effort:** S for items 1, 3, 4 and 5. Wiring up item 2 is also S, but needs a decision about how an
expired session should behave for the user.

**Risks.** Item 1 is the only one worth checking twice: confirm that no build tooling or deployment
script references `config/wording.js` before deleting it. Items 3 and 5 change behaviour if the "use
it" option is chosen instead of "delete it", so choose deliberately.

**Dependencies.** Item 4 belongs with MOD-02, and item 2 must respect MOD-08. A linter (MAINT-01)
would prevent recurrence.

**Acceptance criterion.**

- `config/wording.js` no longer exists.
- `grep -rn "handleUnauthorized\|supportedLanguages\|buildHierarchyLevel1OptionsFromRawItems" src/`
  returns only live call sites, or nothing.
- `wikidata_autosuggest` is either accepted end to end or absent from `src/`.
- `npx vitest run` stays green.

---

### DEBT-06 — Collection-wide saves are sequential, unbatched and report no progress

- **Category:** Technical debt / performance · **Priority:** P3 · **Confidence:** Medium
- **Location:** `src/stores/useOnlineUpdatesStore.js:235-333` (`saveOnlineUpdates`),
  `:150-213` (`trackOnlineReplacementUpdatesForRemainingItems`) and
  `src/services/strapiApi.js:388-455` (`fetchAllCollectionItemsFromStrapi`).

**Observed.** An online replacements run is documented as covering the entire collection
(`docs/technical-documentation.md` §11.3). The documentation acknowledges the read cost: §17 notes
that such a run *"lädt die gesamte Collection einmal paginiert nach; bei großen Collections ist das
entsprechend teuer."* The **write** cost is not mentioned. `saveOnlineUpdates` goes through pending
creates and then pending updates in two sequential `for … of` loops, each awaiting one HTTP request:

```js
for (const [entryKey, entry] of updateEntries) {
  try {
    const changedFields = normalizeOnlineChangedFieldsForStrapi(entry.changedFields, fieldConfigs)
    await updateCollectionItemInStrapi({ profile, itemsPath: entry.itemsPath, id: entry.id, token, changedFields })
```

There is no batching and no concurrency limit. There is no progress reporting either: `saveStatus`
is a single `'saving'` for the whole run, and `OnlineAccessPanel` renders it as one indeterminate
state.

**Root cause.** The save loop was written for the interactive case, a handful of items edited by
hand, where sequential writes are correct and simplest. The collection-wide replacements feature
later sent its results through the same queue. That was a good decision, since it reuses the delta
pipeline and the retry semantics, but nobody revisited whether the queue's execution model still
fits.

**Confidence note.** This is reasoned from the code, not measured. The collection size for this
deployment is unknown to the review (see Q1), so the point at which this becomes a real problem is
unknown. What the code does establish is that the number of sequential round trips equals the number
of changed items, with no upper bound and no visible progress.

**Concrete consequence.** For a rule that matches a common substring across a large collection,
pressing *Änderungen speichern* sends one `PUT` per changed item, strictly one after another. At a
conservative 100 ms per round trip, 2,000 changed items take over three minutes behind a single
indeterminate spinner, with no indication of progress or remaining work. A reload or navigation
during that time abandons the run part way. Pending changes are then lost without warning (MOD-08),
and the saved ones keep a stale baseline if any failed (DEBT-07). The read side has the same shape:
`trackOnlineReplacementUpdatesForRemainingItems` fetches every page before reporting anything.

**Recommendation.** In proportion to a feature that is used deliberately and rarely:

1. **Report progress.** Add a counter to `saveStatus` (`{ status: 'saving', done, total }`) and show
   "saving 412 / 2000" in `OnlineAccessPanel`. This removes the "is it stuck?" question and is worth
   doing whatever the collection size.
2. **Add bounded concurrency.** Process the update queue with a small worker pool (4–6 requests in
   flight) instead of one at a time. This is a contained change to the two loops and typically
   removes most of the wall-clock time. Keep it bounded: an unbounded `Promise.all` over thousands of
   writes would trade this problem for a rate-limiting one.
3. **Warn before a large save.** When a replacements run produces more pending updates than some
   threshold, say so in the summary line that `ReplacementsPanel` already renders
   (`lastApplySummary` carries `remoteChangedItemCount`), so the user knows the cost before pressing
   save.

Do not batch at the HTTP level. Strapi's REST API has no bulk-update endpoint, so batching would
need a custom backend endpoint. That is out of proportion unless measurement shows the concurrency
fix is not enough.

**Expected benefit.** A long save becomes understandable and several times faster, without changing
the delta and retry semantics.

**Effort:** M. The worker pool and the progress counter are each small. The care goes into threading
the counter through `saveStatus` to the panel while keeping the partial-failure semantics intact.

**Risks.** Concurrent writes to the same Strapi instance can hit rate limits or lock contention.
Keep the pool small, and keep collecting failures instead of aborting. Check that partial-failure
handling (`:317-332`) and the snapshot sync in `App.vue` (including DEBT-07's fix) still behave
correctly when completions arrive out of order.

**Dependencies.** Do this after DEBT-07. MOD-06's explicit-dependency change touches the same
function.

**Acceptance criterion.**

- `OnlineAccessPanel` shows a progress count during a multi-item save.
- A test asserts that no more than N requests are in flight at once.
- The existing `useOnlineUpdatesStore.test.js` assertions for partial failures still pass.

---

### DEBT-08 — Suspending the selected item is reverted when it is last in the list

- **Category:** Technical debt / correctness · **Priority:** P3 · **Confidence:** High (**verified by
  harness**: the two `App.vue` code blocks run verbatim against the real `useViewerData`)
- **Location:** `src/App.vue:568-584` (`onSuspendEditingToggle`) and `src/App.vue:918-931`
  (auto-unsuspend watcher).

**Observed.** The watcher un-suspends the selected item whenever it finds that item suspended. It
watches both the selection *and* the suspended-index list:

```js
watch([() => selectedViewItem.value?._uid || null, () => suspendedItemIndices.value.join('|')],
  ([nextSelectedUid]) => { ...
    if (!suspendedItemIndices.value.includes(nextSelectedIndex)) return
    toggleSuspendEditingByUid(nextSelectedUid, false)
  })
```

When the user suspends the selected item, `onSuspendEditingToggle` moves the selection to the next
item in the filtered list, and the watcher then finds nothing to undo. If the item is **last** in the
list (or the only one, or the last search result), there is no next item. The selection stays put,
the index list changes, the watcher runs, and it un-suspends the item straight away.

**Verification.**

```
PROBE suspend selected item at list position 0 -> suspended indices = [0]
PROBE suspend selected item at list position 2 -> suspended indices = []
```

**Root cause.** The watcher implements "selecting a suspended item un-suspends it" by observing two
sources. It therefore cannot tell "the selection moved to a suspended item" from "the selected item
was just suspended". The auto-advance in the toggle handler hides the conflict everywhere except at
the end of the list.

**Concrete consequence.** When a user works through the list and ticks *Bearbeitung aussetzen* on the
last card, the checkbox flips back. `toggleSuspendEditingByUid` sets `isDirty` both times, so the app
now reports unsaved changes although nothing changed, and the export contains no suspension for that
item. Impact is limited to that one control, but the failure is silent.

**Recommendation.** Watch the selection only, since that is the event the rule describes. Drop the
`suspendedItemIndices` source, or equivalently compare against the previous uid and return early when
the uid did not change. Nothing else needs the second source: imports and resets clear the selection
anyway (`useViewerData.js:325`).

**Expected benefit.** The suspend control works for every item, and the rule it implements is stated
by its trigger.

**Effort:** S. A one-line change plus a test (the harness above can serve as the test once MAINT-01
allows mounting, or once the logic moves to a composable with MOD-01).

**Risks.** Check the other entry point: selecting an already-suspended item from the list must still
un-suspend it.

**Dependencies.** None.

**Acceptance criterion.**

- Suspending the selected last item of the filtered list leaves it suspended.
- Selecting a suspended item still un-suspends it.
- Both are covered by a test.

---

## 5 Remediation roadmap

The order below follows two principles: fix what loses user work first, then build the safety net
before restructuring. Nothing here requires a rewrite. No finding calls for a new framework, a new
architectural layer, or dependencies beyond a test environment and a linter.

### Stage 0 — Immediate, independent, no prerequisites

Small, self-contained fixes. None depends on the test environment; each ships with the composable- or
store-level test named in its acceptance criterion.

| Order | Finding | Why first |
| --- | --- | --- |
| 1 | **MAINT-07**: make JSON import atomic; restore the error display in the header | Verified silent config replacement on export in the core offline workflow. |
| 2 | **MOD-08** steps 1–2: guard the four discard points; add pending online changes to `beforeunload` | Unsaved online work, possibly collection-wide, is lost without warning. |
| 3 | **DEBT-01**: remove the `v-html`, validate `githubRepo` | Closes a script-execution path from backend-controlled data. Under an hour. |
| 4 | **DEBT-02**: reject 200/non-JSON responses; bound the retry loops | Verified endless request loop on the main network paths. |
| 5 | **DEBT-07**: re-baseline successfully saved updates on partial failure | Verified silent server/UI mismatch. |
| 6 | **DEBT-03**: fix `clearEditableAppConfig` | Verified; the Settings tab currently reports the opposite of what happened. |
| 7 | **DEBT-04**: fall back to the stored profile when the default fetch fails | Removes a single point of failure between a bundled file and all online features. |
| 8 | **DEBT-08**: watch the selection only | One-line fix for a verified revert. |
| 9 | **MAINT-05**: correct the documentation drift | Do the §9.2 and §12.8 rows together with #1 and #5; the base-path row takes minutes. |

**Validation for stage 0:**

- Each fix ships with its regression test, and `npx vitest run` stays green.
- Manual smoke test:
  - import an invalid-config JSON: the error is visible and the data is unchanged
  - in hierarchy mode, run a replacement, then click a category: a confirmation appears
  - Settings tab: save → clear → the panel reports no saved settings
  - start an online session

### Stage 1 — Build the safety net

| Order | Finding | Why here |
| --- | --- | --- |
| 10 | **MAINT-01**: jsdom + `@vue/test-utils` + ESLint | Prerequisite for everything in stage 3. Adds the component tests stage 0 could not have: MAINT-07's render site, MOD-08's guard, DEBT-08's watcher. The linter also stops DEBT-05 from recurring. |
| 11 | **MAINT-03**: shared utilities; move `hasNonEmptyValue` and `splitCsvLine` to their owners | Cheap, mechanical, fully covered by the existing suite. Removes about 25 definitions that later stages would otherwise have to update. |
| 12 | **MAINT-04**: guard `sessionStorage` | Goes along with #11's utility module. |

**Validation:** `npx eslint .` reports zero errors on the configured rule set; the component tests
for MAINT-07, MOD-08 and DEBT-08 exist and pass; the suite stays green throughout #11.

### Stage 2 — Consolidate the scattered contracts

These share one root cause, knowledge re-derived by each consumer, and each can ship on its own.
Doing them before stage 3 means the big extractions move consolidated code instead of duplicated
code.

| Order | Finding | Notes |
| --- | --- | --- |
| 13 | **MOD-06**: explicit `profile`/`token` in the online layer | First in this stage, because it simplifies both MOD-02's and MOD-01's extractions and removes shared test scaffolding. One commit per store. |
| 14 | **MOD-02**: one `resolveHierarchyFields` | Fixes a blank screen and an accidental config-shadowing path. Agree the union of accepted shapes first (Q2). |
| 15 | **MOD-03**: move the field vocabulary into the registry | Makes the documented extension point true. |
| 16 | **MOD-04**: one autosuggest schema module | Same shape as #15, different subsystem. |
| 17 | **DEBT-05**: remove dead and inconsistent code | Last in this stage: #14 removes the offline hierarchy path as a side effect, and the linter from #10 will have found anything this list missed. Decide the `handleUnauthorized` question explicitly, together with MOD-08, instead of by deleting it. |

**Validation:** for #14 and #16, write a shape-matrix test listing every legacy form that any current
implementation accepts, and run it against the new single resolver *before* deleting the old
implementations. For #14, check against a copy of the production settings singleton before the first
`Konfiguration anwenden` write-back.

### Stage 3 — Structural work

Only now, with tests, a linter and consolidated contracts in place.

| Order | Finding | Notes |
| --- | --- | --- |
| 18 | **MOD-01**: extract `useStickyHeaderMetrics`, then `useHierarchyNavigation`, then `useOnlineSession` | In that order: cheapest and most isolated first. The hierarchy extraction absorbs MOD-02's resolver. `useOnlineSession` absorbs MOD-08 step 3 and DEBT-07's re-baselining. Carry the ordering comments across verbatim. |
| 19 | **MOD-05**: split `ListPanel`, shrink `useDataImportExport` | Split `ListPanel` with zero markup changes, then check the sticky offsets at both breakpoints. |
| 20 | **MAINT-02**: error-code boundary + `t()` interpolation | Touches many call sites; cheaper once #18 has settled the module layout. |
| 21 | **MOD-07**: remove `inventory_number`; name the `P1566` constant | Ship the Strapi settings change (`itemLabelField`) *before* the code change. |
| 22 | **MAINT-06**: one app-config descriptor + validator | Fold in the `githubRepo` protocol check from DEBT-01. |

**Validation:** after #18, `src/App.vue` contains no hierarchy derivation, no `ResizeObserver` wiring,
no online-initialisation watcher body and no direct `clearOnlineUpdates` call. Each extracted module
has its own test file. Finish with a full manual pass through all five tabs in both offline and
online mode.

### Debt that can reasonably stay for now

- **DEBT-06** (sequential saves). The correctness properties are sound once DEBT-07 and MOD-08 are
  fixed. Do step 1 (progress reporting) when convenient. Defer the worker pool until someone reports
  a slow save, and size it from measurement rather than from this review.
- **The `legacy.scss` layer** (73 lines). Labelled a temporary migration layer, but small, coherent
  and causing no observed problem. Retire it when the components it styles are next touched; do not
  schedule it.
- **`ConfigurationPanel.vue`**, a 29-line pass-through wrapper around `UserConfigPanel`. An
  unnecessary indirection, but harmless. Remove it if `UserConfigPanel` is ever refactored.
- **The multi-candidate URL probing** in `publicConfigUrls.js`. It adds a few sequential 404s per
  config file at startup, which is slightly slower than necessary, but it is what makes the app
  portable across deploy paths, a real requirement. Leave it.
- **The `P1566` GeoNames shortcut.** Removing it would change entity payloads that are already saved.
  Naming the constant is enough.
- **Plain JavaScript, no TypeScript.** Nothing in this review would have been prevented by types that
  a linter, component tests and the proposed consolidations will not also prevent. Not recommended.

---

## 6 Open questions and unverified concerns

These are not presented as findings. Each states what is uncertain, why it matters, and the smallest
step that would resolve it.

**Q1 — How large is the live collection?** *(Affects DEBT-06's priority and the practical size of
MOD-08's data loss.)* The analysis of sequential saves is structurally sound, but its practical
severity depends entirely on the item count and on how often collection-wide replacement runs are
used. If the collection is a few hundred cards, DEBT-06 does not justify a worker pool, and the
progress counter alone is enough.
**Smallest check:** one authenticated request to `<baseUrl>/<itemsPath>?pagination[pageSize]=1`,
then read `meta.pagination.total`.

**Q2 — Does any deployed Strapi settings payload use a legacy shape?** *(Affects MOD-02, MOD-04 and
DEBT-05 item 5.)* Several compatibility branches exist for shapes that may have no live users:
`config.hierarchy_fields`, `hierarchy.{level1,level2}`, `wikidata_autosuggest`, string `defs`,
`item_path`, `scan_field`. Consolidating is safe either way, but knowing which are live decides
whether the union can later be *narrowed*.
**Smallest check:** fetch and inspect the settings singleton (`GET <configPath>`) of the one deployed
instance. The shipped profile points at
`https://cms.berlin-university-collections.de/hu-ur-und-fruehgeschichte-karteikarten`.

**Q3 — Who can write the viewer-settings singleton?** *(Affects DEBT-01's severity.)* The assessment
assumes regular authenticated users can `PUT <configPath>`, since both `Konfiguration anwenden` and
`Änderungen speichern` do exactly that. If Strapi's permissions restrict that route to an admin role,
DEBT-01 becomes a narrower privilege-escalation concern. The fix is cheap enough to make either way.
**Smallest check:** read the Strapi role permissions for the viewer-settings content type.

**Q4 — Was the shipped default connection profile's label intentional?**
`public/connection-profile/viewer-editor-connection-profile.v1.json` has
`"label": "FU Xylothek - Migration"`, while its `baseUrl` points at the HU Ur- und Frühgeschichte
instance. The label is visible to users in the Settings tab form. It looks like a leftover from the
project this deployment was cloned from. Cosmetic, and possibly deliberate.
**Smallest check:** ask, and correct the string if it is not intentional.

**Q5 — Is `dist/` what is deployed?** The untracked `dist/index.html` is dated 2026-09-04 12:24 and
uses the current base path. Revision 1's concern about an old base path is therefore resolved. The
commits `17e77dc`, `60c95dd` and `54f233a` carry later timestamps (12:29), so the build may predate
the sticky topbar and the runtime app-config loading. If `dist/` is what gets deployed, production
may lack those features.
**Smallest check:** rebuild and compare asset hashes, or check the deployed site for the sticky
topbar.

**Q6 — Should pending online edits survive a hierarchy-category switch, or block it?** *(Affects the
scope of MOD-08 step 3.)* §11.3 of the documentation implies that users are expected to switch
buckets after a replacements run and before saving. That favours *keeping* pending changes across
switches rather than confirm-and-discard. It needs a design for how reloaded server values relate to
unsaved deltas on the same items. Stage 0's guard is correct either way.
**Smallest check:** a product decision by the maintainers. Any user reports of "lost replacements"
would settle the priority.

### Resolved since revision 1

- **Old Q4 (base path of `dist/`).** Resolved: it matches `vite.config.js`. The remaining uncertainty
  is carried as Q5.
- **Old Q6 (is the `beforeunload` guard reachable online).** Resolved statically: it does not cover
  pending online updates when `isDirty` is false, and online replacement runs create exactly that
  state. Now part of **MOD-08**.
- **Old Q7 (suspend-watcher race).** Resolved by harness: suspending the selected item is reverted
  when it is last in the filtered list. Now **DEBT-08**.

---

*Reviewed against commit `54f233a`; revision 2 re-verified at `24d85ff` (identical application code)
on 2026-09-16. Test suite verified passing (19 files, 183 tests). Five findings were reproduced by
execution: DEBT-02, DEBT-03, MAINT-07, DEBT-07, and DEBT-08 through a verbatim harness. All other
findings are static-analysis conclusions from reading the code, cross-checked against the existing
tests, the git history and the documentation. No application file, configuration file, dependency or
existing document was modified by this review.*
