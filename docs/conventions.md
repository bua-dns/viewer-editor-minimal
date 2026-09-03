# Konventionen bei der Nutzung des Viewer-Editors

## Angabe der Medien

- Quelle ist das Feld "scan" im Daten-JSON
- Dort muss eine URL zu einem Digitalisat hinterlegt sein
- Im Online-Modus kann die Quelle über den Settings-Schlüssel `scanField` auf ein anderes Strapi-Feld gelegt werden (z. B. `scan_url`); dessen Wert wird beim Laden nach `scan` gemappt. Ohne `scanField` gilt weiterhin `scan`.
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
- Das über `scanField` benannte Quellfeld ist damit ebenfalls reserviert und sollte nicht zusätzlich in `config.fields` konfiguriert werden.
- Alle übrigen Felder können über die Konfiguration als `normal`, `text`, `integer`, `checkbox`, `candidate` oder `wikidata-autosuggest` typisiert werden.
- Das globale Config-Feld `itemLabelField` kann auf einen vorhandenen Feldschlüssel zeigen und steuert dann die Item-Beschriftung in Karten-/Listenansicht.

## Konfiguration (JSON)

- Beim JSON-Export wird immer das kanonische Format `{ data, config, replacements, suspendedItems }` geschrieben.
- Im Online-Modus liegen `config` und `replacements` in getrennten Props der Viewer-Settings: `Konfiguration anwenden` schreibt nur `settings`, `Änderungen speichern` nur `replacements`.
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
- Optional kann `scanField` in den Online-Settings gesetzt werden (String, Legacy-Form `scan_field`): Feldschlüssel der Strapi-Collection, dessen Wert beim Laden nach `scan` gemappt wird. Default ist `scan`.
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

## Replacements

- Struktur: `replacements[feldschlüssel][suchtext] = ersetzungstext`. Der Schlüssel `allFields` steht für "alle Felder".
- `replacements` muss ein Objekt sein. Die Struktur innerhalb wird derzeit nicht weiter validiert.

### Ablage der Regeln

- **Offline:** Die Regeln kommen aus der importierten JSON-Datei und werden beim JSON-Export wieder geschrieben.
- **Online:** Die Regeln liegen in einem eigenen JSON-Prop `replacements` der Viewer-Settings in Strapi (nicht im `settings`-Objekt; Legacy-Form `settings.replacements` wird beim Lesen noch akzeptiert). Geschrieben werden sie zusammen mit den Item-Änderungen über `Änderungen speichern`. Damit gelten sie zentral für alle Nutzer dieser Strapi-Instanz.
- Beim CSV-Import wird `replacements` geleert, beim Daten-Reset auf den zuletzt geladenen Stand zurückgesetzt.

### Anwendung

- **Ersetzungen werden angewendet, sobald eine Regel hinzugefügt oder `Ersetzungen anwenden` geklickt wird** - ohne Vorschau und ohne Rückfrage. Das bloße Laden von Regeln ändert nichts.
- Offline wirkt ein Lauf auf die geladenen Datensätze, online auf die **gesamte Collection**: geladene Items ändern sich sofort sichtbar, alle übrigen werden nachgeladen und als ungespeicherte Änderungen vorgemerkt. Geschrieben wird erst mit `Änderungen speichern`.
- Es gibt kein Undo. Vor dem Speichern hilft nur `Reset`; das Entfernen einer Regel wirkt ausschließlich auf künftige Läufe.
- Gesucht wird **literal** (kein Regex), als **Teilzeichenkette** und **case-sensitiv**; ersetzt werden alle Vorkommen. Ein leerer Ersetzungstext löscht den Suchtext.
- Betroffen sind nur Felder der Typen `normal` und `text` mit String-Wert. Read-only-Felder sowie `scan`, `suspendEditing` und `__onlineMeta` bleiben unangetastet.
- `allFields` bedeutet: jedes konfigurierte Feld, das diese Bedingungen erfüllt. Aus der Konfiguration entfernte Felder sind nicht dabei.

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
