// Items created in this session (offline "Neues Item" and online drafts). Kept outside the item
// objects so nothing ends up in the export. A WeakSet: after a re-import or reset the items are
// fresh clones and count as regular items again.
const createdItems = new WeakSet()

export function markItemAsCreated(item) {
  if (item && typeof item === 'object') {
    createdItems.add(item)
  }
}

export function isCreatedItem(item) {
  return Boolean(item && typeof item === 'object' && createdItems.has(item))
}
