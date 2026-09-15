# Code Review Report — Modularity, Maintainability, Technical Debt

## 1 Overall assessment

The codebase is in better shape than its size suggests. There is a real architecture here, not an
accidental one: a frozen field-type registry with an explicit contract (`src/fields/fieldRegistry.js`),
a Vue-free rule engine for replacements (`src/composables/replacementRules.js`), a pure
validator/normalizer pair for connection profiles (`src/composables/connectionProfile.js`), and a
Strapi HTTP layer that is genuinely confined to one module (`src/services/strapiApi.js`). 183 tests
pass, and several of them encode non-obvious decisions (integer coercion rules, partial-language
Wikidata merges, retry after a rejected `populate` key) rather than restating the implementation. The
documentation in `docs/technical-documentation.md` is unusually detailed and, on most points,
accurate — including its own known-limits chapter.

Three themes account for nearly every finding below.

**The composition root absorbed the architecture.** `src/App.vue` is 1,355 lines with 37 functions and
11 watchers, and git records it as changed in **67 of 107 commits (63%)**. It is not merely large; it
owns decisions that belong elsewhere — how hierarchy fields are read out of Strapi settings, the exact
sequencing of the online initialisation flow, which config wins after a mode switch. Because it is a
`.vue` file and the project has no DOM test environment, none of that logic is reachable by a test.
Every feature in this repository has been paid for with an edit to the one file that nothing protects.

**The same knowledge is re-derived instead of shared.** This is not cosmetic duplication. Hierarchy
resolution is implemented three times with *different* accepted key sets (MOD-02), the autosuggest
`defs` shape is interpreted by four modules (MOD-04), the reserved-field-key list exists in four places
and the allowed field widths in four more (MOD-03), and `hasNonEmptyValue` — the rule that decides
whether an item counts as "edited" and which fields get POSTed — is copied byte-for-byte across three
layers (MAINT-03). At least one of these divergences already produces a silently blank screen.

**Small deliberate shortcuts have outlived their justification.** A `v-html` that exists only to honour
a `<br>` now renders backend-controlled text (DEBT-01). A retry loop that recovers from one Strapi
quirk spins forever on another (DEBT-02). A dead 865-line `config/wording.js` was still being edited
29 commits into its own obsolescence (DEBT-05). None of these is expensive to repay; all of them are
cheap to leave in place for another year, which is exactly why they are still here.

**Worth preserving, and worth using as the template for the rest:** `fieldRegistry.js`,
`replacementRules.js`, `connectionProfile.js`, `publicConfigUrls.js` and `useReplacementsApply.js`
share one shape — pure functions or explicitly-injected dependencies, no module-global reactive state,
no Vue import where none is needed, and a test file that exercises behaviour rather than structure.
`useReplacementsApply.js` in particular shows that the online/offline split *can* be expressed as an
injectable seam. The recommendations below are mostly about extending that existing pattern, not about
introducing a new one.

---

## 2 Scope and verification

### Reviewed baseline

| Item | Value |
| --- | --- |
| Repository | `viewer-editor-minimal-version` (HU Ur- und Frühgeschichte Kartei viewer) |
| Baseline commit | `54f233a` "load the app config from public/app-config at startup" |
| Branch at review start | `sticky-topbar-and-runtime-app-config` (default branch: `main`) |
| Working tree | clean at start; unchanged by the review apart from this report |
| Reviewed source | ~7,900 lines of first-party `src/` + `config/` code, ~3,100 lines of tests |

### Areas inspected

Read in full: `src/App.vue`; all 10 stores and composables under `src/stores/` and
`src/composables/`; `src/services/strapiApi.js`; `src/fields/`; `config/app.config.js`;
`vite.config.js`; `package.json`; `README.md`; `docs/technical-documentation.md`;
`docs/conventions.md`; both files under `public/app-config/` and `public/connection-profile/`;
`src/assets/styles/index.scss`, `legacy.scss` and `components/_index.scss`.

Read at least in script/`defineProps` depth: all 17 components under `src/components/`, with
`ListPanel.vue`, `ItemFieldEditor.vue`, `DatabaseConnectionPanel.vue`, `OnlineAccessPanel.vue`,
`UserConfigPanel.vue`, `WikidataAutosuggestInput.vue` and `config/AutosuggestFieldConfig.vue` read
substantially in full.

Sampled rather than read line-by-line: the `<template>` and `<style>` blocks of the larger SFCs;
`src/assets/styles/layout/_index.scss` (431 lines) and `tokens/`/`base/`; the 19 `*.test.js` files
(read for setup patterns and for what they assert, not exhaustively);
`config/wording.json` (251 entries, inspected structurally and by key diff).

### Workflows traced end to end

1. **Local JSON import → config apply → export.** `DataTransferControls` → `useDataImportExport.onDataFileSelected`
   → `useViewerData.importFromJsonText` → `parseJsonPayload` → `applyImportedConfigPayload` →
   `applyUserConfigToRawItems` → `onDownload`.
2. **Online startup.** `App.vue onMounted` (app-config → data mode → app mode → connection profile →
   `restoreSession`) → the `[appMode, isAuthenticated, onlineConfigOnly, baseUrl, configPath]` watcher →
   `fetchOnlineSettings` → `setOnlineWording` → `applyImportedConfigPayload` → `fetchOnlineItems`,
   including the `Configuration only` early exit and the `markOnlineSettingsInvalid` failure path.
3. **Hierarchy navigation.** `useOnlineItemsStore.fetchOnlineItems` (static list / level-1 value fetch /
   flat) → `onSelectHierarchyLevel1` → `fetchOnlineItemsForHierarchyLevel1` → `ListPanel`
   level-2 grouping. This is where MOD-02 was found.
4. **Edit → delta → save.** `ItemFieldEditor` → `onFieldChange` → `useViewerData.updateField` →
   `trackOnlineFieldChange` → `saveOnlineUpdates` (creates before updates) → `markAsSaved`, including
   the partial-failure path and `syncSnapshotItemAtIndex`.
5. **Replacements run over a whole collection.** `ReplacementsUnit` → `useReplacementsApply.applyReplacementsNow`
   → `applyReplacementsToLoadedItems` + `trackOnlineReplacementUpdatesForRemainingItems` →
   `persistOnlineReplacements`.
6. **Runtime config resolution.** `resolvePublicConfigUrls` → `fetchFirstAvailableConfigText` →
   `loadEditableAppConfigFromDefault` / `loadConnectionProfileFromDefault`, both success and failure
   branches. This is where DEBT-03 and DEBT-04 were found.

### Checks run

| Check | Command | Result |
| --- | --- | --- |
| Test suite | `npx vitest run` | **Pass** — 19 files, 183 tests, 3.7 s |
| Targeted probe: app-config reset | temporary vitest file, deleted after the run | **Reproduced DEBT-03** |
| Targeted probe: paginated fetch loop | temporary vitest file, deleted after the run | **Reproduced DEBT-02** (aborted at 51 identical requests) |
| Lint | — | **Not run: no linter configured** (no ESLint/Prettier config, no lint script) |
| Type check | — | **Not run: no type checking exists** (plain JS, no TS, no `checkJs`) |
| Production build | `vite build` | **Not run** — a `dist/` from a prior build is present and untracked; not re-run to avoid overwriting it |
| CI | — | **None exists** (no `.github/`, `.gitlab-ci.yml`, or hooks) |

Both probe files were created inside `src/` (vitest resolves modules relative to the project root),
run once, and deleted; `git status` was verified clean afterwards. No application file, config file,
dependency or existing document was modified.

### Exclusions and limitations

- `node_modules/` and `dist/` were excluded from code inspection, as instructed. Dependency *usage*
  was assessed; dependency *contents* were not.
