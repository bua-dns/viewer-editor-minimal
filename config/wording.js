//config\wording.js
const wording = {
  appTitle: {
    de: "Viewer-Editor für Findmittel",
    en: "Viewer Editor for Finding Aids",
  },
  itemsLabel: {
    de: "Items",
    en: "Items",
  },
  downloadWithTimestamp: {
    de: "Dateiname mit Timestamp",
    en: "Filename with timestamp",
  },
  uploadJson: {
    de: "JSON hochladen",
    en: "Upload JSON",
  },
  uploadCsv: {
    de: "CSV hochladen",
    en: "Upload CSV",
  },
  useSampleData: {
    de: "Mit Beispieldaten arbeiten",
    en: "Use sample data",
  },
  downloadJson: {
    de: "JSON herunterladen",
    en: "Download JSON",
  },
  startFromScratch: {
    de: "Neu beginnen",
    en: "Start from scratch",
  },
  startFromScratchScanPrompt: {
    de: "Scan-URL für neuen Datensatz eingeben (http/https):",
    en: "Enter scan URL for a new dataset (http/https):",
  },
  startFromScratchScanInvalid: {
    de: "Ungültige URL. Bitte eine absolute http/https-URL eingeben.",
    en: "Invalid URL. Please enter an absolute http/https URL.",
  },
  startFromScratchDialogTitle: {
    de: "Neu beginnen",
    en: "Start from scratch",
  },
  startFromScratchSingleMode: {
    de: "Einzelne URL",
    en: "Single URL",
  },
  startFromScratchCsvMode: {
    de: "URL-Liste (CSV)",
    en: "URL list (CSV)",
  },
  startFromScratchSingleLabel: {
    de: "Scan-URL",
    en: "Scan URL",
  },
  startFromScratchCsvLabel: {
    de: "CSV-Inhalt",
    en: "CSV content",
  },
  startFromScratchCsvPlaceholder: {
    de: "scan\nhttps://example.org/1.jpg\nhttps://example.org/2.jpg",
    en: "scan\nhttps://example.org/1.jpg\nhttps://example.org/2.jpg",
  },
  startFromScratchCsvHint: {
    de: "CSV mit Spalte 'scan' oder nur einer URL pro Zeile.",
    en: "CSV with 'scan' column or one URL per line.",
  },
  startFromScratchCsvUploadFile: {
    de: "CSV-Datei hochladen",
    en: "Upload CSV file",
  },
  startFromScratchCsvFileReadError: {
    de: "CSV-Datei konnte nicht gelesen werden.",
    en: "Could not read CSV file.",
  },
  startFromScratchCreate: {
    de: "Erstellen",
    en: "Create",
  },
  cancel: {
    de: "Abbrechen",
    en: "Cancel",
  },
  startFromScratchCsvEmpty: {
    de: "CSV ist leer.",
    en: "CSV is empty.",
  },
  startFromScratchNoUrls: {
    de: "Keine URLs im CSV gefunden.",
    en: "No URLs found in CSV.",
  },
  startFromScratchScanInvalidRow: {
    de: "Ungültige URL in Zeile",
    en: "Invalid URL in row",
  },
  downloadCsv: {
    de: "CSV herunterladen",
    en: "Download CSV",
  },
  dataModeJson: {
    de: "JSON",
    en: "JSON",
  },
  dataModeCsv: {
    de: "CSV",
    en: "CSV",
  },
  dataModeAria: {
    de: "Datenmodus wählen",
    en: "Choose data mode",
  },
  appTabsAria: {
    de: "App-Bereiche",
    en: "App sections",
  },
  tabEdit: {
    de: "Editieren",
    en: "Edit",
  },
  tabInfo: {
    de: "Info",
    en: "Info",
  },
  tabConfig: {
    de: "Konfiguration",
    en: "Configuration",
  },
  tabReplacements: {
    de: "Ersetzungen",
    en: "Replacements",
  },
  uploadModeMismatchError: {
    de: "Dateityp passt nicht zum gewählten Modus.",
    en: "File type does not match selected mode.",
  },
  sampleDataLoadError: {
    de: "Beispieldaten konnten nicht geladen werden.",
    en: "Could not load sample data.",
  },
  csvNotImplementedError: {
    de: "CSV-Import folgt im nächsten Schritt.",
    en: "CSV import will be implemented in the next step.",
  },
  reset: {
    de: "Reset",
    en: "Reset",
  },
  languageSwitchAria: {
    de: "Sprache wählen",
    en: "Choose language",
  },
  languageButtonDe: {
    de: "DE",
    en: "DE",
  },
  languageButtonEn: {
    de: "EN",
    en: "EN",
  },
  noFileLoaded: {
    de: "Noch keine Datei geladen",
    en: "No file loaded yet",
  },
  noDataLoaded: {
    de: "Noch keine Daten geladen",
    en: "No data loaded yet",
  },
  searchLabel: {
    de: "Suche",
    en: "Search",
  },
  searchPlaceholder: {
    de: "Volltext über alle Felder",
    en: "Full text across all fields",
  },
  unsavedChanges: {
    de: "Ungespeicherte Änderungen",
    en: "Unsaved changes",
  },
  configurationTitle: {
    de: "Konfiguration",
    en: "Configuration",
  },
  replacementsTitle: {
    de: "Ersetzungen",
    en: "Replacements",
  },
  field_label: {
    de: "Feld",
    en: "Field",
  },
  allFields: {
    de: "alle Felder",
    en: "all fields",
  },
  replace_string: {
    de: "Ersetze",
    en: "Replace",
  },
  replace_with: {
    de: "mit",
    en: "with",
  },
  add_to_replacements_list: {
    de: "zur Ersetzungsliste hinzufügen",
    en: "add to replacements list",
  },
  applyConfiguration: {
    de: "Konfiguration anwenden",
    en: "Apply configuration",
  },
  downloadConfiguration: {
    de: "Konfiguration herunterladen",
    en: "Download configuration",
  },
  addConfigurationField: {
    de: "Feld hinzufügen",
    en: "Add field",
  },
  addFieldNamePlaceholder: {
    de: "Feldname (z. B. bemerkung)",
    en: "Field name (e.g. note)",
  },
  addFieldButton: {
    de: "Hinzufügen",
    en: "Add",
  },
  removeFieldButton: {
    de: "Feld entfernen",
    en: "Remove field",
  },
  addFieldDuplicateError: {
    de: "Feld existiert bereits.",
    en: "Field already exists.",
  },
  addFieldEmptyError: {
    de: "Bitte einen gültigen Feldnamen eingeben.",
    en: "Please enter a valid field name.",
  },
  configFieldHeader: {
    de: "Feld",
    en: "Field",
  },
  configTypeHeader: {
    de: "Typ",
    en: "Type",
  },
  configLabelHeader: {
    de: "Beschriftung",
    en: "Label",
  },
  configPlaceholderHeader: {
    de: "Eingabehinweis",
    en: "Input hint",
  },
  configTypeNormal: {
    de: "normal (string)",
    en: "normal (string)",
  },
  configTypeText: {
    de: "Textfeld (text)",
    en: "Text area (text)",
  },
  configTypeInteger: {
    de: "Zahl (integer)",
    en: "Number (integer)",
  },
  configTypeCheckbox: {
    de: "Ja/Nein (checkbox)",
    en: "Yes/No (checkbox)",
  },
  configTypeWikidataAutosuggest: {
    de: "Wikidata Autosuggest",
    en: "Wikidata autosuggest",
  },
  configLabelInputPlaceholder: {
    de: "Label",
    en: "Label",
  },
  configHintInputPlaceholder: {
    de: "Hinweis",
    en: "Hint",
  },
  itemListLabelFieldLabel: {
    de: "Liste: Label-Feld",
    en: "List: label field",
  },
  itemListLabelFieldDefault: {
    de: "Standard (Nummer / inventory_number)",
    en: "Default (number / inventory_number)",
  },
  markAsEditedBasisLabel: {
    de: "Liste: Mark-as-edited Basis",
    en: "List: mark-as-edited basis",
  },
  markAsEditedBasisDefault: {
    de: "Keine Sortierung nach Bearbeitungsstand",
    en: "No edited-state sorting",
  },
  suspendEditingLabel: {
    de: "Bearbeitung aussetzen",
    en: "Suspend editing",
  },
  showOnlyNonEmptyFieldsLabel: {
    de: "Sidebar: Nur nicht-leere Felder anzeigen",
    en: "Sidebar: show non-empty fields only",
  },
  showOnlyNonEmptyFieldsToggle: {
    de: "Aktivieren",
    en: "Enable",
  },
  autosuggestConfigTitle: {
    de: "Autosuggest Optionen",
    en: "Autosuggest options",
  },
  autosuggestSearchLanguages: {
    de: "Suchsprachen",
    en: "Search languages",
  },
  autosuggestSearchLanguagesPlaceholder: {
    de: "de, en",
    en: "de, en",
  },
  autosuggestResultLanguage: {
    de: "Ergebnis-Sprache",
    en: "Result language",
  },
  autosuggestResultLanguagePlaceholder: {
    de: "de",
    en: "de",
  },
  autosuggestMinChars: {
    de: "Minimale Zeichen",
    en: "Minimum characters",
  },
  autosuggestLimit: {
    de: "Trefferlimit",
    en: "Result limit",
  },
  autosuggestAlsoGetDataFrom: {
    de: "Statement-Daten zusaetzlich laden aus",
    en: "Also get statement data from",
  },
  autosuggestAlsoGetDataFromPlaceholder: {
    de: "P31",
    en: "P31",
  },
  autosuggestClaimPresenceTitle: {
    de: "claimPresence",
    en: "claimPresence",
  },
  autosuggestClaimValueMatchTitle: {
    de: "claimValueMatch",
    en: "claimValueMatch",
  },
  autosuggestWeight: {
    de: "Gewicht",
    en: "Weight",
  },
  autosuggestDefs: {
    de: "Definitionen",
    en: "Definitions",
  },
  autosuggestClaimPresenceDefsPlaceholder: {
    de: "P7715, P227",
    en: "P7715, P227",
  },
  autosuggestIncludeInEmitData: {
    de: "Metadaten in Auswahl speichern",
    en: "Include metadata in emitted selection",
  },
  autosuggestShowInSuggestion: {
    de: "Metadaten in Vorschlaegen anzeigen",
    en: "Show metadata in suggestions",
  },
  autosuggestProperty: {
    de: "Property",
    en: "Property",
  },
  autosuggestValue: {
    de: "Value",
    en: "Value",
  },
  autosuggestPropertyPlaceholder: {
    de: "P31",
    en: "P31",
  },
  autosuggestPropertyId: {
    de: "Property ID",
    en: "Property ID",
  },
  autosuggestPropertyIdPlaceholder: {
    de: "P713",
    en: "P713",
  },
  autosuggestPropertyLabel: {
    de: "Property Label",
    en: "Property label",
  },
  autosuggestPropertyLabelPlaceholder: {
    de: "Strunz 10",
    en: "Strunz 10",
  },
  autosuggestValuePlaceholder: {
    de: "Q5",
    en: "Q5",
  },
  autosuggestLabel: {
    de: "Label",
    en: "Label",
  },
  autosuggestLabelPlaceholder: {
    de: "Mensch",
    en: "Human",
  },
  autosuggestAddDefinition: {
    de: "Definition hinzufügen",
    en: "Add definition",
  },
  autosuggestOptions: {
    de: "Optionen",
    en: "Options",
  },
  autosuggestShowOptions: {
    de: "Optionen anzeigen",
    en: "Show options",
  },
  listEmptyAfterUpload: {
    de: "Nach dem Upload erscheinen hier die Einträge.",
    en: "Entries appear here after upload.",
  },
  noSearchResults: {
    de: "Keine Treffer zur Suchanfrage.",
    en: "No matches for this search.",
  },
  scanPreviewAlt: {
    de: "Scan-Vorschau",
    en: "Scan preview",
  },
  scanUnavailable: {
    de: "Scan nicht verfügbar",
    en: "Scan unavailable",
  },
  sidebarPreviousItemAria: {
    de: "Vorheriger Eintrag",
    en: "Previous entry",
  },
  sidebarNextItemAria: {
    de: "Nächster Eintrag",
    en: "Next entry",
  },
  sidebarScanCounterPrefix: {
    de: "Item",
    en: "Item",
  },
  sidebarCloseAria: {
    de: "Sidebar schließen",
    en: "Close sidebar",
  },
  sidebarExtendAria: {
    de: "Editierbereich auf volle Breite erweitern",
    en: "Expand edit area to full width",
  },
  sidebarCollapseAria: {
    de: "Editierbereich auf Standardbreite reduzieren",
    en: "Collapse edit area to default width",
  },
  sidebarExtendLabel: {
    de: "Volle Breite",
    en: "Full width",
  },
  sidebarCollapseLabel: {
    de: "Standardbreite",
    en: "Default width",
  },
  statusFilePrefix: {
    de: "Datei",
    en: "File",
  },
  uploadPrompt: {
    de: "Bitte eine JSON-Datei hochladen.",
    en: "Please upload a JSON file.",
  },
  fullscreen: {
    de: "Vollbild",
    en: "Full screen",
  },
  close: {
    de: "Schließen",
    en: "Close",
  },
  lightboxImageAlt: {
    de: "Scan groß",
    en: "Large scan",
  },
  resetConfirm: {
    de: "Änderungen verwerfen und auf Import zurücksetzen?",
    en: "Discard changes and reset to imported data?",
  },
  footerIdentityCredit: {
    de: "Ein Tool von Digitales Netzwerk Sammlungen<br>Berlin University Alliance",
    en: "A tool by the Digital Network for Collections<br>Berlin University Alliance",
  },
  footerGithubAria: {
    de: "GitHub-Repository",
    en: "GitHub repository",
  },
  footerBucAria: {
    de: "Berlin University Collections",
    en: "Berlin University Collections",
  },
}

export default wording
