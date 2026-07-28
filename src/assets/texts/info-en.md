# How to Use This Tool

This app helps you review and edit item data (JSON/CSV), including scan previews and configurable fields.

---

## 1) Choose mode and load data

- The app can run in **Offline** or **Online** mode (if enabled in your setup).
- In **Offline**, choose **JSON** or **CSV**, then upload a matching file.
- With no data loaded, you can use **Use sample data**.
- In **JSON** mode (before loading data), **Start from scratch** can create records from scan URLs.

---

## 2) Edit items

- In **Edit**, search across all fields.
- Select an item to edit it in the right panel.
- If a `scan` URL points to an image, you get preview + lightbox.
- Use previous/next to move through the filtered list.
- You can mark items with **Suspend editing** to postpone them.

---

## 3) Configure and replace values

- In **Configuration**, add/remove/reorder fields and set labels, placeholders, and field types.
- Supported types: `normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`.
- Click **Apply configuration** to update all loaded items.
- In **Replacements**, define text replacements globally or per field.

---

## 4) Optional: connect to database (Online)

- In **Database connection**, set your Strapi connection profile and test it.
- In **Online** mode, log in and load settings/items from Strapi.
- Local upload/download controls are hidden in Online mode.
- Use **Save changes** to send edits (and new draft items) to Strapi.

---

## 5) Save safely

- In Offline mode, use **Download JSON** or **Download CSV**.
- **JSON export** includes data, config, replacements, and suspended items.
- **CSV export** includes data only.
- **Reset** restores the last imported state and discards unsaved changes.
- If you close or reload before saving, unsaved changes are lost.
