# Konventionen bei der Nutzung des Viewer-Editors

## Angabe der Medien

- Quelle ist das Feld "scan" im Daten-JSON
- Dort muss eine URL zu einem Digitalisat hinterlegt sein
- Wenn kein `scan`-Feld vorhanden ist, arbeitet die App automatisch im No-Scans-Modus mit textbasierter Item-Liste.

## Datenformate

- Der Datenmodus (JSON/CSV) muss zum hochgeladenen Dateityp passen.
- JSON akzeptiert entweder ein Top-Level-Array oder ein Objekt mit `data`-Array.
- CSV erwartet eine Header-Zeile, danach Datensätze.
- Spaltennamen in CSV müssen eindeutig sein und dürfen nicht leer sein.
- Signifikante Leerzeichen in CSV-Feldwerten bleiben erhalten; nur Zeilenumbrüche/CRLF-Terminatoren werden entfernt.
- Wenn noch keine Datei geladen ist, können alternativ passende Beispieldaten je Modus geladen werden.

## Feldkonventionen

- Das Feld `scan` ist für die Bildvorschau reserviert.
- Für die automatische Vorschau sollte `scan` auf eine direkt ladbare Bild-URL zeigen (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`).
- Alle übrigen Felder können über die Konfiguration als `normal`, `text`, `integer`, `checkbox`, `candidate` oder `wikidata-autosuggest` typisiert werden.
- Das globale Config-Feld `itemLabelField` kann auf einen vorhandenen Feldschlüssel zeigen und steuert dann die Item-Beschriftung in Karten-/Listenansicht.

## Konfiguration (JSON)

- Beim JSON-Export wird immer das kanonische Format `{ data, config, replacements, suspendedItems }` geschrieben.
- Optional kann `suspendedItems` bereits beim JSON-Import mitgegeben werden (Array von Item-Indizes).
- `config.fields` muss ein Objekt sein, dessen Schlüssel den Feldnamen entsprechen.
- Pro Feld sind folgende Eigenschaften vorgesehen: `type`, `label`, `order`, `placeholder`, `hint`.
- Optional pro Feld: `fieldWidth` mit `33%`, `50%` oder `100%` (Layout im Sidebar-Editor: 3/2/1 Felder pro Zeile).
- Für Nicht-`wikidata-autosuggest`-Felder ist zusätzlich `readOnly` (Boolean) erlaubt.
- Für `wikidata-autosuggest` ist `readOnly` nicht erlaubt; stattdessen ist optional `autosuggest` als pass-through Objekt vorgesehen.
- Für `candidate` ist zusätzlich ein Objekt `candidate` erforderlich:
  - `candidate.targetField` (Pflicht, String): muss auf ein vorhandenes Feld zeigen, darf nicht auf sich selbst und nicht auf ein weiteres `candidate`-Feld zeigen.
  - erlaubte Zieltypen: `normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`.
  - `candidate.inputType` (optional): `normal` (Default) oder `text`.
  - der Candidate-Wert selbst bleibt ein String-Feld und wird beim Übernehmen in den Zieltyp normalisiert.
  - bei Zieltyp `wikidata-autosuggest` wird der Wert als Such-Query vorbefüllt und die Suche sofort gestartet (ohne Auto-Selektion).
- Optional kann `config.itemLabelField` gesetzt werden (String, muss ein vorhandener Schlüssel in `config.fields` sein).
- Optional kann `config.markAsEditedBasis` gesetzt werden (String, muss ein vorhandener Schlüssel in `config.fields` sein): Items mit nicht-leerem Wert in diesem Feld gelten als bearbeitet, erhalten in der Liste ein Edit-Icon statt der `suspendEditing`-Checkbox und werden ans Listenende sortiert (umschaltbar im Listenkopf).
- Optional kann `config.showOnlyNonEmptyFields` gesetzt werden (Boolean): blendet leere Felder im Sidebar-Editor aus.
- Optional kann `config.hierarchyFields` gesetzt werden (Liste von Feldschlüsseln für hierarchische Navigation, Legacy-Formen bleiben kompatibel).
- Optional kann `config.firstLevelStaticList` gesetzt werden (Liste fixer Level-1-Werte, nur relevant zusammen mit `hierarchyFields`).
- Für `wikidata-autosuggest.prioritize` gelten folgende `defs`-Formen:
  - `claimPresence.defs`: Liste aus Objekten `{ propertyId, propertyLabel }` (Legacy-Stringeinträge bleiben kompatibel)
  - `claimValueMatch.defs`: Liste aus Objekten `{ property, value, label }` (`label` dient der Anzeige)
- Optional kann `autosuggest.prefillWith` gesetzt werden (String):
  - muss auf ein vorhandenes Feld in `config.fields` verweisen
  - das referenzierte Feld muss vom Typ `normal` sein
  - der Wert wird beim Öffnen eines Items in die Autosuggest-Eingabe übernommen
  - automatische Suche startet nur, wenn im aktuellen Feld noch keine Entity ausgewählt wurde
- Optional kann `autosuggest.alsoGetDataFrom` gesetzt werden (Legacy-String `P...` oder Repeater-Liste):
  - als Repeater-Liste: Objekte `{ propertyId, label }` (alternativ kompatibel: `{ property, propertyLabel }`)
  - alle gesetzten Property-IDs müssen gültige Wikidata-Property-IDs sein (z. B. `P31`)
  - beim Auswählen einer Suggestion werden rohe Statement-Daten für jede konfigurierte Property nachgeladen
  - die Daten werden im selektierten Entity-Objekt unter `statementData[PROPERTY_ID]` gespeichert
  - falls `statementData` vorhanden ist, kann es im UI pro selektierter Entity auf- und zugeklappt als JSON angezeigt werden
- Beim Auswählen einer Wikidata-Entity werden Label/Description zweisprachig mitgeführt und gespeichert:
  - `labels: { de: string, en: string }`
  - `descriptions: { de: string, en: string }`
  - die bisherigen Top-Level-Felder `label` und `description` bleiben aus Kompatibilitätsgründen weiterhin erhalten

## Replacements (JSON)

- Falls die importierte JSON-Datei ein `replacements`-Objekt enthält, wird es unverändert mitgenommen und beim JSON-Export wieder geschrieben.
- Struktur: `replacements[feldschlüssel][suchtext] = ersetzungstext`. Der Schlüssel `allFields` steht für "alle Felder".
- **Ersetzungen werden vom Viewer nicht auf die Daten angewendet.** Sie werden nur gesammelt, angezeigt und exportiert; die Anwendung ist Sache nachgelagerter Verarbeitung.
- `replacements` muss ein Objekt sein. Die Struktur innerhalb wird derzeit nicht weiter validiert.
- Beim CSV-Import oder Daten-Reset wird `replacements` zurückgesetzt.

## Speichern und Dateinamen

- Exportdateien erhalten den Suffix `-edited`.
- Optional kann ein Timestamp im Dateinamen aktiviert werden (`-edited-YYYY-MM-DD_hh-mm-ss`).

## Bedienung

- Die App ist in fünf Tabs gegliedert: `Editieren`, `Konfiguration`, `Ersetzungen`, `Einstellungen`, `Info`.
- Die Volltextsuche befindet sich im Bereich `Digitalisate` oberhalb der Karten- bzw. Listenansicht.
- `Escape` schließt die Start-From-Scratch-Modal und die Lightbox.
- `Escape` hebt außerdem eine aktive Sidebar-Auswahl auf.
- Im Online-Modus kann optional `Configuration only` aktiviert werden, um beim Start nur Settings (ohne Item-Requests) zu laden.
- Auch bei aktiviertem `Configuration only` wird die Settings-Config aus Strapi in die Konfigurations-Ansicht übernommen; nur Item-Requests bleiben aus.
