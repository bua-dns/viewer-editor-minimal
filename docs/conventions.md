# Konventionen bei der Nutzung des Viewer-Editors

## Angabe der Medien

- Quelle ist das Feld "scan" im Daten-JSON
- Dort muss eine URL zu einem Digitalisat hinterlegt sein

## Datenformate

- Der Datenmodus (JSON/CSV) muss zum hochgeladenen Dateityp passen.
- JSON akzeptiert entweder ein Top-Level-Array oder ein Objekt mit `data`-Array.
- CSV erwartet eine Header-Zeile, danach Datensaetze.
- Spaltennamen in CSV muessen eindeutig sein und duerfen nicht leer sein.
- Wenn noch keine Datei geladen ist, koennen alternativ passende Beispieldaten je Modus geladen werden.

## Feldkonventionen

- Das Feld `scan` ist fuer die Bildvorschau reserviert.
- Fuer die automatische Vorschau sollte `scan` auf eine direkt ladbare Bild-URL zeigen (`.png`, `.jpg`, `.jpeg`, `.webp`, `.gif`, `.avif`).
- Alle uebrigen Felder koennen ueber die Konfiguration als `normal`, `text`, `integer` oder `checkbox` typisiert werden.

## Konfiguration (JSON)

- Beim JSON-Export wird immer das kanonische Format `{ data, config }` geschrieben.
- `config.fields` muss ein Objekt sein, dessen Schluessel den Feldnamen entsprechen.
- Pro Feld sind folgende Eigenschaften vorgesehen: `type`, `label`, `order`, `placeholder`.

## Replacements (JSON)

- Falls die importierte JSON-Datei ein `replacements`-Objekt enthaelt, wird es unveraendert mitgenommen und beim JSON-Export wieder geschrieben (`{ data, config, replacements }`).
- `replacements` muss ein Objekt sein. Die Struktur innerhalb wird derzeit nicht weiter validiert.
- Beim CSV-Import oder Daten-Reset wird `replacements` zurueckgesetzt.

## Speichern und Dateinamen

- Exportdateien erhalten den Suffix `-edited`.
- Optional kann ein Timestamp im Dateinamen aktiviert werden (`-edited-YYYY-MM-DD_hh-mm-ss`).

## Bedienung

- Die App ist in zwei Tabs gegliedert: `Editieren` (Arbeitsbereich) und `Info` (Kurzanleitung).
- Die Volltextsuche befindet sich im Bereich `Digitalisate` oberhalb der Kartenliste.
- `Escape` schliesst die Lightbox.
- `Escape` hebt ausserdem eine aktive Sidebar-Auswahl auf.
