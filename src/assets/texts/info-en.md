# How to Use This Tool

This app is for transcribing data linked to scan URLs (for example, scanned index cards). It runs entirely in the browser.

---

## 1) Load or create data

- Use the mode switch at the top to choose **JSON** or **CSV**.
- The uploaded file type must match the selected mode.
- With no dataset loaded, you can use **Use sample data**.
- In **JSON** mode (and only before loading data), you can use **Start from scratch** to create a new dataset from:
  - one scan URL, or
  - a CSV list of scan URLs.

Example CSV for scan URLs:

```csv
scan
https://files.berlin-university-collections.de/dummy-files/sample-card-1.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-2.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-3.jpg
```

---

## 2) Edit entries

- In the **Edit** tab, use the search field to filter across all item fields.
- Click an item to open the editor in the right panel.
- If the scan URL points to an image, you get a preview and a lightbox view.
- Use previous/next controls to move through filtered items.

---

## 3) Configure fields

In the **Configuration** tab you can:

- add, remove, and reorder fields,
- define field labels and placeholders,
- choose field types: `normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`.

Use **Apply configuration** to update the editable structure of the loaded data.

---

## 4) Manage replacements

- In the **Replacements** tab, add replacement rules for all fields or for a specific field.
- Replacement rules are stored in JSON exports.

---

## 5) Save and continue later

- Use **Download CSV** or **Download JSON** to save your current state.
- Download is enabled when there are unsaved changes.
- Timestamped filenames are enabled by default and help keep versions.
- **Reset** restores the imported snapshot and discards unsaved changes.

Important:

- **JSON export** contains data, configuration, and replacements.
- **CSV export** contains data only.
- If you close or reload the page before downloading, unsaved changes are lost.
