# Changes - not in documentation yet

What was built (per your answers):
- Flow B: "Neues Item" button in the list header (online + authenticated only) creates a local draft, auto-selects it; POST happens on "Save changes"
- Draft model: same field keys as loaded items (from applied field config), registry defaults (''/null/false/[]), scan: '' if applicable, __onlineMeta: { isDraft, draftId, itemsPath }
- Save: creates run sequentially before updates via POST <itemsPath> with { data: <non-empty fields only> }; on success the item gets the server's documentId and switches to the regular PUT-delta path
- UX: draft counts in the unsaved counter immediately, shares save-status UX (idle|saving|success|error) with retry, shows fallback label "Neues Objekt"/"New item", suspendEditing works, reset discards unsaved drafts
- Edge cases: partial failure → already-created items get their snapshot baseline synced via syncSnapshotItemAtIndex; showOnlyNonEmptyFields doesn't hide empty draft fields
Files touched: strapiApi.js (create + field-filter helpers), useOnlineUpdatesStore.js (pendingCreatesById, orchestration), useViewerData.js (appendOnlineDraftItem, syncSnapshotItemAtIndex), useFieldMapping.js (draft filter bypass), ListPanel.vue (button + caption fallback), App.vue (wiring), wording.js (onlineCreateItem, onlineNewItemFallback), tests, docs.
One semantics note: false counts as a non-empty value (consistent with the app's hasNonEmptyValue), so explicitly-set checkboxes are included in the POST payload.

--