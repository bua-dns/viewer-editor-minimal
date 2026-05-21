# How to Use This Tool

This application helps you transcribe digitized records efficiently. It is designed especially for working with scanned index cards.

---

## Get Started with Sample Data

If you want to try the features first, you can load built-in sample data directly from the top control area.

You can work with data from either CSV or JSON files. If you load the sample data as CSV (default), the tool first shows only the scans. In the **Configuration** section, you can create fields for structured capture of the information shown on the cards. If you load data in JSON mode, a configuration is already included, and you can adjust or extend it.

When you click a scan, an editor opens on the right where you can enter the transcription.

At the end of your session, download your results using **Download CSV** (or **Download JSON**) to save them locally. By default, a timestamp is added to the filename on export. This gives you versioned files. To continue later, upload the latest version again.

This way, you can work across multiple sessions without needing a database. Only the scan URLs must remain reachable online.

---

## Edit Your Own Data

You can import your own files using **Upload CSV** (or **Upload JSON**). If you currently only have scans and want to start a new transcription project from scratch, this is a good workflow:

1. Create a CSV file

The file only needs one column named **scan** that contains the scan URLs. Those URLs must point to files available online.

The sample CSV file looks like this:

```csv
scan
https://files.berlin-university-collections.de/dummy-files/sample-card-1.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-2.jpg
https://files.berlin-university-collections.de/dummy-files/sample-card-3.jpg
```

Then use **Configuration** to add fields, apply the configuration, and begin transcribing. After applying configuration, exporting as **JSON** preserves both your data and configuration. To continue later, upload the latest JSON file and your configured input form will be restored automatically. If you export as CSV, only the data is saved, not the configuration settings.

Remember to download your work regularly. If you close the tool or reload the browser tab, unsaved input will be lost.
