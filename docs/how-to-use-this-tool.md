# Bedienungsanleitung Viewer-Editor

Für Menschen, die mit dem Viewer-Editor **arbeiten**: Daten sichten, bearbeiten, speichern. Wie das
Tool innen gebaut ist, steht in der [technischen Dokumentation](technical-documentation.md); welche
Datenformate und Feldnamen erwartet werden, in den [Konventionen](conventions.md).

## Was das Tool macht

Der Viewer-Editor zeigt eine Liste von Objekten (Items) mit ihrem Digitalisat (Scan) und lässt Sie die
Angaben zu jedem Objekt bearbeiten. Die Daten kommen entweder aus einer Datei auf Ihrem Rechner
(**Offline**) oder aus einer Strapi-Datenbank (**Online**). Offline laden Sie das Ergebnis als Datei
herunter, online speichern Sie direkt in die Datenbank.

Die App hat fünf Tabs:

| Tab | Wofür |
|---|---|
| `Editieren` | Liste durchsuchen, Objekt auswählen, Felder bearbeiten |
| `Konfiguration` | festlegen, welche Felder es gibt und wie sie aussehen |
| `Ersetzungen` | Suchen-und-Ersetzen-Regeln für Feldwerte |
| `Einstellungen` | Datenbankverbindung und Darstellung (Sprache, Farbe) |
| `Info` | Kurzanleitung in der App |

## Offline arbeiten: mit einer Datei

1. Oben `Offline` wählen und den Datenmodus `JSON` oder `CSV` passend zu Ihrer Datei.
2. `JSON hochladen` bzw. `CSV hochladen` und die Datei wählen. Zum Ausprobieren gibt es
   `Mit Beispieldaten arbeiten`.
3. Im Tab `Editieren` ein Objekt in der Liste anklicken und rechts die Felder bearbeiten.
4. Am Ende `JSON herunterladen` (oder `CSV herunterladen`). Die Datei heißt wie die geladene, mit dem
   Zusatz `-edited`; mit `Dateiname mit Timestamp` kommen Datum und Uhrzeit dazu.

**Wichtig:** Offline wird nichts automatisch gespeichert. Schließen oder Neuladen der Seite verwirft
alles, was Sie nicht heruntergeladen haben (der Browser fragt vorher nach).

Was in der Datei landet:

| Export | Enthält |
|---|---|
| JSON | Daten, Feldkonfiguration, Ersetzungsregeln, ausgesetzte Einträge, Viewer-Einstellungen |
| CSV | nur die Daten |

Wenn Sie später weiterarbeiten wollen, nehmen Sie JSON: Die Datei bringt beim nächsten Laden ihre
Konfiguration wieder mit.

### Ohne Daten anfangen

- `Neu beginnen` (im JSON-Modus, solange nichts geladen ist) legt Datensätze aus Scan-URLs an: eine
  einzelne URL oder eine Liste (CSV mit Spalte `scan` oder eine URL pro Zeile).
- Oder Sie legen im Tab `Konfiguration` erst die Felder an, `Konfiguration anwenden`, und erzeugen dann
  im Tab `Editieren` mit `Neues Item` Einträge.

## Online arbeiten: mit der Datenbank

1. Einmalig im Tab `Einstellungen` das Verbindungsprofil eintragen (Base URL der Strapi-Instanz und den
   Pfad zum Konfig-Endpunkt; beides erhalten Sie von der Betreuung des Projekts), `Verbindung testen`,
   dann `Profil speichern`. In manchen Installationen ist die Verbindung fest vorgegeben; dann entfällt
   dieser Schritt.