- `_INTERN/` and `_planning/` are gitignored working material and were read only for the task brief.
- **No behaviour was verified against a running browser or a live Strapi instance.** Everything about
  the online mode is derived from code reading plus the existing tests, except DEBT-02 and DEBT-03,
  which were reproduced by execution and are labelled as such. Findings that depend on a specific
  server response shape (DEBT-02's trigger, the `wikidata_id` data-model paths) state the scenario
  explicitly rather than claiming it was observed in production.
- `config/wording.json` was diffed against `config/wording.js` by key, not by translation quality.
- Visual/CSS correctness and accessibility beyond the ARIA attributes visible in the markup were not
  assessed.

---

## 3 Prioritized findings index

| ID | Title | Category | Priority | Confidence | Affected area | Effort |
| --- | --- | --- | --- | --- | --- | --- |
| MOD-01 | `App.vue` owns orchestration that belongs in testable modules | Modularity | P1 | High | `src/App.vue` | L |
| MOD-02 | Hierarchy configuration is resolved three times, with divergent key sets | Modularity | P1 | High | `App.vue`, `useOnlineItemsStore`, `useUserConfigStore` | M |
| DEBT-01 | Backend-controlled wording is rendered through `v-html` | Debt / Security | P1 | High | `footer/Identity.vue`, `useAppConfigStore` | S |
| MAINT-01 | No component test seam, no lint, no type check, no CI | Maintainability | P1 | High | tooling, `package.json` | M |
| MOD-03 | The field-type contract leaks outside the registry | Modularity | P2 | High | `fieldRegistry`, `ItemFieldEditor`, 4 further modules | M |
| MOD-04 | The autosuggest config schema has four independent interpreters | Modularity | P2 | High | `useWikidataSearch`, 3 components | M |
| MOD-05 | Parameter-bag composables and prop-bag components | Modularity | P2 | High | `useDataImportExport`, `ListPanel`, `App.vue` | M |
| MOD-06 | Two opposite dependency conventions in the Strapi layer | Modularity | P2 | High | `src/stores/useOnline*.js`, `useAuthStore` | M |
| MAINT-02 | Error messages bypass the wording system, in two languages | Maintainability | P2 | High | `useViewerData`, `userConfigValidation`, online stores | M |
| MAINT-03 | No shared utility kernel; a business rule is copied three times | Maintainability | P2 | High | repo-wide | S |
| MAINT-05 | Documentation drift on deployment-critical facts | Maintainability | P2 | High | `README.md`, `docs/technical-documentation.md` | S |
| DEBT-02 | Unbounded request loop when Strapi answers 200 with a non-JSON body | Debt / Reliability | P2 | High (verified) | `strapiApi.js` | S |
| DEBT-03 | Clearing saved app settings leaves the UI claiming they are still active | Debt / Correctness | P2 | High (verified) | `useAppConfigStore`, `DatabaseConnectionPanel` | S |
| DEBT-04 | A failed default-profile fetch discards a valid stored connection profile | Debt / Reliability | P2 | High | `useConnectionProfileStore` | S |
| MOD-07 | Dataset-specific assumptions embedded in generic components | Modularity | P3 | High | `ListPanel.vue`, `WikidataAutosuggestInput.vue` | S |
| MAINT-04 | `sessionStorage` access is unguarded while `localStorage` is guarded | Maintainability | P3 | High | `useDataTransferStore`, `useUserConfigStore` | S |
| MAINT-06 | The app-config shape is declared three times and never validated | Maintainability | P3 | High | `app.config.js`, `useAppConfigStore`, `DatabaseConnectionPanel` | S |
| DEBT-05 | Dead and unreachable code paths | Debt | P3 | High | `config/wording.js`, `useAuthStore`, `App.vue`, `useAppConfigStore` | S |
| DEBT-06 | Collection-wide saves are sequential, unbatched and unreported | Debt / Performance | P3 | Medium | `useOnlineUpdatesStore` | M |

Effort assumes a developer already familiar with this codebase. `S` ≈ under a day, `M` ≈ one to three
days, `L` ≈ more than three days and best split across several changes.

---

## 4 Detailed findings

### MOD-01 — `App.vue` owns orchestration that belongs in testable modules

- **Category:** Modularity / cohesion · **Priority:** P1 · **Confidence:** High
- **Location:** `src/App.vue:1-1106` (script block). Representative regions:
  `src/App.vue:203-308` (hierarchy derivation), `src/App.vue:1018-1096` (online initialisation watcher),
  `src/App.vue:466-566` (save orchestration), `src/App.vue:761-800` (sticky-layout measurement).

**Observed.** The file is 1,355 lines: 37 top-level functions, 11 `watch` blocks, 13 store/composable
destructures, and a template that instantiates `ListPanel` twice with 24+ props each. Its
responsibilities include: deriving hierarchy field keys from raw Strapi settings; building
level-1/level-2 option lists from `rawItems`; sequencing the six-step online initialisation; merging
the user config into the settings payload before write-back; measuring three sticky elements with a
`ResizeObserver` and writing CSS custom properties; managing lightbox, extended-edit, modal and
image-failure UI state; and owning the `beforeunload` and `Escape` handlers.

The documentation states the intent plainly (`docs/technical-documentation.md`, §14): *"`App.vue`
bleibt Composition-Root und beschränkt sich auf Verdrahtung von Komponenten, Stores, Watchern und
Lifecycle-Events."* Wiring is the stated contract; the code has grown past it.

**Root cause.** Each new feature needed a place where two or more stores meet. No such place existed
other than the composition root, and no seam was introduced as the count grew — so cross-store
coordination accreted in `App.vue` by default rather than by decision. The two genuine seams that were
extracted (`useDataImportExport`, `useReplacementsApply`) show the pattern was understood; it just was
not applied to the online flow or the hierarchy.

**Concrete consequence.** This is measurable rather than hypothetical: `git log` shows `src/App.vue`
modified in **67 of 107 commits (63%)**, and in every one of the last 20 feature commits. Because
vitest has no DOM environment configured (see MAINT-01), *none* of this logic has a test. The
practical effect is that the highest-churn file in the repository has zero regression protection, and
that two developers adding unrelated features will almost certainly conflict in it.

**Recommendation.** Do not split `App.vue` by line count. Extract by *responsibility*, reusing the
`useReplacementsApply` pattern (explicit dependency injection, returns an action surface, no Vue
component required to test it). In priority order:

1. `useHierarchyNavigation.js` — owns `hierarchicalFields`, level-1/level-2 option building, selection
   and expansion state, and `onSelectHierarchyLevel1`. This is the extraction that also fixes MOD-02,
   so do it once, for both.
2. `useOnlineSession.js` — owns the initialisation watcher (`src/App.vue:1018-1096`), the teardown
   branch, and `onSaveOnlineChanges`/`onApplyUserConfig` write-back. Its inputs are already explicit
   (`appMode`, `isAuthenticated`, `connectionProfile`, `onlineConfigOnly`); passing them in rather than
   closing over them makes the six-step sequence assertable.
3. `useStickyHeaderMetrics.js` — the `ResizeObserver`, listeners and CSS-variable writes
   (`src/App.vue:755-800`, plus the `onMounted`/`onBeforeUnmount`/`activeTab` wiring). Self-contained,
   no dependencies on the rest; the cheapest of the three.

Leave the tab state, lightbox state and template in `App.vue` — those genuinely are composition-root
concerns.

**Expected benefit.** The online initialisation sequence and the hierarchy rules become unit-testable
without a DOM. `App.vue` drops to roughly 600–700 lines of wiring, and feature work stops converging
on one file.

**Effort:** L — assumes the three extractions land as separate commits, each with tests, and that
MAINT-01's test environment is in place first (otherwise the extractions are unverifiable).

**Risks.** Watcher extraction is the risky part: the initialisation watcher depends on ordering that is
documented as binding (`docs/technical-documentation.md` §4.4 and §14 both flag `onMounted` ordering
constraints). Extract the sequence *as it stands*, with the ordering comments carried across, before
changing anything about it.

**Dependencies.** Prerequisite for MOD-02's remedy. Should follow MAINT-01.

**Acceptance criterion.** `src/App.vue` no longer contains `normalizeHierarchyFields`,
`buildHierarchyLevel1OptionsFromRawItems`, `buildHierarchyLevel2OptionsFromRawItems`, the
`ResizeObserver` wiring, or the online-initialisation watcher body; each extracted module has a test
file asserting at least its failure path; `npx vitest run` stays green and the tab/edit/online flows
behave identically in a manual smoke test.

---

### MOD-02 — Hierarchy configuration is resolved three times, with divergent key sets

- **Category:** Modularity / coupling · **Priority:** P1 · **Confidence:** High
- **Location:**
  - `src/App.vue:280-308` — `hierarchicalFields` computed
  - `src/stores/useOnlineItemsStore.js:26-85` — `normalizeHierarchyFields(settings)`
  - `src/stores/useUserConfigStore.js:103-140` — `resolveHierarchyFieldsFromConfig(configPayload)`
  - plus `src/components/ListPanel.vue:236-246` (a fourth normalisation of the resulting values)

**Observed.** Three independent implementations read the same tolerant settings shape. They do not
accept the same keys:

| Source key | `App.vue` | `useOnlineItemsStore` | `useUserConfigStore` |
| --- | --- | --- | --- |
| `hierarchyFields` / `hierarchy_fields` / `hierarchicalFields` | yes | yes | yes |
| `hierarchy.fields` | yes | yes | yes |
| `config.hierarchyFields` | yes | yes | **no** |
| `config.hierarchy_fields` | **no** | yes | **no** |
| `hierarchy.{level1,level2}` object | yes | yes | yes |
| auto-detect `level_1`/`level_2` in `settings.fields` | yes | yes | **no** |

The same split exists for the static level-1 list: `useOnlineItemsStore.js:87-99` accepts
`config.firstLevelStaticList`, `useUserConfigStore.js:142-150` does not.

The store already publishes its normalised result, and `App.vue` already imports it — and then ignores
it. `src/App.vue:83` destructures `hierarchyFields: onlineHierarchyFields`, and that binding is never
referenced anywhere in the file; `App.vue` re-derives the same thing at line 280 instead.

**Root cause.** `App.vue` needs the hierarchy field keys for rendering, `useOnlineItemsStore` needs
them for choosing a fetch strategy, and `useUserConfigStore` needs them to round-trip the Configuration
tab. Rather than one resolver with three consumers, each consumer grew its own — and each was extended
with a new tolerated key at a different time, so they drifted apart without any single change looking
wrong.

**Concrete consequence.** For a Strapi settings singleton that nests the hierarchy as
`settings.config.hierarchy_fields` — a shape `useOnlineItemsStore` explicitly supports — the two
modules disagree:

1. `fetchOnlineItems` sees two hierarchy fields, takes the hierarchy branch, fetches only the level-1
   field values, populates `hierarchyLevel1Options`, and returns `items: []` with
   `hierarchyEnabled: true` (`useOnlineItemsStore.js:176-215`).
2. `App.vue`'s `hierarchicalFields` returns `[]`, so `hierarchyEnabled` is `false`, so
   `hierarchyLevel1Options` returns `[]` (`App.vue:311-317`) and `ListPanel` receives
   `hierarchy-fields: []`.
3. `ListPanel.hasHierarchy` is false, so it renders the flat list — which is empty.

The user sees the Edit tab with *"Nach dem Upload erscheinen hier die Einträge."* and no error, no
level-1 boxes, and no indication that the data was never requested. Debugging this requires knowing
that two different functions answer the same question differently.

A second, milder consequence affects the Configuration tab: because `useUserConfigStore` accepts
neither `config.*` form nor the `level_1`/`level_2` auto-detection, a working hierarchy configured in
any of those shapes round-trips as *empty* hierarchy fields. Pressing `Konfiguration anwenden` in
online mode then writes that empty list back to Strapi (`App.vue:598-612` merges
`createUserConfigPayload()`, which includes `hierarchyFields: []`, over the existing settings) —
silently destroying the hierarchy configuration for every user of that instance.

**Recommendation.** Create `src/composables/hierarchyConfig.js` exporting
`resolveHierarchyFields(settings)` and `resolveFirstLevelStaticList(settings)` — pure functions, the
**union** of the three current key sets, with a test that pins every accepted shape (including each
legacy form the three implementations currently support between them). Make all three call sites use
it. In `App.vue`, prefer consuming the store's already-normalised `onlineHierarchyFields` over
re-deriving, and delete the local copy. Fold this into MOD-01's `useHierarchyNavigation` extraction so
the hierarchy is touched once, not twice.

**Expected benefit.** One answer to "is hierarchy active and on which fields", pinned by tests; the
`config.hierarchy_fields` blank screen becomes impossible; `Konfiguration anwenden` stops being able to
erase a hierarchy it failed to read.

**Effort:** M — the resolver itself is an afternoon; agreeing the union of accepted shapes and writing
the shape-matrix test is the bulk of it.

**Risks.** Widening `useUserConfigStore`'s accepted set changes what `Konfiguration anwenden` writes
back for instances currently using a `config.*` shape — from "empty" to "the actual fields", which is
the intended fix but is still a behaviour change against live data. Verify against a copy of the
production settings singleton before the first write-back.

**Dependencies.** Best sequenced with MOD-01 step 1. Shares its root cause with MOD-03 and MOD-04.

**Acceptance criterion.** A single exported `resolveHierarchyFields` is the only implementation in
`src/`; a test asserts identical output for all seven documented input shapes
(`docs/technical-documentation.md` §12.5); a settings payload using `config.hierarchy_fields` renders
level-1 boxes in the Edit tab.

---

### DEBT-01 — Backend-controlled wording is rendered through `v-html`

- **Category:** Technical debt / security · **Priority:** P1 · **Confidence:** High
- **Location:** `src/components/footer/Identity.vue:22`; wording merge at
  `src/stores/useAppConfigStore.js:281-299`; injection point at `src/App.vue:1040`
  (`setOnlineWording(result.wording)`); secondary sink at `src/components/footer/Identity.vue:14`.

**Observed.**

```vue
<span class="identity-credit" v-html="t('footerIdentityCredit', 'A tool by ...')" />
```

`t()` resolves against `mergedWording`, which merges the dictionary returned by
`GET <configPath>` (`data.wording`) over the local one. Only two handles are protected from backend
override — `localWordingOverrideKeys = new Set(['tabDatabaseConnection', 'dbConnectionOpenTab'])`
(`useAppConfigStore.js:10`). `footerIdentityCredit` is not among them, so its value can be supplied by
the Strapi settings singleton and is then inserted as raw HTML.

The singleton is writable by ordinary application users: `Konfiguration anwenden` in online mode issues
`PUT <configPath>` (`useOnlineSettingsStore.persistOnlineSettings` → `updateViewerSettingsInStrapi`),
and `Änderungen speichern` issues a second `PUT` to the same path for `replacements`.

**Root cause.** The `v-html` predates the backend-wording feature. It exists for a single reason: the
shipped value contains a `<br>` — `"Ein Tool von Digitales Netzwerk Sammlungen<br>Berlin University
Alliance"` (`config/wording.json`). A presentational shortcut that was harmless against a
build-time constant became a sink the moment the same dictionary gained a remote source.

**Concrete consequence.** Anyone able to write the viewer-settings singleton can inject script that
executes in every other user's browser. The JWT is kept in `localStorage`
(`useAuthStore.js:5`, `viewerEditor.authToken.v1`) and is therefore readable by injected script. In
practice this converts "can edit the viewer configuration" into "can act as any other user of this
Strapi instance", which is a privilege boundary the application otherwise maintains. The payload is
stored, so it fires for every user on every page load until the settings record is cleaned.

A second, lower-severity instance of the same class sits four lines above:
`:href="githubRepoUrl"` (`Identity.vue:14`) is bound without protocol validation, and
`normalizeGithubRepoUrl` (`useAppConfigStore.js:18-20`) only trims. The value can come from the
runtime-loaded `public/app-config/*.json`, so a `javascript:` URL there becomes a click-to-execute
link. This is a much narrower exposure — it needs control of the deployed file or the user's own
`localStorage` — but it has the same shape and the same fix.

**Recommendation.** Two small, independent changes:

1. Remove the `v-html`. Render the credit as text and express the line break structurally — split the
   handle on `\n` and emit one `<span>` per line, or keep a single line and let CSS
   (`white-space: pre-line`) handle it. Change the two `footerIdentityCredit` values in
   `config/wording.json` from `<br>` to `\n` in the same commit.
2. Validate `githubRepo` in `normalizeGithubRepoUrl`: parse with `new URL(...)` and return `''` unless
   the protocol is `http:` or `https:` — the check already exists in
   `connectionProfile.js:3-5` (`isHttpProtocol`) and can be imported rather than rewritten (see
   MAINT-03).

Do **not** reach for a sanitiser library; nothing in this application legitimately needs backend HTML,
and adding one would preserve the sink while making it look safe.

**Expected benefit.** The remote-wording feature stops carrying a script-execution channel, and the
"config is data, never markup" invariant becomes true rather than aspirational.

**Effort:** S — under an hour, including the wording-file edit.

**Risks.** Purely cosmetic: the footer line break must be re-verified at desktop and mobile widths.
If any deployment has already customised `footerIdentityCredit` with HTML in its Strapi settings, that
markup will start showing as literal text; that is the intended outcome but is worth announcing.

**Dependencies.** None. Independent of every other finding.

**Acceptance criterion.** `grep -rn "v-html" src/` returns no result outside `InfoPanel.vue` (whose
source is a build-time bundled `.md` rendered with `html: false` and is not a concern); a wording
override of `footerIdentityCredit` containing `<img src=x onerror=alert(1)>` renders as visible text;
`githubRepo: "javascript:alert(1)"` produces no rendered link.

---

### MAINT-01 — No component test seam, no lint, no type check, no CI

- **Category:** Maintainability / testability · **Priority:** P1 · **Confidence:** High
- **Location:** `package.json:6-17`; `vite.config.js` (no `test` block); repository root (no
  `.github/`, no ESLint/Prettier config, no `tsconfig.json`, no hooks).

**Observed.** The suite is real and passing — 19 files, 183 tests — but every one of them targets
`src/composables/`, `src/stores/`, `src/services/` or `src/fields/`. There is **no test for any
`.vue` file**, and the tooling to write one is not installed: `vite.config.js` declares no `test`
configuration, so vitest runs in its default `node` environment, and `jsdom`, `happy-dom` and
`@vue/test-utils` are absent from `devDependencies`.

Alongside that: no linter (so the unused `onlineHierarchyFields` binding at `App.vue:83` and the dead
`supportedLanguages` computed went unnoticed), no type or JSDoc checking (so the 26-parameter object in
`useDataImportExport` has no checked contract), and no CI — `pnpm test` runs only when someone
remembers.

**Root cause.** The test environment was configured for the layers that were easy to test, and the
component layer was left for later. Because it was never set up, the natural response to "this logic
needs a test" became "extract it to a composable" — which is a good instinct and produced several of
the well-designed modules praised above, but it has a ceiling: logic that is genuinely about
component composition, like `App.vue`'s watchers, has nowhere to go.

**Concrete consequence.** The untested surface is precisely the highest-churn surface. `App.vue`
(67/107 commits), `ListPanel.vue` (11), `UserConfigPanel.vue` (15) and `ItemFieldEditor.vue` (10)
carry no regression protection at all. Every finding in this report that lives in a `.vue` file —
MOD-01, MOD-02's `App.vue` half, MOD-05, MOD-07, DEBT-01 — is currently unfixable *safely*, because
there is no way to demonstrate that a fix preserved behaviour. This is the finding that gates most of
the others.

**Recommendation.** Two steps, smallest first.

1. **Enable component testing.** Add `jsdom` (or `happy-dom`) and `@vue/test-utils` to
   `devDependencies` and a `test: { environment: 'jsdom' }` block to `vite.config.js`. Then write
   tests for the three highest-value behaviours rather than for coverage: `ListPanel`'s caption
   resolution and hierarchy grouping, `ItemFieldEditor`'s registry-driven rendering including the
   candidate-accept path, and — once MOD-01 lands — the extracted online-session sequence.
2. **Add a lint and a check script.** ESLint with `eslint-plugin-vue`'s recommended set plus
   `no-unused-vars` would have caught DEBT-05's dead bindings for free. Add
   `"check": "eslint . && vitest run"` and, if the project ever gains a second contributor, a
   GitHub Actions workflow running it on push.

Type checking is *not* recommended at this stage: converting to TypeScript is a large change with no
demonstrated defect to justify it here, and the parameter-bag contracts that would benefit most
(MOD-05) are better fixed by shrinking them than by typing them.

**Expected benefit.** Unlocks safe execution of MOD-01, MOD-02, MOD-05 and MOD-07. Unused-code and
common-mistake classes get caught before review rather than during it.

**Effort:** M — the environment plus the first three component tests. The dependency addition itself
is minutes; writing tests that assert behaviour rather than markup is the work.

**Risks.** Adding `jsdom` enlarges the dev dependency tree; it does not affect the production bundle.
Component tests written against markup rather than behaviour become their own maintenance burden —
assert on rendered text, emitted events and props passed to children, not on class names or DOM
structure.

**Dependencies.** Prerequisite for MOD-01, MOD-05 and MOD-07.

**Acceptance criterion.** `vite.config.js` declares a jsdom test environment; at least three `*.test.js`
files mount `.vue` components; `npx eslint .` runs and reports zero errors on a configured rule set;
both are runnable through `package.json` scripts.

---

### MOD-03 — The field-type contract leaks outside the registry

- **Category:** Modularity / abstraction · **Priority:** P2 · **Confidence:** High
- **Location:** `src/fields/fieldRegistry.js` (the intended single source); leaks at
  `src/components/ItemFieldEditor.vue:76-79`; `src/stores/useUserConfigStore.js:10-11,59-61`;
  `src/composables/userConfigValidation.js:7-17`; `src/composables/useFieldMapping.js:6,14-16`;
  `src/composables/replacementRules.js:5-6`; `src/App.vue:388-395`;
  `src/services/strapiApi.js:220-223`.

**Observed.** `docs/technical-documentation.md` §8.1 states that `fieldRegistry.js` is *"der
**einzige** Registrierungsort für Feldtypen"*, and §8.4 gives a two-step recipe for adding one: define
the contract functions in the registry, and the type *"steht danach automatisch in der Config-Auswahl
und in der Config-Validierung zur Verfügung"*. That is true for the type *list*, but several
type-adjacent facts live elsewhere:

- **Component resolution.** The registry returns a component *name string* —
  `component: 'ViewerWikidataField'` (`fieldRegistry.js:230`) — resolved by a hard-coded conditional
  in the consumer: `if (componentId === 'ViewerWikidataField') return ViewerWikidataField`
  (`ItemFieldEditor.vue:76-79`). A new type with a custom component requires editing both files, which
  the documented recipe does not mention.
- **Reserved field keys** (`scan`, `suspendEditing`, `__onlineMeta`) — four independent declarations:
  `useUserConfigStore.js:10`, `replacementRules.js:6`, `useFieldMapping.js:85-88`, `App.vue:391-393`.
- **Allowed field widths** (`33%`/`50%`/`100%`) — four declarations:
  `useUserConfigStore.js:11`, `useFieldMapping.js:6`, `userConfigValidation.js:16`,
  `UserConfigPanel.vue:49-53`.
- **Candidate input-type normalisation** — three identical functions:
  `fieldRegistry.js:58`, `useUserConfigStore.js:59`, `userConfigValidation.js:7`.
- **The `wikidata_autosuggest` underscore alias** — accepted by `useFieldMapping.js:14` and
  `strapiApi.js:222`, but not by the registry or the validator (see DEBT-05).

**Root cause.** The registry was correctly scoped to *behaviour* (rendering, defaults, value
normalisation) but never given the *vocabulary* that surrounds it — which keys are reserved, which
widths are legal, which spellings of a type name are accepted. Each consumer needed one of those facts
before a shared home existed, and declared it locally.

**Concrete consequence.** Adding a seventh field type, or a fourth field width, means finding four to
six unrelated files and hoping none was missed — and the documented recipe actively misleads about
this. The failure mode is quiet: a missed reserved-key list means an internal key like `__onlineMeta`
becomes editable in one surface while remaining hidden in the others.

**Recommendation.** Move the vocabulary into `src/fields/fieldRegistry.js` and import it:

- Export `RESERVED_FIELD_KEYS` and a predicate `isReservedFieldKey(key)`; replace all four local lists.
- Export `ALLOWED_FIELD_WIDTHS` and `normalizeFieldWidth(value)`; replace all four.
- Export the existing `normalizeCandidateInputType`; delete the two copies.
- Let the registry entry carry the component *itself* rather than a name string. The registry is
  already imported by `.vue` files, so importing `ViewerWikidataField.vue` there is no new coupling
  direction — it replaces a string indirection that only exists to avoid the import. Then
  `resolveEditorComponent` in `ItemFieldEditor.vue` disappears.
- Update `docs/technical-documentation.md` §8.4 to match whatever the recipe actually becomes.

**Expected benefit.** The documented one-file extension point becomes true. Five categories of
"forgot to update the other list" become impossible.

**Effort:** M — mechanical, but it touches eight files and needs the existing `fieldRegistry.test.js`
and `userConfigValidation.test.js` extended to pin the newly-shared constants.

**Risks.** Low. The one judgement call is the component-in-registry change: verify that importing an
SFC into `fieldRegistry.js` does not pull Vue's runtime into the module graph of the pure tests that
currently import it (`replacementRules.test.js` imports `resolveConfiguredFieldType`). If it does,
keep the component map in a separate `src/fields/fieldComponents.js` that only `ItemFieldEditor`
imports — still one place, still not a string lookup.

**Dependencies.** Shares its root cause with MOD-02 and MOD-04; MAINT-03 covers the generic utilities
that are not field-specific.

**Acceptance criterion.** `grep -rn "'suspendEditing'" src/` and `grep -rn "'33%'" src/` each return
exactly one non-test definition; `ItemFieldEditor.vue` contains no component-name conditional; adding a
new field type requires editing only files under `src/fields/`; §8.4 of the technical documentation
describes the actual steps.

---

### MOD-04 — The autosuggest config schema has four independent interpreters

- **Category:** Modularity / abstraction · **Priority:** P2 · **Confidence:** High
- **Location:**
  - `src/composables/useWikidataSearch.js:25-92` — `PRIORITY_BLOCK_HANDLERS[*].getRequiredProperties`
  - `src/components/WikidataAutosuggestInput.vue:100-125` — `getPropertyIdsForPrioritizeRule`
  - `src/components/ViewerWikidataField.vue:55-70` — `getPropertyIdsForRule` (same function, third name)
  - `src/components/config/AutosuggestFieldConfig.vue:75-140` — `normalizeAlsoGetDataFromDefs` and
    `claimPresenceDefs`
  - `src/components/WikidataAutosuggestInput.vue:179-215` — `normalizeAlsoGetDataFromPropertyDefs`
  - `src/composables/userConfigValidation.js` — validates the same shapes a fifth time

**Observed.** The `autosuggest` config accepts several historical shapes per field: `defs` entries may
be plain strings or objects; the property id may be under `propertyId` or `property`; the label may be
under `label` or `propertyLabel`. Every module that touches this config re-implements the tolerance.
`normalizeAlsoGetDataFromPropertyDefs` (`WikidataAutosuggestInput.vue:179-215`) and
`normalizeAlsoGetDataFromDefs` (`AutosuggestFieldConfig.vue:75-110`) are byte-for-byte identical apart
from the function name.

The documentation describes this config as an opaque pass-through
(`docs/technical-documentation.md` §8.2: *"Der Wrapper reicht `field.autosuggest` unverändert an
`WikidataAutosuggestInput.vue` weiter; die Viewer-Core-Logik interpretiert keine autosuggest-Schlüssel"*).
That is accurate about the *core* — `useViewerData`, `fieldRegistry` and the stores really do treat it
as opaque, which is a good decision. It is not accurate about the four modules above, each of which
knows the schema in detail.

**Root cause.** The pass-through boundary was drawn correctly at the core but no schema module was
created on the far side of it. Each Wikidata-related module then became its own schema authority: the
GUI editor writes a shape, the input component reads it, the search composable reads it again, and the
validator checks a fourth interpretation of it.

**Concrete consequence.** Supporting a new `defs` spelling, or dropping a legacy one, requires four
coordinated edits with no compiler or test to catch a miss. The realistic failure is asymmetric drift:
the GUI editor (`AutosuggestFieldConfig.vue`) writes `{ propertyId, propertyLabel }` for
`claimPresence` and `{ propertyId, label }` for `alsoGetDataFrom` — a distinction that exists only
because two of the four readers happened to be written with different key names. A maintainer
normalising that in the editor without also updating `useWikidataSearch.js` and both components would
silently break prioritisation, and no test would fail.

**Recommendation.** Add `src/fields/autosuggestSchema.js` exporting the normalisers the four consumers
need — `normalizePropertyDefs(defs)`, `normalizeAlsoGetDataFrom(value)`,
`getPropertyIdsFromDefs(defs)`, `getPropertyLabelFromDef(def)` — as pure functions with a test that
pins every legacy shape listed in `docs/conventions.md`. Have all four modules import them; delete the
local copies. Keep the *core* pass-through exactly as it is — this consolidates the readers, it does
not move interpretation into the core.

**Expected benefit.** One schema definition, pinned by tests; the GUI editor and the runtime readers
provably agree; adding or retiring a legacy shape is a one-file change.

**Effort:** M — the extraction is small; enumerating the accepted shapes from four implementations and
agreeing the union is the work.

**Risks.** Low, provided the extracted functions start as the *union* of current behaviour. Resist
tightening the accepted shapes in the same change — any live Strapi settings using a legacy form would
break silently.

**Dependencies.** Same root cause as MOD-02 and MOD-03; independent to implement.

**Acceptance criterion.** `grep -rn "propertyLabel" src/` shows the fallback chain defined in exactly
one module; `useWikidataSearch.js`, `WikidataAutosuggestInput.vue`, `ViewerWikidataField.vue` and
`AutosuggestFieldConfig.vue` all import it; the existing `useWikidataSearch.test.js` object-defs test
still passes unchanged.

---

### MOD-05 — Parameter-bag composables and prop-bag components

- **Category:** Modularity / interfaces · **Priority:** P2 · **Confidence:** High
- **Location:** `src/composables/useDataImportExport.js:3-29` (26-key destructure);
  `src/App.vue:706-737` (the matching 26-key call site);
  `src/components/ListPanel.vue:4-115` (33 props);
  `src/App.vue:1175-1205` and `src/App.vue:1211-1239` (two `ListPanel` instantiations).

**Observed.** `useDataImportExport` takes a single object with 26 keys — refs, computed values,
mutators and callbacks drawn from four different owners — and `App.vue` supplies all 26 at the call
site. The composable does not encapsulate the data flow; it relocates a block of `App.vue` and
receives the surrounding scope as an argument list.

`ListPanel.vue` declares 33 props, of which roughly 14 are pre-resolved `t(...)` strings and two are
*functions* (`looksLikeImageUrl`, `hasListImageFailed`) passed down from the parent. It is then
instantiated twice, distinguished only by `render-header` / `render-body` — once for the sticky header
region (`App.vue:1175`) and once for the list body (`App.vue:1211`) — with the prop list largely
duplicated between them.

The duplication has already drifted: the header instance is given all eight hierarchy props
(`hierarchy-fields`, `hierarchy-level1-options`, `selected-hierarchy-level1`,
`has-selected-hierarchy-level1`, `expanded-hierarchy-level2-values`, and three labels) but binds none
of the corresponding handlers, while the hierarchy UI renders only under `v-if="props.renderBody"`
(`ListPanel.vue:357`). Those eight props are dead on that instance.

**Root cause.** Both shapes come from the same move: code was relocated without relocating its
dependencies. `useDataImportExport` was extracted from `App.vue` and given its closure as parameters;
`ListPanel` was split into head and body regions by a flag rather than into two components, because the
sticky-header layout needed the head rendered outside the scrolling panel.

**Concrete consequence.** Adding one data-flow dependency to the import/export path means editing the
destructure *and* the call site in lockstep, with no checked contract between them — a mismatch fails
at runtime as `undefined is not a function`, not at build time. Adding one prop to `ListPanel` means
editing two instantiations, and the eight already-dead hierarchy props are the evidence that this is
missed in practice. Passing `looksLikeImageUrl` as a prop also means `ListPanel` cannot be rendered in
a test without the parent's helpers — which is part of why it has no test.

**Recommendation.** Two separate, independently valuable changes:

1. **`ListPanel`:** split into `ListPanelHeader.vue` and `ListPanelBody.vue`, each taking only the
   props it uses, and delete the `renderHeader`/`renderBody` flags. Move the two function props to
   direct imports — `looksLikeImageUrl` is a pure helper in `useViewerData.js:179-182` and can simply
   be imported; `hasListImageFailed` is per-item UI state that belongs to the body component. Where a
   component needs many labels, call `t()` inside it (as `DataTransferControls`, `OnlineAccessPanel`
   and `ReplacementsUnit` already do) rather than threading 14 strings through the parent.
2. **`useDataImportExport`:** rather than a generic refactor, reduce the bag by letting the composable
   import the stores it needs directly — `useDataTransferStore` (`createEditedFileName`,
   `appendEditedTimestamp`, `setModeErrorMessage`, `dataMode`), `useUserConfigStore`
   (`clearUserConfigSession`, `applyImportedConfigPayload`, `applyUserConfigToRawItems`,
   `createUserConfigPayload`, `hasUnappliedUserConfigChanges`), `useReplacementsStore`
   (`createReplacementsPayload`, `resetReplacements`) and `useAppConfigStore` (`t`). That removes 12
   of the 26 keys without inventing a new abstraction, leaving only the genuinely
   `useViewerData`-instance-bound values — which must stay injected, because `useViewerData` is a
   factory rather than a module singleton.

**Expected benefit.** Two focused components that can each be mounted in a test; the header/body prop
drift becomes structurally impossible; the import/export contract halves.

**Effort:** M — the `ListPanel` split is the larger half and needs MAINT-01's test environment to be
verified rather than eyeballed.

**Risks.** The sticky-header layout depends on the head being rendered outside the scrolling panel and
measured by the `ResizeObserver` (`App.vue:761-770`, `docs/technical-documentation.md` §14). Splitting
the component must preserve the DOM structure the CSS and the observer expect — do the split with no
markup changes at all, then verify the sticky offsets at both the desktop and the `max-width: 768px`
breakpoint.

**Dependencies.** Needs MAINT-01. Interacts with MOD-01 (the header instance's props come from
`App.vue`).

**Acceptance criterion.** No component in `src/components/` declares a prop of `type: Function`;
`ListPanel` no longer exists as a dual-mode component; the hierarchy props appear in exactly one
instantiation; `useDataImportExport` takes fewer than 15 injected keys.

---

### MOD-06 — Two opposite dependency conventions in the Strapi layer

- **Category:** Modularity / hidden dependencies · **Priority:** P2 · **Confidence:** High
- **Location:** `src/stores/useOnlineItemsStore.js:144-146,240-242`;
  `src/stores/useOnlineSettingsStore.js:28-29,67-68,101-102`;
  `src/stores/useOnlineUpdatesStore.js:228-231`;
  contrast with `src/composables/useReplacementsApply.js:15-27`.

**Observed.** The online stores acquire their dependencies two different ways. Some are declared:
`fetchOnlineItems({ settings })`, `saveOnlineUpdates({ profile, token })`. Others are reached for
inside the function body:

```js
async function fetchOnlineItems({ settings }) {
  const { connectionProfile } = useConnectionProfileStore()
  const { token } = useAuthStore()
  ...
```

and `saveOnlineUpdates` — whose signature already declares `profile` and `token` — additionally reaches
into a third store for field configs:

```js
async function saveOnlineUpdates({ profile, token = '' }) {
  const { settings } = useOnlineSettingsStore()
```

`useReplacementsApply` does the opposite and injects all eleven of its dependencies explicitly
(`useReplacementsApply.js:15-27`), which is why it has the most readable test in the suite.

**Root cause.** Module-global stores make the reach-in *possible* at zero syntactic cost, and no
convention was written down, so each function chose per-call-site. The result is that a signature no
longer tells you what a function needs.

**Concrete consequence.** `fetchOnlineItems({ settings })` looks pure in its inputs and is not: it
silently requires a saved connection profile and an auth token from two other module-global stores.
The cost is visible in the tests — `useOnlineItemsStore.test.js:21-36` must build a `localStorage`
mock, save a profile into `useConnectionProfileStore`, and then assign
`authStore.token.value = 'token-1'` directly, reaching past the store's own public API because there
is no other way to inject a token. Every online-store test file repeats that setup, and six test files
each carry their own copy of `createLocalStorageMock` (see MAINT-03). Test-order leakage is a live
concern the codebase is already aware of: `useAppConfigStore.test.js:136-141` carries an `afterEach`
comment explaining that module-global state must be manually reset so a loaded default config
*"nicht in andere Tests leckt"*.

**Recommendation.** Do not replace the store pattern — it is adequate for an application of this size
and a state library would be a larger change than the problem warrants. Instead, write the convention
down and apply it to the network layer only: **every function that performs I/O takes `profile` and
`token` as explicit parameters.** Concretely, add them to the signatures of `fetchOnlineItems`,
`fetchOnlineItemsForHierarchyLevel1`, `fetchOnlineSettings`, `persistOnlineSettings` and
`persistOnlineReplacements`, and pass `fieldConfigs` into `saveOnlineUpdates` rather than reaching for
`useOnlineSettingsStore` inside it. `App.vue` already holds `connectionProfile` and `token` and passes
them to `saveOnlineUpdates`, so most call sites change by one argument. Record the rule in
`docs/conventions.md`.

**Expected benefit.** Signatures become honest; each online store can be tested with two literal
arguments instead of three primed module globals; the shared test scaffolding largely disappears.

**Effort:** M — five signatures plus their call sites and six test files.

**Risks.** Low and mechanical, but touching every online entry point at once is a wide diff. Do it as
one commit per store so a regression is bisectable.

**Dependencies.** Makes MOD-01's `useOnlineSession` extraction substantially easier; do this first.

**Acceptance criterion.** No function in `src/stores/useOnline*.js` calls `useConnectionProfileStore()`,
`useAuthStore()` or `useOnlineSettingsStore()` inside its body; no test file assigns
`authStore.token.value` directly; `docs/conventions.md` states the rule.

---

### MAINT-02 — Error messages bypass the wording system, in two languages

- **Category:** Maintainability / consistency · **Priority:** P2 · **Confidence:** High
- **Location:** German literals at `src/composables/useViewerData.js:46,54,57,62,...` and
  `src/composables/userConfigValidation.js:20-90+` (every branch). English literals at
  `src/stores/useOnlineItemsStore.js:149,155,240,246`; `src/stores/useOnlineSettingsStore.js:32,60,93,124`;
  `src/stores/useOnlineUpdatesStore.js:270,283,297,313`; `src/stores/useAuthStore.js:37,68,73,107,124`.
  Display points: `src/components/OnlineAccessPanel.vue:186-205`; `src/App.vue:1310-1315`.

**Observed.** The application has a complete two-language wording system — 251 handles in
`config/wording.json`, a `t(key, fallback)` resolver with a documented fallback chain, and optional
backend overrides. Runtime error messages do not use it. Instead:

- The data layer produces **German** literals: `'JSON ist ungueltig (Parse-Fehler).'`,
  `'CSV enthaelt leere Spaltennamen.'`, and every branch of `userConfigValidation.js`
  (`'JSON-Config ist ungueltig: config.fields muss ein Objekt sein.'`).
- The store layer produces **English** literals: `'Could not load online items.'`,
  `'No saved connection profile found.'`, `` `${failed.length} update(s) failed. ${failed[0].error}` ``.

These meet in one place. `App.vue:1073-1076` routes a failed config validation into
`markOnlineSettingsInvalid(applyResult.error)`, which writes it to `lastSettingsError` — rendered by
`OnlineAccessPanel.vue:203-205` in the same status region as `lastItemsError` and `lastAuthError`. A
single status area can therefore display a German validation message directly above an English fetch
message, in either UI language.

The documentation asserts the opposite for one of these areas — `docs/technical-documentation.md`
§12.8: *"alle Texte der Save-UX liegen als Wording-Handles vor"* — while
`useOnlineUpdatesStore.js:313` builds the save error by string concatenation in English.

A related constraint: `t()` has no parameter interpolation, so any message carrying a value is
assembled by concatenation at the call site — `` `${t('startFromScratchScanInvalidRow', 'Ungueltige URL in Zeile')} ${invalidEntry.rowNumber}: ${invalidEntry.url}` ``
(`useDataImportExport.js:126`). `UserConfigPanel.vue:87-90` shows the sharper form of the problem: the
fallback string interpolates `${fieldKey}`, but the translated handle cannot, so as soon as the handle
exists the field name is lost from the message.

**Root cause.** The wording system was built for UI chrome — labels, buttons, tabs — and error strings
were written where they were thrown, in whatever language the author was working in at the time. No
rule was established for which layer owns user-facing text.

**Concrete consequence.** A user running the app in English sees German validation errors for any
malformed JSON config or Strapi settings payload, which is the exact situation in which a clear message
matters most. Translating the app to a third language is currently impossible without first finding and
rerouting every literal. And because the two languages correlate with two layers, the inconsistency
reads as arbitrary rather than as a known gap.

**Recommendation.** Establish the boundary rather than translating every string at once:

1. **Rule:** modules below the component layer return *stable, machine-readable* error codes plus a
   developer-facing English detail; components map codes to wording handles for display. Record this in
   `docs/conventions.md`.
2. **Apply it where it is visible first** — the validator. `validateImportedConfigPayload` already
   returns `{ ok: false, error }`; extend it to `{ ok: false, code, detail, params }` and add handles
   for each code. This is the highest-value target because its messages surface in the online flow.
3. **Add interpolation to `t()`** — `t(key, fallback, params)` doing a simple `{name}` replacement is
   about ten lines and removes the concatenation constraint for all future messages.
4. Correct the §12.8 documentation claim, or make it true.

Migrating the remaining store-layer English strings can follow incrementally; they are at least
internally consistent.

**Expected benefit.** One language per UI language; translatable messages; error text that can be
changed without touching data-layer modules.

**Effort:** M for steps 1–3 (the validator has ~25 branches and a 396-line test file that pins the
current messages and will need updating); incremental thereafter.

**Risks.** `userConfigValidation.test.js` asserts on message content in places; changing the return
shape touches it broadly. Keep `error` as a deprecated alias alongside the new `code` for one release
so nothing that reads it breaks silently.

**Dependencies.** None, though doing it after MOD-06 means fewer call sites move twice.

**Acceptance criterion.** No German string literal remains in `src/composables/` or `src/stores/`;
`t()` supports `{param}` interpolation with a test; switching the UI to EN shows an English message for
a malformed JSON import; §12.8 of the technical documentation matches the code.

---

### MAINT-03 — No shared utility kernel; a business rule is copied three times

- **Category:** Maintainability / duplication · **Priority:** P2 · **Confidence:** High
- **Location:** `isPlainObject` — 10 definitions (`useAppConfigStore.js:258`,
  `useUserConfigStore.js:31`, `useViewerData.js:13`, `replacementRules.js:8`,
  `userConfigValidation.js:3`, `strapiApi.js:5`, `wikidataAutosuggestField.js:1`,
  `ViewerWikidataField.vue:21`, `WikidataAutosuggestInput.vue:48`, `AutosuggestFieldConfig.vue:33`).
  Deep clone — 5 (`useViewerData.js:17`, `useUserConfigStore.js:35`, `useOnlineUpdatesStore.js:24`,
  `useReplacementsStore.js:13`, `AutosuggestFieldConfig.vue:37`).
  `getLocalStorageSafe` — 4 (`useAppConfigStore.js:67`, `useAuthStore.js:12`,
  `useConnectionProfileStore.js:16`, `useOnlineModeStore.js:22`).
  **`hasNonEmptyValue` — 3** (`useViewerData.js:540`, `ListPanel.vue:217`,
  `strapiApi.js:741` as `hasNonEmptyOnlineFieldValue`).
  `splitCsvLine` — 2 (`useViewerData.js:98`, `useDataImportExport.js:61`).
  Browser download — 3 (`useDataImportExport.js:235`, `DatabaseConnectionPanel.vue:125`,
  `DatabaseConnectionPanel.vue:184`).
  `createLocalStorageMock` — 6 copies across test files.
  `normalizeConnectionMode` — 2 (`useAppConfigStore.js:26`, `useOnlineModeStore.js:8`).

**Observed.** There is no `src/utils/` or equivalent. Roughly a dozen small helpers are redefined
wherever needed. Most of these are harmless — `isPlainObject` is four lines and will not drift
meaningfully. Three of them are not harmless:

- **`hasNonEmptyValue` is a business rule, not a utility.** The same five-line function decides three
  different things in three layers: whether an item counts as *edited* for sorting
  (`useViewerData.js:263`), whether an item shows an edit icon instead of a suspend checkbox
  (`ListPanel.vue:226-229`), and **which fields are included in a `POST` to Strapi**
  (`strapiApi.js:749-758`). `docs/technical-documentation.md` §7.2 documents the semantics once
  (`''`, `null`, `undefined`, `[]`, `{}` are empty; `false` and `0` are values) as though there were
  one definition. A change to the rule in one copy would desynchronise list sorting from what is
  actually persisted, with no test relating the three.
- **`splitCsvLine` is a parser.** `useViewerData.js:98-124` is tested via `__test.splitCsvLine`;
  the identical copy in `useDataImportExport.js:61-88`, used by the start-from-scratch CSV path, is
  not. A quoting fix applied to the tested copy leaves the untested one behind.
- **`triggerBrowserDownload`** exists as a named helper in `useDataImportExport.js:235-245` and twice
  more inline in `DatabaseConnectionPanel.vue`. `docs/technical-documentation.md` §10 calls it *"die
  zentrale Helper-Funktion"*, which is true of one of three call sites.

**Root cause.** No shared module was established early, so the marginal cost of copying four lines was
always lower than the cost of creating one — and the habit then extended to helpers where copying is
genuinely risky.

**Concrete consequence.** For the trivial helpers, the cost is only noise. For `hasNonEmptyValue` the
cost is a silent divergence between what the list shows and what gets saved. For `splitCsvLine` it is a
parser fix that applies to one of two import paths.

**Recommendation.** Two moves, deliberately different in kind:

1. **Add `src/utils/` for the genuinely generic helpers** — `isPlainObject`, `clonePlainValue`,
   `getLocalStorageSafe` (extended with a `getSessionStorageSafe` sibling, see MAINT-04),
   `triggerBrowserDownload`. Import them everywhere; delete the copies. Add
   `createStorageMock` to a `src/test-utils.js` and use it in the six test files.
2. **Promote the two non-generic ones to their owning modules.** Export `hasNonEmptyValue` from
   `src/fields/fieldRegistry.js` — it is a statement about field values and belongs with the field
   contract (MOD-03) — and have `useViewerData`, `ListPanel` and `strapiApi` import it. Export
   `splitCsvLine` from `useViewerData.js` (it is already exposed on `__test`; make it a real export)
   and have `useDataImportExport` import it.

Step 2 is the one that matters; step 1 is cleanup that can ride along.

**Expected benefit.** The "edited" rule and the CSV quoting rule each have one definition and one test.
About 25 redundant function definitions disappear.

**Effort:** S — mechanical, and each replacement is independently verifiable by the existing suite.

**Risks.** Very low. The only subtlety is that `useViewerData.js`'s `hasNonEmptyValue` and
`strapiApi.js`'s `hasNonEmptyOnlineFieldValue` are currently identical — confirm that before merging
them, since a future divergence between "counts as edited" and "worth persisting" would be a legitimate
design choice rather than a bug.

**Dependencies.** Step 2's first half belongs with MOD-03.

**Acceptance criterion.** `grep -rn "function isPlainObject" src/` returns one result;
`grep -rn "function hasNonEmptyValue" src/` returns one result; `splitCsvLine` is defined once;
`DatabaseConnectionPanel.vue` contains no `URL.createObjectURL` call; the suite stays green.

---

### MAINT-05 — Documentation drift on deployment-critical facts

- **Category:** Maintainability / documentation · **Priority:** P2 · **Confidence:** High
- **Location:** `README.md:56` and `docs/technical-documentation.md:68` vs `vite.config.js:7`;
  `docs/technical-documentation.md:310` vs `src/stores/useConnectionProfileStore.js:357-361` and
  `src/App.vue:820-826`; `docs/technical-documentation.md:99` (wording count);
  `docs/technical-documentation.md:1050` (test count); §10 and §12.8 as noted in MAINT-03/MAINT-02.

**Observed.** The documentation is detailed and mostly correct, which makes the incorrect parts
costlier — a reader has no reason to doubt it. Confirmed divergences:

| Claim | Documented | Actual |
| --- | --- | --- |
| Vite `base` / deploy path | `/viewer-editor-strapi/` (README + tech doc) | `/viewer-hu-pre-and-early-history/` (`vite.config.js:7`) |
| Connection profile restore | *"beim App-Start; wird bei gesetztem `defaultConnectionProfile` ggf. durch das geladene Default-Profil überschrieben"* (§5) | `loadConnectionProfileFromStorage` is **never called** when `defaultConnectionProfile` is set — which it is in the shipped `config/app.config.js` (see DEBT-04) |
| `config/wording.json` | 238 handles (§3) | 251 handles |
| Test suite | 19 files, 176 tests (§16) | 19 files, **183** tests |
| `triggerBrowserDownload` | *"die zentrale Helper-Funktion"* (§10) | one of three implementations (MAINT-03) |
| Save-UX texts | *"alle Texte ... liegen als Wording-Handles vor"* (§12.8) | error strings are English literals (MAINT-02) |
| Field-type extension | two steps, registry only (§8.4) | also requires `ItemFieldEditor.vue` (MOD-03) |

The base-path entry is the one with teeth. The technical documentation even adds detail —
*"früher genutzte Pfade stehen dort auskommentiert"* — which is true (`vite.config.js:4-5` holds two
commented-out values) and makes the stated active value look verified. It is not: the active `base` is
a third value that appears in neither document.

**Root cause.** The documents carry an explicit verification stamp —
*"verifiziert am 2026-09-03 gegen Commit `256758f`"* — and five commits have landed since, three of
them (`3ba37d3`, `9f9ae8e`, `54f233a`) feature-bearing. The stamp is good practice; what is missing is
anything that fails when the stamp goes stale.

**Concrete consequence.** A deployer following either document configures the wrong subpath, and every
asset URL 404s in production with no build-time warning. The connection-profile entry sends anyone
debugging DEBT-04 looking in the wrong place: it describes a `localStorage` restore that does not
happen. The remaining entries cost a maintainer a few minutes each and, cumulatively, some trust in a
document that deserves it.

**Recommendation.** Correct the seven entries. Then reduce the chance of recurrence cheaply:

- Stop stating the `base` value in prose. Both documents should point at `vite.config.js` as the source
  of truth for the deploy path — it is a one-line file and needs no mirror.
- Derive the two counts rather than writing them: a short `pnpm run docs:check` that asserts the wording
  handle count and test count match what §3 and §16 state would fail loudly on drift. Alternatively,
  drop the exact numbers — they carry little information and guarantee drift.
- Move the verification stamp to the top of a short "verified against" table listing the specific
  claims that were checked, so the next reviewer knows what the stamp covers.

**Expected benefit.** The deployment path is correct in the one place that matters; the documentation's
accuracy stops depending on manual synchronisation for the facts most likely to move.

**Effort:** S — corrections are an hour; the optional check script another hour.

**Risks.** None to the application.

**Dependencies.** The §10, §12.8 and §8.4 entries should be corrected as part of MAINT-03, MAINT-02 and
MOD-03 respectively, so the documentation and the code change together.

**Acceptance criterion.** Neither `README.md` nor `docs/technical-documentation.md` states a literal
base path; the connection-profile row of the §5 table describes the actual startup behaviour; the
wording and test counts are either accurate or removed.

---

### DEBT-02 — Unbounded request loop when Strapi answers 200 with a non-JSON body

- **Category:** Technical debt / reliability · **Priority:** P2 · **Confidence:** High (**verified by execution**)
- **Location:** `src/services/strapiApi.js:405-440` (`fetchAllCollectionItemsFromStrapi`);
  `src/services/strapiApi.js:498-527` (`checkDataModelImplementationInStrapi`);
  root cause at `src/services/strapiApi.js:9-14` and `:43-52`.

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

The loop is correct for the case it was written for: Strapi rejects an `invalid key <name>` that is a
current `populate` key, the key is dropped, the list shrinks, and the loop terminates. But
`strapiFetchJson` can *succeed* and return a falsy value. `parseJsonResponseSafe`
(`strapiApi.js:9-14`) returns `null` when `response.json()` throws, and `strapiFetchJson` returns that
`null` unchanged whenever `response.ok` is true (`strapiApi.js:51`). A 200 response with a body that is
not JSON therefore leaves `payload` null, re-enters the loop, and re-issues the identical request.

**Verification.** Reproduced with a temporary vitest file (created, run, deleted; worktree verified
clean). A `fetch` stub returning `{ ok: true, status: 200, json: () => { throw new SyntaxError(...) } }`
caused `fetchAllCollectionItemsFromStrapi` to issue identical requests until the stub itself aborted
the run at **51 calls**. Without the guard the loop does not terminate.

**Root cause.** A compatibility workaround was expressed as an open loop with an implicit termination
argument ("the populate list shrinks"), and that argument silently assumes every successful response
yields a payload. The two attempt counters that would make the argument explicit — a retry cap, and a
distinction between "no payload" and "payload is null" — were never introduced. The same block was then
copy-pasted into the data-model check, so the defect exists twice.

**Concrete consequence.** Plausible triggers, all outside the app's control: a reverse proxy or WAF
returning an HTML interstitial with status 200; a captive portal on the client network; a
misconfigured gateway. The result is a browser tab issuing requests in a tight `await` loop against the
Strapi instance until the user closes it — no error, no timeout, no upper bound, and for a long-running
session an effective client-side flood of the server. This affects the two highest-traffic paths:
every online item load and the Settings tab's data-model check.

**Recommendation.** Three lines, applied in both places:

1. Treat a successful-but-empty response as an error rather than a retry signal: in `strapiFetchJson`,
   if `response.ok` and `payload === null`, throw a `createHttpError('Response body is not valid JSON.', response.status, null)`.
   This is the correct fix — every caller of `strapiFetchJson` expects JSON, and a null payload is
   already a failure everywhere else.
2. Bound the retry loops anyway: `for (let attempt = 0; attempt <= effectivePopulateFields.length; attempt += 1)`,
   throwing after the last attempt. The natural bound is the number of populate keys, since each
   iteration removes at most one.
3. Extract the shared retry into one helper — the block is currently duplicated between
   `fetchAllCollectionItemsFromStrapi` and `checkDataModelImplementationInStrapi` — so the next fix
   lands once.

**Expected benefit.** A malformed gateway response produces one clear error instead of an unbounded
request loop; the compat workaround gets an explicit, provable bound.

**Effort:** S — well under a day including a test that pins the 200/non-JSON case and one that pins the
existing `invalid key` retry.

**Risks.** Step 1 changes behaviour for any endpoint that legitimately returns 200 with an empty body.
No call site in this codebase does — all six consumers read `payload.data` or `payload.jwt` — but
confirm against the deployed Strapi version before shipping.

**Dependencies.** None.

**Acceptance criterion.** A test stubs `fetch` to return 200 with a non-JSON body and asserts that
`fetchAllCollectionItemsFromStrapi` rejects after a bounded number of calls; the existing
`strapiApi.test.js` retry tests still pass; the retry block appears once in the module.

---

### DEBT-03 — Clearing saved app settings leaves the UI claiming they are still active

- **Category:** Technical debt / correctness · **Priority:** P2 · **Confidence:** High (**verified by execution**)
- **Location:** `src/stores/useAppConfigStore.js:94-103` (`applyEditableConfigSnapshot`),
  `:205-211` (`clearEditableAppConfig`), `:316` (`hasSavedEditableAppConfig`);
  UI consequence at `src/components/DatabaseConnectionPanel.vue:400-446`.

**Observed.** `hasSavedEditableAppConfig` is derived from the presence of a timestamp:

```js
hasSavedEditableAppConfig: computed(() => Boolean(editableConfig.value.updatedAt)),
```

`clearEditableAppConfig` removes the `localStorage` entry and re-applies the base layer, but
`applyEditableConfigSnapshot` preserves the previous timestamp when the incoming snapshot has none:

```js
updatedAt: String(input.updatedAt || editableConfig.value.updatedAt || '').trim(),
```

`baseConfig.value` is produced by `normalizeAppConfigInput`, which returns only the seven editable keys
and never an `updatedAt`. The stale timestamp therefore survives the clear.

**Verification.** Reproduced with a temporary vitest file (created, run, deleted; worktree verified
clean):

```
PROBE primaryColor after clear = #1f7a8c                      <- correct, base layer restored
PROBE updatedAt   after clear  = "2026-09-15T12:58:22.059Z"   <- stale, from the save
PROBE hasSaved    after clear  = true                         <- wrong
```

The `localStorage` entry is genuinely removed and the values genuinely fall back to the build base —
the reset *works*. Only the reporting is wrong.

**Root cause.** `updatedAt` serves two purposes that diverge on this path: it is a display value ("last
saved at") and it is the persistence flag. `applyEditableConfigSnapshot` preserves it deliberately so
that re-applying a snapshot does not blank the display; that preservation is correct for every caller
except the one whose entire purpose is to signal "there is no saved snapshot any more". The existing
test at `useAppConfigStore.test.js:166-168` asserts `hasSavedEditableAppConfig === false`, but only on a
path where nothing was ever saved, so the stale-timestamp case is untested.

**Concrete consequence.** After a user clicks *"Clear saved app settings"* in the Settings tab,
`DatabaseConnectionPanel.vue:434-446` still renders *"Locally saved app settings are active and take
precedence over the base. Use 'Clear saved app settings' to fall back to the base."* together with
*"Last saved: 2026-09-15T12:58:22.059Z"*, and both the *Download* and *Clear* buttons
(`:405`, `:419`) remain enabled. The panel tells the user the exact opposite of what happened. The
rational response is to click Clear again, see no change, and conclude the reset is broken — in a
settings screen whose whole purpose is to establish which configuration layer is in force. The state
does correct itself on the next page load, which makes the report intermittent and harder to trust.

**Recommendation.** Separate the flag from the display value. Two options, in order of preference:

1. Track persistence explicitly: replace the derived flag with
   `hasSavedEditableAppConfig: computed(() => hasSavedAppConfigInStorage())` — the function already
   exists at `useAppConfigStore.js:121-125` and reads `localStorage` directly, which is the actual
   question being asked. Make it reactive by backing it with a ref that `saveEditableAppConfig` and
   `clearEditableAppConfig` set.
2. Or, minimally: have `clearEditableAppConfig` reset the timestamp explicitly —
   `applyEditableConfigSnapshot({ ...baseConfig.value, updatedAt: '' })`.

Option 1 is preferable because it makes the flag mean what its name says rather than depending on an
invariant about a display field.

**Expected benefit.** The Settings tab reports the active configuration layer correctly, which is the
one thing it exists to do.

**Effort:** S — a two-line fix plus the regression test that should have existed.

**Risks.** None beyond the fix itself. Note that `editableAppConfig.updatedAt` is also rendered
directly at `DatabaseConnectionPanel.vue:444`; under option 1 it must be blanked on clear as well, or
the "Last saved" line will persist on its own.

**Dependencies.** None. Related to MAINT-06 (the same key set, declared three times).

**Acceptance criterion.** A test performs `saveEditableAppConfig(...)` then `clearEditableAppConfig()`
and asserts `hasSavedEditableAppConfig.value === false` and `editableAppConfig.value.updatedAt === ''`;
after clearing in the Settings tab, the "locally saved ... take precedence" note and the "Last saved"
line disappear and the Clear button becomes disabled.

---

### DEBT-04 — A failed default-profile fetch discards a valid stored connection profile

- **Category:** Technical debt / reliability · **Priority:** P2 · **Confidence:** High
- **Location:** `src/stores/useConnectionProfileStore.js:207-284` (`loadConnectionProfileFromDefault`),
  specifically the three failure branches at `:215`, `:243` and `:261`; call site at
  `src/App.vue:820-826`; contrast with `src/stores/useAppConfigStore.js:129-190`.

**Observed.** `loadConnectionProfileFromDefault` falls back to `localStorage` in exactly one case —
when no default filename is configured at all (`:209-211`). In every failure case after that, it sets
the in-memory profile to `null`:

```js
const fetched = await fetchFirstAvailableConfigText(profileUrls)
if (!fetched.ok) {
  ...
  connectionProfile.value = null      // a valid stored profile is discarded
```

The same assignment appears in the invalid-JSON branch (`:243`) and the invalid-profile branch
(`:261`). `loadConnectionProfileFromStorage` — which exists, validates correctly, and is exported — is
never reached on any of these paths. Since `config/app.config.js:11` ships with
`defaultConnectionProfile: 'viewer-editor-connection-profile.v1.json'`, and `App.vue:824` calls only
`loadConnectionProfileFromDefault`, **the stored profile is not read at startup in the shipped
configuration at all.**

Its sibling loader, written for the same pattern against the same `publicConfigUrls` helper, does the
opposite and says so in a comment (`useAppConfigStore.js:126-129`): *"Schlaegt das Laden fehl, bleibt
`config/app.config.js` die Basis - die App startet also immer."*

**Root cause.** The two runtime-config loaders were written at different times with different
precedence models — the app config treats the remote file as a *base layer* beneath `localStorage`,
the connection profile treats it as an *override* above it. Both models are defensible; what is not
defensible is that only one of them has a defined behaviour when the fetch fails. The connection
profile's failure path was never specified, so it defaults to "no profile".

**Concrete consequence.** Whenever `public/connection-profile/*.json` is unreachable — a partial
deploy, a CDN hiccup, an offline-first reload, a 404 from a wrong `base` path (which MAINT-05 shows is
easy to hit) — the app starts with `connectionProfile === null`. Every online feature is then
unavailable: `fetchOnlineSettings` returns `'No saved connection profile found.'`
(`useOnlineSettingsStore.js:32`), the Settings tab's form renders empty because `buildDraftProfile`
returns blanks (`useConnectionProfileStore.js:110-119`), and `restoreSession` clears the session with
*"Session could not be restored because no connection profile is configured."*
(`useAuthStore.js:120-124`) — which discards a valid JWT. The user's saved profile is still in
`localStorage` and still valid; the application simply refuses to use it, and presents an empty
configuration form that invites re-entry.

Note that overwriting `localStorage` on *success* (`:279-282`) is documented and deliberate
(§12.1) — appropriate for a centrally-managed deployment. This finding concerns only the failure path,
which is neither documented nor deliberate.

**Recommendation.** Give the failure path the behaviour its sibling already has. In each of the three
failure branches, replace `connectionProfile.value = null` with a call to
`loadConnectionProfileFromStorage()`, keeping `lastConnectionProfileLoadError` populated so that
`OnlineAccessPanel`'s diagnostic (`OnlineAccessPanel.vue:31-45`) still reports why the default was not
used. Then document both loaders' precedence and failure behaviour side by side in §4.4 and §12.1, and
correct the §5 table row (see MAINT-05).

**Expected benefit.** A transient failure to fetch a bundled file no longer takes a correctly
configured user offline, and no longer presents an empty form that invites overwriting a working
profile.

**Effort:** S — three one-line changes plus a test per branch.

**Risks.** Behaviour change for managed deployments: a user who has saved a profile pointing at a
different Strapi instance will keep using it when the default file is temporarily unreachable, rather
than being cut off. That is the intended improvement, but it is worth stating explicitly if the current
behaviour was ever relied on to force a central profile.

**Dependencies.** None. Related to MAINT-05 (the §5 documentation row describes behaviour that does
not exist).

**Acceptance criterion.** With a saved profile in `localStorage` and a `fetch` stub that fails, the
store retains the stored profile and `lastConnectionProfileLoadError` is populated; the same holds for
an invalid-JSON and an invalid-profile response; §4.4 and §12.1 describe both loaders' failure
behaviour.

---

### MOD-07 — Dataset-specific assumptions embedded in generic components

- **Category:** Modularity / abstraction · **Priority:** P3 · **Confidence:** High
- **Location:** `src/components/ListPanel.vue:203-216` (`resolveItemCaption`);
  `src/components/WikidataAutosuggestInput.vue` (`deriveGeoNamesValues`, keyed on `P1566`).

**Observed.** `ListPanel.vue` is a generic list/card renderer parameterised by `itemCaptionFieldKey`.
Its caption resolution nonetheless hard-codes a field name from this particular collection:

```js
function resolveItemCaption(item) {
  const configuredCaptionKey = props.itemCaptionFieldKey
  if (configuredCaptionKey && ...) { ... }
  const inventoryNumber = String(item?.inventory_number ?? '').trim()
  if (inventoryNumber) return inventoryNumber
  ...
```

Similarly, `WikidataAutosuggestInput.vue` special-cases the Wikidata property `P1566` (GeoNames ID) to
write a `geoNames` array into the selected entity — documented at
`docs/technical-documentation.md` §13 but implemented inside a component the same document describes as
generic.

**Root cause.** Both are convenience defaults added while working with one dataset, at a point where
the generic mechanism (`itemLabelField`, `alsoGetDataFrom`) already existed but had not been configured
for it. The shortcut was cheaper than the configuration and was never revisited.

**Concrete consequence.** Limited but real. Any dataset that happens to carry an `inventory_number`
column gets it as the card caption whenever `itemLabelField` is unset or empty for a given item —
silently, and with no way to turn it off short of editing the component. The README and the technical
documentation both present the viewer as a general-purpose tool for JSON/CSV lists, so the next dataset
onboarded will either be surprised by this or will have to discover it by reading the component. The
`P1566` case is narrower — it only adds a field — but it means the "opaque pass-through" boundary
(MOD-04) has one property-specific exception that a reader of the documentation would not expect.

**Recommendation.** Proportionate to the impact — do not build new machinery:

- Delete the `inventory_number` branch from `resolveItemCaption` and set
  `config.itemLabelField: "inventory_number"` in the deployment's Strapi settings and in
  `public/sample-data.json`. The configured mechanism already produces exactly this result; the
  hard-coded fallback is redundant with it.
- Leave `P1566` where it is for now, but move the property id to a named constant with a comment
  explaining that it is a convenience shortcut for `alsoGetDataFrom`, and note the exception in §13.
  Removing it would change the shape of already-persisted entity payloads, which is not worth doing on
  its own.

**Expected benefit.** The list component's captioning becomes fully described by its props; the one
remaining domain exception is labelled rather than hidden.

**Effort:** S — the code change is minutes; confirming that the deployed settings carry
`itemLabelField` before removing the fallback is the actual task.

**Risks.** Removing the fallback before the settings are updated would blank the captions for the live
collection. Verify the deployed `data.settings.itemLabelField` first, and ship the settings change
ahead of the code change.

**Dependencies.** None. Best done alongside MAINT-01 so the caption behaviour gets its first test.

**Acceptance criterion.** `grep -rn "inventory_number" src/` returns no result;
`public/sample-data.json` sets `config.itemLabelField` and the sample cards still show their captions;
the `P1566` literal appears once, as a named constant with a comment.

---

### MAINT-04 — `sessionStorage` access is unguarded while `localStorage` is guarded

- **Category:** Maintainability / robustness · **Priority:** P3 · **Confidence:** High
- **Location:** `src/stores/useDataTransferStore.js:12,23`;
  `src/stores/useUserConfigStore.js:251,336,340`. Contrast with the four `getLocalStorageSafe`
  definitions (MAINT-03).

**Observed.** Every `localStorage` access in the codebase goes through a `try/catch` accessor, and
`docs/technical-documentation.md` §5 states the invariant: *"Zugriffe auf `localStorage` sind gegen
nicht verfügbaren Storage abgesichert."* The two stores that use `sessionStorage` do not follow it:

```js
function persistUserConfigToSession() {
  const payload = { ... }
  sessionStorage.setItem(USER_CONFIG_SESSION_KEY, JSON.stringify(payload))   // unguarded
}
```

`loadUserConfigFromSession` has a `try/catch`, but it wraps JSON parsing rather than storage access,
and `persistUserConfigToSession`, `clearUserConfigSession` and both `useDataTransferStore` accessors
have none.

**Root cause.** The guard was introduced for `localStorage` — where the risk had presumably been hit —
and the pattern was never extended to the sibling API, which carries the same failure mode. The
documentation then generalised the invariant one step further than the code did.

**Concrete consequence.** In a context where storage access throws rather than returning null —
Safari's Private Browsing under older versions, browsers with third-party storage blocked when the app
is framed, or enterprise policy — the throw is not localised. `persistUserConfigToSession` is called
from **thirteen** store actions (`setFieldType`, `addUserConfigField`, `removeUserConfigField`,
`dropAt`, `setItemLabelField`, `applyUserConfigToRawItems`, and others), so the exception propagates
out of an event handler and aborts the action mid-way. `applyUserConfigToRawItems` is the worst case:
it has already mutated `rawItems`, reassigned `appliedUserConfigFields` and updated the snapshot by the
time it calls `persistUserConfigToSession` at `:474`, so the throw leaves applied state without its
persisted counterpart. The likelihood is low; the failure is disproportionate to it, and it is silent
in the sense that the user sees a control that simply did nothing.

**Recommendation.** Add `getSessionStorageSafe()` alongside `getLocalStorageSafe()` in the shared
`src/utils/` module proposed in MAINT-03, and route the five call sites through it. Then either correct
§5 to say "Browser-Storage-Zugriffe" or leave the wording as-is once the code matches it.

**Expected benefit.** A blocked-storage browser degrades to "config is not remembered across a reload"
instead of "the Configuration tab silently stops responding". The documented invariant becomes true.

**Effort:** S — under an hour, and it rides along with MAINT-03's utility extraction.

**Risks.** None. Failure becomes a no-op, which is already the behaviour for `localStorage`.

**Dependencies.** Best done as part of MAINT-03.

**Acceptance criterion.** No bare `sessionStorage.` reference remains in `src/`; a test that makes the
storage accessor throw shows `applyUserConfigToRawItems` completing and the config applying normally.

---

### MAINT-06 — The app-config shape is declared three times and never validated

- **Category:** Maintainability / data contracts · **Priority:** P3 · **Confidence:** High
- **Location:** `config/app.config.js:5-15`; `src/stores/useAppConfigStore.js:44-54`
  (`normalizeAppConfigInput`); `src/components/DatabaseConnectionPanel.vue:14-22` and `:64-73`
  (`appConfigForm` and `hydrateAppConfigFormFromStore`).

**Observed.** The seven editable app-config keys are enumerated in three places: the build defaults
object, the store's normaliser, and the Settings-tab form with its own per-key fallbacks. The form's
defaults do not all match the normaliser's — `appConfigForm.languageMode` defaults to `'single'`
(`DatabaseConnectionPanel.vue:16`) while `normalizeLanguageMode` defaults to `'multi'`
(`useAppConfigStore.js:12-17`).

Separately, there is no validator for this config. `normalizeAppConfigInput` coerces silently: an
unknown `connectionMode` becomes `'switchable'`, any non-empty string is accepted as `primaryColor`,
and a malformed value produces no diagnostic. The structurally parallel connection profile is treated
the opposite way — `validateConnectionProfile` (`connectionProfile.js:47-91`) returns per-field errors
that `DatabaseConnectionPanel` renders next to the offending input.

**Root cause.** The app config grew from a build-time constants file, where silent defaults were
appropriate because a typo was caught in review. It became a runtime-loaded, user-editable,
importable/exportable artefact without acquiring the validation that change implies — and the Settings
form was added last, declaring the shape a third time because no shared descriptor existed.

**Concrete consequence.** Today the default mismatch is unreachable — `buildEditableAppConfigDraft`
always returns a normalised value, so the form's `|| 'single'` fallback never fires — but it is
evidence that the three declarations drift without anything noticing. Adding an eighth key requires
three coordinated edits, and omitting the form edit produces a key that is persisted and exported but
not editable. Meanwhile a typo in a hand-edited `public/app-config/*.json` (`"connectionMode": "onlnie"`)
silently yields `switchable`, and the operator's only clue is that the app behaves differently from the
file they wrote. The exported JSON from the Settings tab round-trips fine; a hand-written one does not
report its own errors.

**Recommendation.** Introduce a single descriptor and derive from it:

```js
// useAppConfigStore.js
const APP_CONFIG_KEYS = {
  language:     { normalize: normalizeLanguage,     default: 'de' },
  languageMode: { normalize: normalizeLanguageMode, default: 'multi' },
  // ...
}
```

`normalizeAppConfigInput` iterates it; `DatabaseConnectionPanel` builds its form from it instead of a
literal; `config/app.config.js` keeps only the values. Then add `validateAppConfigInput(input)`
returning `{ ok, errors }` in the shape `validateConnectionProfile` already uses, call it from
`importEditableAppConfigFromJsonText` and `loadEditableAppConfigFromDefault`, and surface the errors
where the profile's errors are already surfaced. Include the `http`/`https` check for `githubRepo` from
DEBT-01 here.

**Expected benefit.** One declaration of the config shape; the two runtime-loaded config files get
consistent validation and consistent error reporting.

**Effort:** S–M — the descriptor is small; wiring the validator into two loaders and the panel is the
larger half.

**Risks.** Validation that is too strict would reject configs that currently load with coerced values.
Start by reporting errors without rejecting — surface them in the Settings tab while still applying the
normalised result — and only tighten once the deployed files are known to be clean.

**Dependencies.** Implement the `githubRepo` check together with DEBT-01. Related to DEBT-03.

**Acceptance criterion.** The seven keys are enumerated in exactly one module; `DatabaseConnectionPanel`
contains no literal list of config keys; importing an app-config JSON with an invalid `connectionMode`
shows a field-level error rather than silently defaulting.

---

### DEBT-05 — Dead and unreachable code paths

- **Category:** Technical debt · **Priority:** P3 · **Confidence:** High
- **Location:** as listed below.

**Observed.** Five independent remnants, grouped because they share one cause and one remedy.

| # | Item | Location | Status |
| --- | --- | --- | --- |
| 1 | `config/wording.js` | whole file, 865 lines | Imported by nothing (`app.config.js:3` imports `wording.json`). Contains 215 handles, a strict subset of `wording.json`'s 251 — 36 handles behind. Last edited in commit `6717317`, having been touched in 29 commits total. |
| 2 | `handleUnauthorized` | `src/stores/useAuthStore.js:105-109,157` | Defined and exported; called from nowhere. |
| 3 | `supportedLanguages` | `src/stores/useAppConfigStore.js:301-318,325` | A computed deriving available languages from the merged wording; consumed by nothing. `App.vue:1166-1173` hard-codes DE and EN buttons. |
| 4 | Offline hierarchy path | `src/App.vue:212-279` (`buildHierarchyLevel1OptionsFromRawItems`), `:319-336` (`offlineSelectedHierarchyLevel1Value`) | Unreachable: `hierarchyEnabled` derives from `onlineSettings.value` (`App.vue:280-308`), which is `null` in offline mode, so the offline branches at `:313-316` and `:321-326` cannot be entered. Also `onlineHierarchyFields` is destructured at `:83` and never read. |
| 5 | `wikidata_autosuggest` alias | `src/composables/useFieldMapping.js:14`, `src/services/strapiApi.js:222` | Tolerated by these two modules, but `validateImportedConfigPayload` checks against `getRegisteredFieldTypes()` (`userConfigValidation.js:66-73`), which contains only the hyphenated key. Settings using the underscore form are rejected by `applyImportedConfigPayload` before the tolerant code can run — so the compatibility branches are unreachable. |

**Root cause.** Each is a feature that was superseded rather than removed: `wording.js` by
`wording.json`, `supportedLanguages` by a hard-coded two-button switch, the offline hierarchy by the
decision to derive hierarchy from Strapi settings only, the underscore alias by a stricter validator.
With no linter (MAINT-01), nothing reports an unused binding, and the residue is invisible in review.

**Concrete consequence.** Mostly cognitive, but not only. Item 1 is the costly one: an 865-line file
named `wording.js` sitting beside the live `wording.json` is a trap — its 29-commit edit history shows
it *was* being maintained, and a maintainer adding a handle there would see no effect and no error.
Item 5 is actively misleading in a different way: two modules advertise tolerance for a settings shape
that the application rejects, so a maintainer debugging a rejected settings payload finds code
suggesting it should work. Items 2 and 4 cost reading time and, in item 2's case, mask a real gap —
there is no 401 recovery anywhere in the app, so an expired JWT produces repeated
`Request failed with HTTP 401` messages with no automatic logout and no prompt to re-authenticate.

**Recommendation.**

1. Delete `config/wording.js`. `docs/technical-documentation.md:99-103` already concludes *"die Datei
   kann entfernt werden"*; act on it. Confirm no deployment imports it first
   (`grep -rn "wording'" src/ config/`).
2. Either wire `handleUnauthorized` up or delete it. Wiring it up is the better answer and is small:
   in `strapiFetchJson`, or at each store's catch site, call it when `error.status === 401`. That turns
   an expired session into a clean logout and login prompt. If that is out of scope now, delete the
   function and open an issue for 401 handling so the gap is recorded rather than half-implemented.
3. Delete `supportedLanguages`, or use it to drive the language switch — the latter is a small change
   (`v-for` over `supportedLanguages` in `App.vue:1166-1173`) and would make the switch reflect the
   merged backend wording, which appears to have been the original intent.
4. Delete the offline hierarchy helpers and the unused `onlineHierarchyFields` binding as part of
   MOD-02's consolidation — that finding's remedy touches the same code, so do it once.
5. Either add `wikidata_autosuggest` to the validator's accepted set (making the tolerant branches
   reachable) or remove the two tolerant branches. Decide by checking whether any deployed Strapi
   settings use the underscore form; if none do, remove the branches.

**Expected benefit.** About 900 lines and five misleading signals removed; one real gap (401 handling)
either closed or explicitly recorded.

**Effort:** S for items 1, 3, 4 and 5. Item 2's wiring is S but needs a decision about the UX of an
expired session.

**Risks.** Item 1 is the only one worth checking twice — confirm no build tooling or deployment script
references `config/wording.js` before deleting. Items 3 and 5 are behaviour changes if the "use it"
option is chosen rather than the "delete it" option; pick one deliberately.

**Dependencies.** Item 4 belongs with MOD-02. A linter (MAINT-01) would prevent recurrence.

**Acceptance criterion.** `config/wording.js` no longer exists; `grep -rn "handleUnauthorized\|supportedLanguages\|buildHierarchyLevel1OptionsFromRawItems" src/`
returns only live call sites or nothing; `wikidata_autosuggest` is either accepted end to end or absent
from `src/`; `npx vitest run` stays green.

---

### DEBT-06 — Collection-wide saves are sequential, unbatched and unreported

- **Category:** Technical debt / performance · **Priority:** P3 · **Confidence:** Medium
- **Location:** `src/stores/useOnlineUpdatesStore.js:243-322` (`saveOnlineUpdates`);
  `:145-205` (`trackOnlineReplacementUpdatesForRemainingItems`);
  `src/services/strapiApi.js:388-453` (`fetchAllCollectionItemsFromStrapi`).

**Observed.** A replacements run in online mode is documented as covering the entire collection
(`docs/technical-documentation.md` §11.3), and the documentation acknowledges the read cost: §17 notes
that such a run *"lädt die gesamte Collection einmal paginiert nach; bei großen Collections ist das
entsprechend teuer."* The **write** cost is not mentioned. `saveOnlineUpdates` iterates pending creates
and then pending updates in two sequential `for ... of` loops, each awaiting one HTTP request:

```js
for (const [entryKey, entry] of updateEntries) {
  try {
    await updateCollectionItemInStrapi({ profile, itemsPath: entry.itemsPath, id: entry.id, token, changedFields })
```

There is no batching, no concurrency limit, and no progress reporting — `saveStatus` is a single
`'saving'` for the whole run, and `OnlineAccessPanel` renders it as one indeterminate state.

**Root cause.** The save loop was written for the interactive case — a handful of items edited by hand —
where sequential writes are correct and simplest. The collection-wide replacements feature later routed
its results through the same queue (a good decision: it reuses the delta pipeline and the retry
semantics) without revisiting whether the queue's execution model still fits.

**Confidence note.** This is reasoned from the code, not measured. The collection size for this
deployment is unknown to the review (see Open Questions), so the threshold at which it becomes a real
problem is unknown. What is certain from the code is that the number of sequential round trips equals
the number of changed items, with no upper bound and no user-visible progress.

**Concrete consequence.** For a rule matching a common substring across a large collection, pressing
*Änderungen speichern* issues one `PUT` per changed item, strictly sequentially. At a conservative
100 ms per round trip, 2,000 changed items is over three minutes of a single indeterminate spinner with
no indication of progress or remaining work — during which a reload or a navigation abandons the run
part-way. Partial completion is handled correctly (`:305-321` keeps failures pending and retryable),
so this is a UX and duration problem rather than a data-integrity one. The read side has the same
shape: `trackOnlineReplacementUpdatesForRemainingItems` fetches every page before reporting anything.

**Recommendation.** Proportionate to a feature that is used deliberately and rarely:

1. **Report progress.** Extend `saveStatus` with a counter — `{ status: 'saving', done, total }` — and
   render "saving 412 / 2000" in `OnlineAccessPanel`. This is the change that removes the "is it
   stuck?" question and is worth doing regardless of the collection size.
2. **Add bounded concurrency.** Process the update queue with a small worker pool (4–6 in flight)
   rather than one at a time. This is a contained change to the two loops and typically cuts wall-clock
   time by most of the factor. Keep it bounded — unbounded `Promise.all` over thousands of writes would
   trade this problem for a rate-limiting one.
3. **Warn before a large run.** When a replacements run produces more than a threshold of pending
   updates, say so in the summary line that `ReplacementsPanel` already renders
   (`lastApplySummary` carries `remoteChangedItemCount`), so the user knows what pressing save will
   cost before pressing it.

Do not batch at the HTTP level: Strapi's REST API has no bulk-update endpoint, so that would mean a
custom backend endpoint — disproportionate unless measurement shows the concurrency fix is insufficient.

**Expected benefit.** A long save becomes legible and several times faster, without changing the
delta/retry semantics that already work correctly.

**Effort:** M — the worker pool and the progress counter are each small; threading the counter through
`saveStatus` into the panel and keeping the partial-failure semantics intact is the care required.

**Risks.** Concurrent writes to the same Strapi instance can hit rate limits or lock contention; keep
the pool small and preserve the existing behaviour of collecting failures rather than aborting. Verify
that partial-failure handling (`:305-321`) and `syncSnapshotItemAtIndex` (`App.vue:557-566`) still
behave correctly when completions arrive out of order.

**Dependencies.** None, though MOD-06's explicit-dependency change touches the same function.

**Acceptance criterion.** `OnlineAccessPanel` displays a progress count during a multi-item save; a
test asserts that no more than N requests are in flight simultaneously; partial-failure behaviour is
unchanged under the existing `useOnlineUpdatesStore.test.js` assertions.

---

## 5 Remediation roadmap

The ordering below is driven by two things: what unblocks other work, and what is cheap enough to do
without a safety net. Nothing here requires a rewrite, and no finding calls for a new framework,
dependency (beyond a test environment and a linter) or architectural layer.

### Stage 0 — Immediate, independent, no prerequisites

These are small, self-contained, and none of them depends on the test environment.

| Order | Finding | Why first |
| --- | --- | --- |
| 1 | **DEBT-01** — remove the `v-html`, validate `githubRepo` | Closes a script-execution path from backend-controlled data. Under an hour, no dependencies. |
| 2 | **DEBT-02** — reject 200/non-JSON, bound the retry loops | Verified unbounded request loop on the two busiest network paths. |
| 3 | **DEBT-03** — fix `clearEditableAppConfig` | Verified; the Settings tab currently reports the opposite of what it did. |
| 4 | **DEBT-04** — fall back to stored profile on default-fetch failure | Removes a single point of failure between a bundled file and all online functionality. |
| 5 | **MAINT-05** — correct the documentation drift | The base-path error costs a deployment; correcting it is minutes. |

**Validation for stage 0:** each fix ships with the regression test named in its acceptance criterion;
`npx vitest run` green; a manual smoke test of the Settings tab (save → clear → verify the panel) and
of an online session start.

### Stage 1 — Build the safety net

| Order | Finding | Why here |
| --- | --- | --- |
| 6 | **MAINT-01** — jsdom + `@vue/test-utils` + ESLint | Prerequisite for everything in stage 3. The linter also prevents DEBT-05 from recurring. |
| 7 | **MAINT-03** — shared utilities; promote `hasNonEmptyValue` and `splitCsvLine` | Cheap, mechanical, fully covered by the existing suite, and it removes ~25 definitions that would otherwise have to be updated by later stages. |
| 8 | **MAINT-04** — guard `sessionStorage` | Rides along with #7's utility module. |

**Validation:** `npx eslint .` reports zero errors on the configured rule set; three component test
files exist and pass; the suite stays green throughout #7 (every replacement is behaviour-preserving
and individually verifiable).

### Stage 2 — Consolidate the scattered contracts

These share one root cause — knowledge re-derived per consumer — and each is independently shippable.
Doing them before stage 3 means the big extractions move consolidated code rather than duplicated code.

| Order | Finding | Notes |
| --- | --- | --- |
| 9 | **MOD-06** — explicit `profile`/`token` in the online layer | Do first in this stage: it simplifies both MOD-02's and MOD-01's extractions and removes the shared test scaffolding. One commit per store. |
| 10 | **MOD-02** — one `resolveHierarchyFields` | The highest-value consolidation: it fixes a silent blank screen and an accidental config-erasure path. Requires agreeing the union of accepted shapes first. |
| 11 | **MOD-03** — move the field vocabulary into the registry | Makes the documented extension point true. |
| 12 | **MOD-04** — one autosuggest schema module | Same shape as #11, different subsystem. |
| 13 | **DEBT-05** — delete the dead code | Last in this stage: #10 removes the offline hierarchy path as a side effect, and the linter from #6 will have found anything this list missed. Decide the `handleUnauthorized` question explicitly rather than by deletion. |

**Validation:** for #10 and #12, a shape-matrix test enumerating every legacy form currently accepted
by any implementation, asserted against the single new resolver — written *before* the old
implementations are deleted. For #10, verify against a copy of the production settings singleton before
the first `Konfiguration anwenden` write-back.

### Stage 3 — Structural work

Only now, with tests, a linter and consolidated contracts in place.

| Order | Finding | Notes |
| --- | --- | --- |
| 14 | **MOD-05** — split `ListPanel`, shrink `useDataImportExport` | Do the `ListPanel` split with zero markup changes, then verify sticky offsets at both breakpoints. |
| 15 | **MOD-01** — extract `useStickyHeaderMetrics`, then `useHierarchyNavigation`, then `useOnlineSession` | In that order: cheapest and most isolated first. The hierarchy extraction should absorb MOD-02's resolver. Carry the ordering comments across verbatim. |
| 16 | **MAINT-02** — error-code boundary + `t()` interpolation | Touches many call sites; cheaper once #15 has settled the module layout. |
| 17 | **MOD-07** — remove `inventory_number`; name the `P1566` constant | Ship the Strapi settings change (`itemLabelField`) *before* the code change. |
| 18 | **MAINT-06** — one app-config descriptor + validator | Fold the `githubRepo` protocol check from DEBT-01 in here. |

**Validation:** after #15, `src/App.vue` contains no hierarchy derivation, no `ResizeObserver` wiring
and no online-initialisation watcher body; each extracted module has its own test file; a full manual
pass of all five tabs in both offline and online mode.

### Debt that can reasonably remain

- **DEBT-06** (sequential saves) — the correctness properties are sound and the partial-failure path is
  already retry-safe. Do step 1 only (progress reporting) opportunistically; defer the worker pool
  until someone reports an actually slow save, and size it from measurement rather than from this
  review.
- **The `legacy.scss` layer** (73 lines) — labelled a temporary migration layer, but it is small,
  coherent and causing no observed problem. Retire it when the components it styles are next touched;
  do not schedule it.
- **`ConfigurationPanel.vue`** — a 29-line pass-through wrapper around `UserConfigPanel`. Superfluous
  indirection, but harmless and documented as such. Remove it if `UserConfigPanel` is ever refactored.
- **The multi-candidate URL probing** in `publicConfigUrls.js` — up to ~8 sequential 404s per config
  file at startup, twice. Slightly slower than necessary, but it is what makes the app portable across
  deploy paths, which is a real requirement. Leave it.
- **The `P1566` GeoNames shortcut** — removing it would change already-persisted entity payloads.
  Naming the constant is enough.
- **Plain JavaScript, no TypeScript** — nothing in this review would have been prevented by types that
  a linter plus the proposed consolidations will not also prevent. Not recommended.

---

## 6 Open questions and unverified concerns

These are not presented as findings. Each states what is uncertain, why it matters, and the smallest
step that would resolve it.

**Q1 — How large is the live collection?** *(bears on DEBT-06's priority.)* The sequential-save
analysis is sound structurally but its practical severity depends entirely on item count and on how
often collection-wide replacement runs are used. If the collection is a few hundred cards, DEBT-06 is
not worth the worker pool and the progress counter alone suffices. **Smallest check:** one authenticated
request to `<baseUrl>/<itemsPath>?pagination[pageSize]=1` and read `meta.pagination.total`.

**Q2 — Does any deployed Strapi settings payload use a legacy shape?** *(bears on MOD-02, MOD-04,
DEBT-05 item 5.)* Several compatibility branches exist for shapes that may have no live users —
`config.hierarchy_fields`, `hierarchy.{level1,level2}`, `wikidata_autosuggest`, string `defs`,
`item_path`, `scan_field`. Consolidating is safe either way, but knowing which are live decides whether
the union can later be *narrowed*. **Smallest check:** fetch and inspect the settings singleton
(`GET <configPath>`) for the one deployed instance; the shipped profile points at
`https://cms.berlin-university-collections.de/hu-ur-und-fruehgeschichte-karteikarten`.

**Q3 — Who can write the viewer-settings singleton?** *(bears on DEBT-01's severity.)* The assessment
assumes ordinary authenticated FE users can `PUT <configPath>`, which follows from `Konfiguration
anwenden` and `Änderungen speichern` both doing exactly that. If Strapi's permissions actually restrict
that route to an admin role, DEBT-01 is a narrower privilege-escalation concern. The fix is cheap
enough that it should be made either way. **Smallest check:** read the Strapi role permissions for the
viewer-settings content type.

**Q4 — Is `dist/` a current build of this branch?** An untracked `dist/` directory is present and was
deliberately not rebuilt, so it may predate the last commits. If it is being deployed, it may carry the
old `base` path referenced in the documentation (MAINT-05). **Smallest check:** compare the asset paths
in `dist/index.html` against the current `base` value in `vite.config.js`.

**Q5 — Was the shipped default connection profile's label intentional?**
`public/connection-profile/viewer-editor-connection-profile.v1.json` carries
`"label": "FU Xylothek - Migration"` while its `baseUrl` points at the HU Ur- und Frühgeschichte
instance. The label is user-visible in the Settings tab form. This looks like a leftover from the
project this deployment was cloned from. Cosmetic, and possibly deliberate. **Smallest check:** ask,
and correct the string if not.

**Q6 — Is the `beforeunload` guard reachable in the online mode?** `beforeUnloadListener`
(`App.vue:744-748`) fires on `hasPendingChanges`, which is `isDirty || hasReplacementsChanges`. In
online mode, pending item deltas live in `useOnlineUpdatesStore.pendingUpdatesById`, and `isDirty` is
set by `updateField` — so the guard probably does cover online edits, but the relationship is indirect
and the online-specific `hasPendingOnlineChanges` computed is *not* part of the guard's condition.
Whether an online user with unsaved deltas but a reset `isDirty` can navigate away without a warning
was not established. **Smallest check:** a component test (available after MAINT-01) asserting the
guard fires when `hasPendingUpdates` is true and `isDirty` is false, or a manual trial: edit one online
field, save, edit again, and attempt to close the tab.

**Q7 — Does the `suspendEditing` auto-unsuspend watcher have a race?** `App.vue:918-931` watches
`[selectedUid, suspendedItemIndices.join('|')]` and calls `toggleSuspendEditingByUid(uid, false)` when
the newly selected item is suspended — so selecting a suspended item un-suspends it, which then
re-triggers the same watcher through its second dependency. It terminates (the second pass finds the
index absent and returns early), and no misbehaviour was observed in reading. But the interaction with
`onSuspendEditingToggle`'s auto-advance (`App.vue:568-585`), which selects the *next* item when the
current one is suspended, was not traced exhaustively. **Smallest check:** a component test covering
"suspend the selected item → next item is selected → the next item is not itself un-suspended".

---

*Review performed against commit `54f233a`. Test suite verified passing (19 files, 183 tests). Two
findings (DEBT-02, DEBT-03) were reproduced by execution using temporary test files that were deleted
afterwards; all other findings are static-analysis conclusions from code reading, cross-checked against
the existing tests and documentation. No application file, configuration file, dependency or existing
document was modified by this review.*
