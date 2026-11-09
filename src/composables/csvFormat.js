// CSV reading and writing shared by the data import, the export and the "start from scratch" URL list.
// Records are parsed in one pass, so a quoted cell may contain the delimiter, `""` and line breaks.

/** A cell is quoted when it contains the delimiter, a quote or a line break. */
export function toCsvCell(value) {
  const text = String(value ?? '')
  if (/[,"\n\r]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`
  }
  return text
}

function isBlankRecord(cells) {
  return cells.length === 1 && cells[0] === ''
}

// Collects cells and records while the text is read character by character.
function createRecordReader() {
  const reader = {
    records: [],
    cells: [],
    current: '',
    inQuotes: false,
    line: 1,
    recordLine: 1,
    endCell() {
      reader.cells.push(reader.current)
      reader.current = ''
    },
    endRecord() {
      reader.endCell()
      if (!isBlankRecord(reader.cells)) reader.records.push({ cells: reader.cells, lineNumber: reader.recordLine })
      reader.cells = []
    },
    lineBreak() {
      reader.line += 1
      if (reader.inQuotes) {
        reader.current += '\n'
        return
      }
      reader.endRecord()
      reader.recordLine = reader.line
    },
  }
  return reader
}

// `""` inside quotes is a literal quote; any other quote opens or closes a quoted section.
function readQuote(reader, source, index) {
  const isEscapedQuote = reader.inQuotes && source[index + 1] === '"'
  if (!isEscapedQuote) {
    reader.inQuotes = !reader.inQuotes
    return index
  }
  reader.current += '"'
  return index + 1
}

// Handles the character at `index`; returns the index of the last character consumed.
function readCharAt(reader, source, index, delimiter) {
  const char = source[index]
  if (char === '"') return readQuote(reader, source, index)
  // In `\r\n` the `\n` that follows is the line break.
  if (char === '\r' && source[index + 1] === '\n') return index
  if (char === '\n') {
    reader.lineBreak()
  } else if (char === delimiter && !reader.inQuotes) {
    reader.endCell()
  } else {
    reader.current += char
  }
  return index
}

/**
 * Splits CSV text into records. Returns `[{ cells, lineNumber }]`, `lineNumber` being the 1-based
 * line the record starts on. A line break (`\n` or `\r\n`) ends a record only outside quotes; inside
 * quotes it is kept as `\n`. Empty lines are skipped; cell values are not trimmed. Throws when a
 * quote is still open at the end of the text.
 */
export function parseCsvRecords(text, delimiter = ',') {
  const source = String(text ?? '').replace(/^\uFEFF/, '')
  const reader = createRecordReader()
  for (let index = 0; index < source.length; index += 1) {
    index = readCharAt(reader, source, index, delimiter)
  }

  // Without this check one stray quote would swallow the rest of the file into a single cell.
  if (reader.inQuotes) {
    throw new Error(`CSV: Anfuehrungszeichen ab Zeile ${reader.recordLine} wird nicht geschlossen.`)
  }
  reader.endRecord()
  return reader.records
}

/** The cells of a single CSV line (a record without line breaks). */
export function splitCsvLine(line, delimiter = ',') {
  const [record] = parseCsvRecords(line, delimiter)
  return record ? record.cells : ['']
}
