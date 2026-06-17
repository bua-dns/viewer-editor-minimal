# Wie Sie dieses Tool verwenden

Diese Anwendung dient zur Transkription von Daten mit Scan-URLs (zum Beispiel gescannte Karteikarten). Sie läuft komplett im Browser.

---

## 1) Daten laden oder neu anlegen

- Wählen Sie oben über den Modus-Schalter **JSON** oder **CSV**.
- Der Dateityp beim Upload muss zum ausgewählten Modus passen.
- Solange noch kein Datensatz geladen ist, können Sie **Mit Beispieldaten arbeiten** nutzen.
- Im **JSON**-Modus (und nur vor dem Laden von Daten) steht **Neu beginnen** zur Verfügung. Damit können Sie einen neün Datensatz anlegen aus:
  - einer einzelnen Scan-URL oder
  - einer CSV-Liste mit Scan-URLs.

Beispiel für eine CSV mit Scan-URLs:

```csv
scan
https://files.berlin-university-collections.de/dummy-files/sample-card-1.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-2.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-3.jpg
```

---

## 2) Einträge bearbeiten

- Im Tab **Edit** filtern Sie über die Suche gleichzeitig über alle Felder.
- Mit Klick auf einen Eintrag öffnet sich rechts der Editor.
- Wenn die Scan-URL auf ein Bild zeigt, sehen Sie eine Vorschau und können es in einer Lightbox vergrössern.
- Mit den Vor-/Zurück-Buttons wechseln Sie durch die gefilterten Einträge.

---

## 3) Felder konfigurieren

Im Tab **Configuration** können Sie:

- Felder hinzufügen, entfernen und per Drag-and-Drop umsortieren,
- Feld-Labels und Platzhaltertexte pflegen,
- Feldtypen wählen: `normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`.

Mit **Konfiguration anwenden** wird die bearbeitbare Struktur der geladenen Daten aktualisiert.

---

## 4) Ersetzungen verwalten

- Im Tab **Replacements** legen Sie Ersetzungsregeln an - für alle Felder oder gezielt für ein Feld.
- Ersetzungen werden im JSON-Export gespeichert.

---

## 5) Speichern und später weiterarbeiten

- Speichern Sie den aktüllen Stand über **CSV herunterladen** oder **JSON herunterladen**.
- Der Download ist aktiv, sobald ungespeicherte Änderungen vorhanden sind.
- Standardmässig wird ein Timestamp an den Dateinamen angehängt (Versionierung).
- **Reset** setzt auf den importierten Stand zurück und verwirft ungespeicherte Änderungen.

Wichtig:

- **JSON-Export** enthält Daten, Konfiguration und Ersetzungen.
- **CSV-Export** enthält nur Daten.
- Wenn Sie das Tool schliessen oder die Seite neu laden, gehen nicht gespeicherte Änderungen verloren.
