import { describe, expect, test } from 'vitest'
import { parseCsvRecords, splitCsvLine, toCsvCell } from './csvFormat'

describe('csvFormat', () => {
  test('a quoted cell keeps line breaks, delimiters and escaped quotes', () => {
    const records = parseCsvRecords('a,b\n"line 1\nline 2","x, ""y"""\nc,d')
    expect(records).toEqual([
      { cells: ['a', 'b'], lineNumber: 1 },
      { cells: ['line 1\nline 2', 'x, "y"'], lineNumber: 2 },
      { cells: ['c', 'd'], lineNumber: 4 },
    ])
  })

  test('CRLF ends a record; inside quotes it becomes \\n', () => {
    const records = parseCsvRecords('a,b\r\n"one\r\ntwo",z\r\n')
    expect(records.map((record) => record.cells)).toEqual([
      ['a', 'b'],
      ['one\ntwo', 'z'],
    ])
  })

  test('skips empty lines and a BOM, keeps whitespace in cells', () => {
    const records = parseCsvRecords('﻿a\n\n  b  \n')
    expect(records).toEqual([
      { cells: ['a'], lineNumber: 1 },
      { cells: ['  b  '], lineNumber: 3 },
    ])
  })

  test('an unclosed quote is an error, not a swallowed rest of file', () => {
    expect(() => parseCsvRecords('a\n"open,b\nc')).toThrow('Zeile 2')
  })

  test('toCsvCell output parses back to the same values', () => {
    const values = ['plain', 'with, comma', 'with "quote"', 'two\nlines', 'crlf\r\nline', '  padded  ', '']
    const line = values.map(toCsvCell).join(',')
    const [record] = parseCsvRecords(line)
    expect(record.cells).toEqual(values.map((value) => value.replace(/\r\n/g, '\n')))
  })

  test('splitCsvLine returns the cells of one line', () => {
    expect(splitCsvLine('A1,"Oak, Large"')).toEqual(['A1', 'Oak, Large'])
    expect(splitCsvLine('')).toEqual([''])
  })
})
