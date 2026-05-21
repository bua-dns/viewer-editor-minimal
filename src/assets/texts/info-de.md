# Wie Sie dieses Tool verwenden

Diese Anwendung ermöglicht es Ihnen, Digitalisate effizient zu transkribieren. Es wurde besonders für die Arbeit mit gescannten Karteikarten entwickelt.

---

## Mit Beispieldaten starten

Wenn Sie die Funktionen erst einmal ausprobieren moechten, koennen Sie integrierte Beispieldaten direkt ueber den oberen Steuerungsbereich laden.

Sie können prinzipiell mit Daten aus einer CSV- oder einer JSON-Datei arbeiten. Wenn Sie die Beispieldaten als CSV laden (Voreinstellung) zeigt das Tool zunächst nur die Scans an. Im Bereich **Konfiguration** können Sie nun Felder anlegen, die für die strukturiere Erfassung der auf den Karten verzeichneten Informationen geeignet sind. Wenn Sie die Daten im JSON-Modus laden, ist bereits eine Konfiguration gegen, die sie anpassen und erweitern können.

Wenn Sie auf einen der Scans klicken, öffnet sich rechts ein Editor, in dem Sie die Transkription durchführen können.

Am Ende Ihrer Bearbeituns-Sitzung laden Sie die Ergebnisse über den Button **CSV herunterladen** (bzw. **JSON herunterladen**) lokal auf Ihrem Rechner abspeichern. Standardmäßig wird beim Abspeichern ein Timestamp an den Dateinnamen angehängt. Damit ist die Bearbeitung versioniert. Zum Weiterarbeiten laden Sie die letzte Version wieder hoch.

Auf diese Weise können Sie über mehrere Sitzungen hinweg an Ihrer Transkription arbeiten, ohne eine Datenbank zu benötigen. Nur die Scans müssen online erreichbar sein.

---

## Eigene Daten bearbeiten

Sie können Ihre eigenen Dateien einfach Über den Button **CSV hochladen** (bzw. **JSON hochladen**) importieren. Sollten Sie bislang lediglich Scans haben und möchten ganz frisch mit einem Transkriptionsprojekt beginnen, gehen Sie am besten wie folgt vor:

1. CSV-Datei erstellen

Die Datei muss lediglich eine Spalte enthalten die **scan** überschrieben ist und die URLs zu den Scans enthält. Diese müssen also an einer online verfügbaren Adresse abgelegt sein.

Die CSV-Datei der Beispieldaten sieht so aus:

```csv
scan
https://files.berlin-university-collections.de/dummy-files/sample-card-1.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-2.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-3.jpg

```

Dann könnten Sie über **Konfiguration** Felder hinzufügen, die Konfiguration anwenden und mit der Transkription beginnen. Beim Abspeichern ist nach Konfiguration **JSON** eingestellt, sodass die Konfiguration mit den Nutzdaten abgespeichert wird. Zum Weiterarbeiten laden Sie die letzte Version der JSON-Datei wieder hoch und haben dann automatisch wieder die korrekt konfiguriere Erfassungsmaske. Speichern Sie hingegen als CSV ab, werden nur die Daten abgespeichert, nicht aber die Einstellungen der Konfiguration.

Denke Sie daran, Ihre Arbeitsergebnisse regelmäßig herunterzuladen. Wenn Sie das Tool schließen oder das Browserfenster neu laden, sind Ihre Eingaben verloren!
