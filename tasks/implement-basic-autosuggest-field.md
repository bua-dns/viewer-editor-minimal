# Task: Implement Basic `wikidata-autosuggest` Field Type (MVP)

## Goal

Implement the smallest production-usable version of a new field type `wikidata-autosuggest` using the already refactored field registry architecture.

This task should deliver a working end-to-end flow (configure -> render -> select -> store -> export/import) while intentionally deferring advanced ranking and UX features.

---

## Relationship to Overall Plan

This task is a scoped MVP derived from `C:\Users\mmuel\Documents\__BUA\__Kooperationen\__SODA\Viewer-Editor\tasks\integrate-autosuggest-field.md`.

It should establish the first real implementation slice without blocking future phases (advanced config, richer selection controls, ranking customization).

---

## MVP Scope

### In Scope

- Add `wikidata-autosuggest` as a registered field type in the field registry.
- Render the new type through a dedicated viewer wrapper component (not directly embedding generic logic in `App.vue` or generic renderer code).
- Support selecting entities from autosuggest results and writing them to the dataset.
- Store value in entity-based format (Q-ID + presentation fields) as an array from day one.
- Parse/pass a minimal `autosuggest` config object from field definition to the wrapper/component.
- Ensure import/export keeps selected entities unchanged.
- Keep existing field types (`normal`, `text`, `integer`, `checkbox`) behavior unchanged.

### Out of Scope

- No advanced ranking/prioritization rules UI.
- No additional domain-specific heuristics in viewer core.
- No migration tooling for historical datasets.
- No replacement-system integration for autosuggest values.
- No full feature parity with all future autosuggest ideas.

---

## Functional Requirements

1. **New field type registration**
   - `wikidata-autosuggest` is added at the single registration point.
   - Config validation accepts the new type.

2. **Dedicated wrapper**
   - Introduce a viewer-specific wrapper (e.g. `ViewerWikidataField.vue`).
   - Wrapper responsibilities:
     - receive field value and field config,
     - pass autosuggest config downstream,
     - emit normalized updates back to viewer model,
     - render selected entity chips/list in a minimal usable way.

3. **Value shape (MVP canonical)**
   - Field value must be an array of entity objects.
   - Minimum object shape:

```json
[
  {
    "id": "Q42",
    "label": "Douglas Adams"
  }
]
```

   - Optional fields (if provided by source) may be preserved (e.g. `description`).

4. **Selection behavior (basic)**
   - User can add at least one entity via autosuggest.
   - User can remove an already selected entity.
   - Duplicates by `id` are prevented.

5. **Import/export compatibility**
   - Existing importer/exporter pipeline must preserve array-of-entities values without schema transformation.
   - Save/reload roundtrip keeps `id` stable.

---

## Technical Requirements

1. **Registry-driven integration**
   - Reuse the new field registry/contract extension points.
   - Keep renderer-level branching minimal.

2. **Config handling**
   - Extend field config type shape with optional `autosuggest` object.
   - Treat `autosuggest` as opaque pass-through config.
   - Do not interpret, validate, transform, or execute autosuggest-specific options in Viewer code.

3. **Data normalization guards**
   - For `wikidata-autosuggest`, ensure stored value is always normalized to array form.
   - Gracefully handle malformed legacy values (null/string/object) by converting to empty array or one-item array where safe.

4. **No leakage into unrelated systems**
   - Replacements logic remains untouched for this field type.
   - No hardcoded Wikidata business rules outside the dedicated field module(s).

---

## Additional Architectural Constraints

### 1) Import/Export Must Treat Entity Objects as Opaque Structured Data

- Importer, exporter, persistence, and intermediate processing must treat `wikidata-autosuggest` values as opaque structured data.
- Viewer code must not inspect, flatten, rewrite, enrich, strip, or otherwise modify entity object payloads during import/export.
- Save/load roundtrips must preserve additional metadata fields exactly as provided.

Roundtrip example that must remain unchanged:

```json
[
  {
    "id": "Q42",
    "label": "Douglas Adams",
    "description": "English writer",
    "ranking": {
      "score": 10
    }
  }
]
```

This guarantees forward compatibility for future autosuggest metadata extensions.

### 2) Viewer Must Not Interpret Autosuggest Configuration

- Viewer responsibilities are limited to:
  - reading `field.autosuggest`,
  - passing it to the viewer wrapper,
  - forwarding it unchanged to the generic autosuggest component.
- Viewer code must not interpret, validate, transform, or execute autosuggest-specific config keys such as:
  - `searchLanguages`,
  - `resultLanguage`,
  - `prioritize`,
  - `claimPresence`,
  - `claimValueMatch`.

All autosuggest behavior remains in the generic autosuggest package to keep Viewer core domain-neutral.

---

## Suggested Implementation Steps

### Phase 1: Type + Validation Wiring

- Register `wikidata-autosuggest` in field registry.
- Extend user config validation to accept the type.
- Extend docs/comments for field type list.

### Phase 2: Wrapper Component

- Create `ViewerWikidataField.vue`.
- Define props/emits aligned with field contract.
- Add minimal selected-entity rendering + remove action.

### Phase 3: Renderer Contract Integration

- Update field editor rendering path to delegate this type to wrapper component cleanly.
- Ensure generic fields still use existing bindings unchanged.

### Phase 4: Value Normalization + Persistence

- Normalize updates into canonical array-of-entities shape.
- Validate roundtrip behavior in JSON import/export flow.
- Add explicit roundtrip checks that extra entity metadata survives unchanged (opaque payload guarantee).

### Phase 5: Regression + Tests

- Add/extend unit tests for:
  - type registration,
  - config validation acceptance,
  - normalization behavior,
  - opaque entity-object roundtrip behavior,
  - autosuggest config pass-through without viewer-side interpretation,
  - non-regression for existing field types.

---

## Acceptance Criteria

- `wikidata-autosuggest` can be configured and rendered as a field type.
- User can select and remove entities in the editor UI.
- Stored value is always array-of-entities with stable `id` values.
- Exported JSON preserves the structure; re-import shows same selections.
- Extra entity metadata (unknown nested fields) survives save/load unchanged.
- `autosuggest` config is forwarded unchanged; Viewer does not interpret autosuggest-specific options.
- Existing non-autosuggest fields behave exactly as before.
- No Wikidata-specific conditional logic is added to generic core paths beyond registry/module registration.

---

## Definition of Done

- Implementation merged with tests passing (`npm run test`, `npm run build`).
- Brief docs update explains:
  - how `wikidata-autosuggest` is registered,
  - expected stored value shape,
  - where to extend for future advanced autosuggest behavior.
- Manual smoke check confirms no regressions in baseline edit/view workflow.

---

## Follow-Up (Not Part of This MVP Task)

- Advanced ranking/prioritization schema validation.
- Richer multi-select UX (keyboard shortcuts, reorder, bulk clear).
- Better malformed-data recovery strategy and migration helpers.
- Performance tuning/caching for larger suggestion sessions.
