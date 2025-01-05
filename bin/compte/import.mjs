#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// import data from external account

import fs from 'fs'
import { DateTime } from '../../extend/luxon.mjs'


function readTSV(filename) {
  const text = fs.readFileSync(filename, 'utf8')
  const rows = []
  text.split('\n').forEach(rowText => {
    const row = rowText.trim().split('\t')
    rows.push(row)
  })
  return rows
}

function frenchTextToFloat(text) {
  return parseFloat(text.replaceAll(',', '.'))
}

function readLBPTSV(filename) {
  let rows = readTSV(filename)

  // look for solde in TSV
  let solde = undefined
  rows.forEach(row => {
    if (row[0] && row[0].startsWith('Solde (EUROS)')) {
      solde = frenchTextToFloat(row[1])
    }
  })

  // leave only amount data, processed with date and value
  rows = rows.filter(row => ((row.length === 3) && !isNaN(frenchTextToFloat(row[2]))))
  rows.forEach(row => {
    row[0] = DateTime.fromFormatStartOfDay(row[0]).toExcelSerial()
    row[1] = row[1].replaceAll('"', '')
    row[2] = frenchTextToFloat(row[2])
  })
  rows.sort((a, b) => a[0] - b[0])

  return { solde, rows }
}

export function importLBPData(importName, accountName, workbook) {
  if (importName===undefined && accountName===undefined) {
    return undefined
  }

  const { solde: lbpSolde, rows: importRows } = readLBPTSV(importName)

  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()
  let addRows = []
  importRows.forEach(importRow => {
    let found = rows.some(row => (importRow[0]===row[0]) && (accountName===row[1]) && (importRow[1]===row[2]) && (importRow[2]===row[3]))
    if (!found) {
      addRows.push([ importRow[0], accountName, importRow[1], importRow[2], '=== ERREUR ===' ])
    }
  })

  console.log(`Inserting ${addRows.length} ${accountName} data`)
  if (addRows.length >= 1) {
    const addRange = dataSheet.range(dataRange._maxRowNumber + 1, dataRange._minColumnNumber, dataRange._maxRowNumber + addRows.length, dataRange._maxColumnNumber)
    addRange.value(addRows)
  }

  return lbpSolde
}
