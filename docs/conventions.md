# Konventionen bei der Nutzung des Viewer-Editors

## Angabe der Medien

- Quelle ist das Feld "scan" im Daten-JSON
- Dort muss eine URL zu einem Digitalisat hinterlegt sein
- Wenn kein `scan`-Feld vorhanden ist, arbeitet die App automatisch im No-Scans-Modus mit textbasierter Item-Liste.

## Datenformate

- Der Datenmodus (JSON/CSV) muss zum hochgeladenen Dateityp passen.
- JSON akzeptiert entweder ein Top-Level-Array oder ein Objekt mit `data`-Array.
- CSV erwartet eine Header-Zeile, danach Datensaetze.
- Spaltennamen in CSV muessen eindeutig sein und duerfen nicht leer sein.
- Signifikante Leerzeichen in CSV-Feldwerten bleiben erhalten; nur Zeilenumbrueche/CRLF-Terminatoren werden entfernt.
- Wenn noch keine Datei geladen ist, koennen alternativ passende Beispieldaten je Modus geladen werden.

## Feldkonventionen

- Das Feld `scan` ist fuer die Bildvorschau reserviert.
- Fuer die automatische Vorschau sollte `scan` auf eine direkt ladbare Bild-URL zeigen (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`).
- Alle uebrigen Felder koennen ueber die Konfiguration als `normal`, `text`, `integer`, `checkbox` oder `wikidata-autosuggest` typisiert werden.
- Das globale Config-Feld `itemLabelField` kann auf einen vorhandenen Feldschluessel zeigen und steuert dann die Item-Beschriftung in Karten-/Listenansicht.

## Konfiguration (JSON)

- Beim JSON-Export wird immer das kanonische Format `{ data, config, replacements, suspendedItems }` geschrieben.
- `config.fields` muss ein Objekt sein, dessen Schluessel den Feldnamen entsprechen.
- Pro Feld sind folgende Eigenschaften vorgesehen: `type`, `label`, `order`, `placeholder`, `hint`.
- Fuer Nicht-`wikidata-autosuggest`-Felder ist zusaetzlich `readOnly` (Boolean) erlaubt.
- Fuer `wikidata-autosuggest` ist `readOnly` nicht erlaubt; stattdessen ist optional `autosuggest` als pass-through Objekt vorgesehen.
- Optional kann `config.itemLabelField` gesetzt werden (String, muss ein vorhandener Schluessel in `config.fields` sein).
- Fuer `wikidata-autosuggest.prioritize` gelten folgende `defs`-Formen:
  - `claimPresence.defs`: Liste aus Objekten `{ propertyId, propertyLabel }` (Legacy-Stringeintraege bleiben kompatibel)
  - `claimValueMatch.defs`: Liste aus Objekten `{ property, value, label }` (`label` dient der Anzeige)
- Optional kann `autosuggest.prefillWith` gesetzt werden (String):
  - muss auf ein vorhandenes Feld in `config.fields` verweisen
  - das referenzierte Feld muss vom Typ `normal` sein
  - der Wert wird beim Oeffnen eines Items in die Autosuggest-Eingabe uebernommen
  - automatische Suche startet nur, wenn im aktuellen Feld noch keine Entity ausgewaehlt wurde
- Optional kann `autosuggest.alsoGetDataFrom` gesetzt werden (Legacy-String `P...` oder Repeater-Liste):
  - als Repeater-Liste: Objekte `{ propertyId, label }` (alternativ kompatibel: `{ property, propertyLabel }`)
  - alle gesetzten Property-IDs muessen gueltige Wikidata-Property-IDs sein (z. B. `P31`)
  - beim Auswaehlen einer Suggestion werden rohe Statement-Daten fuer jede konfigurierte Property nachgeladen
  - die Daten werden im selektierten Entity-Objekt unter `statementData[PROPERTY_ID]` gespeichert
  - falls `statementData` vorhanden ist, kann es im UI pro selektierter Entity auf- und zugeklappt als JSON angezeigt werden
- Beim Auswaehlen einer Wikidata-Entity werden Label/Description zweisprachig mitgefuehrt und gespeichert:
  - `labels: { de: string, en: string }`
  - `descriptions: { de: string, en: string }`
  - die bisherigen Top-Level-Felder `label` und `description` bleiben aus Kompatibilitaetsgruenden weiterhin erhalten

## Replacements (JSON)

- Falls die importierte JSON-Datei ein `replacements`-Objekt enthaelt, wird es unveraendert mitgenommen und beim JSON-Export wieder geschrieben (`{ data, config, replacements }`).
- `replacements` muss ein Objekt sein. Die Struktur innerhalb wird derzeit nicht weiter validiert.
- Beim CSV-Import oder Daten-Reset wird `replacements` zurueckgesetzt.

## Speichern und Dateinamen

- Exportdateien erhalten den Suffix `-edited`.
- Optional kann ein Timestamp im Dateinamen aktiviert werden (`-edited-YYYY-MM-DD_hh-mm-ss`).

## Bedienung

- Die App ist in vier Tabs gegliedert: `Editieren`, `Konfiguration`, `Ersetzungen`, `Info`.
- Die Volltextsuche befindet sich im Bereich `Digitalisate` oberhalb der Karten- bzw. Listenansicht.
- `Escape` schliesst die Start-From-Scratch-Modal und die Lightbox.
- `Escape` hebt ausserdem eine aktive Sidebar-Auswahl auf.
