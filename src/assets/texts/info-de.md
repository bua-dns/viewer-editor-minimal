# So verwenden Sie das Tool

Diese Anwendung hilft beim Sichten und Bearbeiten von Item-Daten (JSON/CSV), inklusive Scan-Vorschau und konfigurierbarer Felder.

---

## 1) Modus wählen und Daten laden

- Die App kann im **Offline**- oder **Online**-Modus laufen (je nach Konfiguration).
- Im **Offline**-Modus wählen Sie **JSON** oder **CSV** und laden eine passende Datei hoch.
- Solange keine Daten geladen sind, können Sie **Mit Beispieldaten arbeiten** nutzen.
- Im **JSON**-Modus (vor dem Laden von Daten) können Sie mit **Neu beginnen** Datensätze aus Scan-URLs anlegen.

---

## 2) Einträge bearbeiten

- Im Tab **Editieren** suchen Sie über alle Felder.
- Wählen Sie einen Eintrag aus, um ihn rechts zu bearbeiten.
- Zeigt `scan` auf ein Bild, sehen Sie Vorschau und Lightbox.
- Mit Vor/Zurück wechseln Sie durch die gefilterte Liste.
- Mit **Bearbeitung aussetzen** können Sie Einträge vorerst zurückstellen.

---

## 3) Felder konfigurieren und Ersetzungen pflegen

- Im Tab **Konfiguration** fügen Sie Felder hinzu, entfernen sie, sortieren um und passen Labels/Platzhalter an.
- Unterstützte Typen: `normal`, `text`, `integer`, `checkbox`, `wikidata-autosuggest`.
- Mit **Konfiguration anwenden** wird die Struktur auf alle geladenen Daten angewendet.
- Im Tab **Ersetzungen** definieren Sie Ersetzungsregeln global oder feldspezifisch.

---

## 4) Optional: Datenbank verbinden (Online)

- Im Tab **Datenbankverbindung** pflegen und testen Sie Ihr Strapi-Verbindungsprofil.
- Im **Online**-Modus melden Sie sich an und laden Settings/Items aus Strapi.
- Lokaler Upload/Download ist im Online-Modus ausgeblendet.
- Mit **Änderungen speichern** senden Sie Bearbeitungen (inklusive neuer Entwürfe) an Strapi.

---

## 5) Sicher speichern

- Im Offline-Modus speichern Sie über **JSON herunterladen** oder **CSV herunterladen**.
- **JSON-Export** enthält Daten, Konfiguration, Ersetzungen und ausgesetzte Einträge.
- **CSV-Export** enthält nur Daten.
- **Reset** stellt den letzten Importstand wieder her und verwirft ungespeicherte Änderungen.
- Beim Schließen oder Neuladen ohne Speichern gehen ungespeicherte Änderungen verloren.