2. Oben `Online` wählen und mit E-Mail bzw. Username und Passwort `Anmelden`.
3. Die App lädt die Konfiguration und die Objekte. Bei großen Beständen erscheinen zuerst Kategorien
   (siehe [Kategorien](#kategorien-hierarchie)).
4. Bearbeiten wie offline. Geänderte Objekte werden gezählt (`Ungespeicherte Online-Änderungen in
   Items`).
5. Speichern:
   - `Änderungen speichern` schreibt alle Änderungen und geänderte Ersetzungsregeln in die Datenbank;
   - `Item speichern` im Kopf des Bearbeitungsbereichs speichert nur das gerade offene Objekt.

`Nur Konfiguration laden (keine Items)` lädt nach der Anmeldung nur die Konfiguration, ohne Objekte;
gedacht für Arbeiten im Tab `Konfiguration`.

Datei-Upload und -Download sind online ausgeblendet; die Daten liegen in der Datenbank.

### Ungespeicherte Änderungen

Abmelden, der Wechsel nach `Offline`, `Nur Konfiguration laden`, ein geändertes Verbindungsprofil und der
Wechsel in eine andere Kategorie würden ungespeicherte Online-Änderungen verwerfen. Die App fragt deshalb
vorher: `Ungespeicherte Online-Änderungen werden verworfen. Fortfahren?` Mit *Abbrechen* bleibt alles,
wie es ist. Speichern Sie im Zweifel vorher.

### Wenn jemand anderes gleichzeitig arbeitet

Vor dem Schreiben prüft die App jedes Objekt: Hat jemand anderes **dasselbe Feld** seit Ihrem Laden
geändert, wird dieses Objekt nicht geschrieben und die Meldung nennt die Felder (`… changed on the server
since loading`). Ihre Änderungen bleiben erhalten, und der Wert des anderen ist jetzt der Vergleichswert.
Prüfen Sie das Feld und speichern Sie noch einmal, wenn Ihr Wert gelten soll; dann wird bewusst
überschrieben. Änderungen anderer an *anderen* Feldern stören nicht.

### Neue Objekte

`Neues Item` legt ein leeres Objekt an. Es entsteht in der Datenbank erst beim Speichern.

## Im Tab Editieren

- **Suchen:** Das Suchfeld durchsucht alle Felder, ab drei Zeichen.
- **Blättern:** Mit Vor/Zurück im Bearbeitungsbereich wechseln Sie durch die (gefilterte) Liste.
- **Scan ansehen:** Klick auf das Bild öffnet die Großansicht, dort gibt es `Vollbild`.
- **Breiter bearbeiten:** `Volle Breite` vergrößert den Bearbeitungsbereich.
- **Zurückstellen:** `Bearbeitung aussetzen` markiert ein Objekt, um es später zu bearbeiten; es wandert
  in der Liste nach hinten.
- **Bearbeitet-Markierung:** Ist in der Konfiguration ein Feld als `Mark-as-edited Basis` gewählt, gelten
  Objekte mit einem Wert in diesem Feld als bearbeitet und bekommen ein Stift-Symbol. `Bearbeitete
  zuerst` dreht die Sortierung um.
- **Vorschläge übernehmen:** Ein Feld mit Vorschlag (aus einem anderen Feld oder einem Kandidat-Feld)
  zeigt den Wert grau; mit dem Haken oder Enter übernehmen, oder einfach selbst tippen.
- **Wikidata-Felder:** Tippen startet die Suche in Wikidata; einen Treffer auswählen.
- `Escape` schließt die Großansicht und hebt die Auswahl auf.

### Kategorien (Hierarchie)

Ist eine Hierarchie konfiguriert, zeigt die Liste zuerst Kästen für die erste Ebene, mit der Anzahl der
Objekte. Ein Klick öffnet die Kategorie; darunter sind die Objekte nach der zweiten Ebene gruppiert und
einklappbar. `Ohne Zuordnung` sammelt Objekte ohne Wert in der ersten Ebene. Vor/Zurück bleibt innerhalb
der gewählten Kategorie.

Online wird eine Kategorie erst beim Anklicken geladen. Mit dem Schalter `Gesamter Bestand` und `Suchen`
durchsuchen Sie alle Kategorien auf einmal; `Zurück zu den Kategorien` beendet die Trefferansicht. Felder,
die der Server nicht durchsuchen kann, nennt die Zeile `Auf dem Server nicht durchsucht:`.

## Felder konfigurieren (Tab Konfiguration)

- `Feld hinzufügen`: aus den Daten, online aus dem Datenmodell der Datenbank, oder mit eigenem Namen.
- Je Feld: Typ, Beschriftung, Eingabehinweis, Hinweis, Feldbreite (33 / 50 / 100 %), Reihenfolge per
  Ziehen, ausblenden, schreibgeschützt.
- Typen: `normal` (einzeilig), `Textfeld` (mehrzeilig), `Zahl`, `Ja/Nein`, `Kandidat` (ein Vorschlag, den
  man in ein Ziel-Feld übernimmt), `Wikidata Autosuggest`.
- Für die ganze Liste: welches Feld als Titel erscheint, die `Mark-as-edited Basis`, `Nur nicht-leere
  Felder anzeigen`, die Hierarchie-Felder und eine feste Reihenfolge der Kästen der ersten Ebene.
- **Erst `Konfiguration anwenden` wirkt.** Entfernte Felder verschwinden dann auch aus den geladenen
  Daten, neue werden in allen Objekten leer angelegt.
- Online schreibt `Konfiguration anwenden` die Konfiguration sofort in die Datenbank; sie gilt dann für
  alle, die mit dieser Collection arbeiten.
- `Konfiguration herunterladen` speichert nur die Konfiguration als Datei.

## Ersetzungen (Tab Ersetzungen)

Eine Regel ersetzt einen Text durch einen anderen, wörtlich und mit Groß-/Kleinschreibung, entweder in
allen Feldern oder in einem bestimmten Feld. Ein leerer Ersetzungstext löscht den gesuchten Text.

- Eine neue Regel wird beim Hinzufügen sofort angewendet; `Ersetzungen anwenden` wendet alle Regeln
  erneut an. Die Statuszeile sagt, wie viele Objekte und Felder sich geändert haben.
- Berücksichtigt werden nur Felder vom Typ `normal` und `Textfeld`, keine sichtbaren schreibgeschützten.
- Offline wirken die Regeln auf die geladenen Daten und gehen mit dem JSON-Export in die Datei.
- Online wirken sie auf die **ganze Collection** in der Datenbank, nicht nur auf die geöffnete Kategorie,
  und werden mit `Änderungen speichern` geschrieben. Speichern Sie danach, bevor Sie die Kategorie
  wechseln; sonst fragt die App, ob die Änderungen verworfen werden sollen.

## Items ableiten (nur online, wenn eingerichtet)

Aus einem Objekt ein neues, verknüpftes Objekt in einer anderen Collection anlegen, zum Beispiel einen
Beleg aus einem Holzmuster:

1. Objekt auswählen, im Bearbeitungsbereich den Button zum Ableiten klicken (die Beschriftung legt die
   Regel fest, Standard `Item ableiten`).
2. Die Vorschau zeigt, welche Werte übernommen werden. Gibt es ungespeicherte Änderungen, werden sie
   zuerst gespeichert.
3. `Item anlegen`.

Welche Felder übertragen werden, legt die Regel im Tab `Konfiguration` unter `Items ableiten` fest.
`Regel speichern` schreibt sie sofort für alle Nutzer der Datenbank.

## Darstellung (Tab Einstellungen)

Unter `Viewer-Einstellungen` stellen Sie Sprache, Sprachmodus und Primärfarbe für die geöffnete
Datenquelle ein: `Auf Datenquelle anwenden` speichert sie offline in der JSON-Datei, online in der
Datenbank. `Werte der Grundkonfiguration verwenden` nimmt die Vorgaben der Installation zurück.

## Wenn etwas nicht klappt

| Problem | Was tun |
|---|---|
| `Dateityp passt nicht zum gewählten Modus.` | Den Datenmodus (`JSON` / `CSV`) an die Datei anpassen und neu laden. |
| Fehlermeldung unter der Liste nach dem Laden einer Datei (z. B. `JSON ist ungueltig`, `JSON-Config ist ungueltig: …`) | Die Datei ist kaputt oder ihre eingebettete Konfiguration ungültig. Nichts wurde geladen, Ihr bisheriger Stand ist unverändert. Die Meldung nennt die Stelle; Datei korrigieren oder eine andere wählen. |
| `Für den Online-Modus wird ein gespeichertes Verbindungsprofil benötigt.` | Im Tab `Einstellungen` ein Profil speichern (siehe [Online arbeiten](#online-arbeiten-mit-der-datenbank)). |
| `Anmeldung fehlgeschlagen.` | Zugangsdaten prüfen; ein Konto für den Viewer-Editor vergibt die Betreuung des Projekts. |
| `Online-Konfiguration konnte nicht geladen werden.` | `Verbindung testen` im Tab `Einstellungen`. Schlägt der Test fehl, stimmt die Base URL nicht oder der Server ist nicht erreichbar. |
| `Online-Änderungen konnten nicht gespeichert werden.` | Die Meldung nennt die Objekte. Nichts geht verloren; `Speichern erneut versuchen`. Bei einem Konflikt siehe [gleichzeitig arbeiten](#wenn-jemand-anderes-gleichzeitig-arbeitet). |
| Meldung, ein neues Objekt sei vielleicht schon angelegt (Verbindung abgebrochen) | Erst in der Liste nachsehen, ob es das Objekt gibt, dann erneut speichern, sonst entsteht es doppelt. |
| `Die Regel kennt die Struktur von … nicht.` beim Ableiten | Jemand mit Zugriff auf das Strapi-Datenmodell öffnet die Regel im Tab `Konfiguration` und speichert sie einmal neu. |
| `Die Feldliste stammt aus einem Beispiel-Eintrag und ist möglicherweise unvollständig.` | Ihre Rolle darf das Datenmodell nicht lesen; Felder ggf. mit eigenem Namen hinzufügen oder die Betreuung um die Berechtigung bitten. |
| Eine Änderung ist nach dem Neuladen weg | Offline: vor dem Schließen herunterladen. Online: vor dem Schließen speichern. |
