#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// import data from external account
// this is a TS

import * as fs from 'fs'
import { workbookHelper, dataSheetRowType, accountCorrespType } from './workbookHelper.mjs'

import { DateTime } from 'luxon'
import '../../extend/luxon.mjs'

import helperJs from '../../helpers/helperJs.mjs'

function readTSV(filename: string) {
  const text: string = fs.readFileSync(filename, 'utf8')
  const rows: string[][] = []
  text.split('\n').forEach(rowText => {
    const row = rowText.trim().split('\t')
    rows.push(row)
  })
  return rows
}

function frenchTextToFloat(text: string) {
  return parseFloat(text.replaceAll(',', '.'))
}

function readLBPTSV(filename: string, workbookHelp: workbookHelper) {
  let rows = readTSV(filename)

  // look for metadata in TSV
  let solde: number | undefined = undefined
  let type: string | undefined = undefined
  let accountNumber: string | undefined = undefined
  rows.forEach(row => {
    if (row[0]) {
      // if (row[2] === undefined) {
      //   console.log(row[0], row[1])
      // }
      if (row[0].startsWith('Solde (EUROS)')) {
        solde = frenchTextToFloat(row[1])
      }
      if (row[0] === 'Type') {
        type = row[1]
      }
      if (row[0] === 'Num�ro Compte') {
        accountNumber = row[1]
      }
    }
  })
  if (solde === undefined) {
    throw('Cannot find the solde in the imported file')
  }

  // console.log(type, accountNumber)

  if ((type !== undefined) && (accountNumber !== undefined)) {
    workbookHelp.database.params.accountCorresps.some(c => {
      // console.log(c.type, c.startNumbers)
      if ((c.type === type) && ((accountNumber!).startsWith(c.startNumbers))) {
        workbookHelp.database.inputs.tsvAccountName = c.accountName
      }
    });
  }

  // leave only amount data, processed with date and value
  // const resultRows: [ [ number, string, number ] ] | [] = []
  const resultRows: { date: number, label: string, amount: number }[] = []
  rows = rows.filter(row => ((row.length === 3) && !isNaN(frenchTextToFloat(row[2]))))
  rows.forEach(row => {
    const date: number = DateTime.fromFormatStartOfDay(row[0]).toExcelSerial()
    resultRows.push({
      date: date,
      label: row[1].replaceAll('"', ''),
      amount: frenchTextToFloat(row[2]),
    })
  })
  resultRows.sort((a, b) => a.date - b.date)

  return { solde, resultRows }
}

export interface lbpImportedType {
  lbpSolde: number,
  addRows: dataSheetRowType[],
}

export async function importLBPData(workbookHelp: workbookHelper): Promise<lbpImportedType | undefined> {
  const importName = workbookHelp.database.inputs.importName
  if (importName===undefined) {
    return undefined
  }

  const importAccountName = workbookHelp.database.inputs.importAccountName
  const workbook = workbookHelp.workbook

  const { solde: lbpSolde, resultRows: importRows } = readLBPTSV(importName, workbookHelp)

  if (importAccountName && workbookHelp.database.inputs.tsvAccountName) {
    if (importAccountName !== workbookHelp.database.inputs.tsvAccountName) {
      helperJs.error(`ERROR: import account name ${importAccountName} is not the same as the tsv deduced one ${workbookHelp.database.inputs.tsvAccountName}`)
    }
  }
  if (!workbookHelp.database.inputs.tsvAccountName) {
    workbookHelp.database.inputs.tsvAccountName = importAccountName
  }

  const accountName = workbookHelp.database.inputs.tsvAccountName || importAccountName
  if (accountName === undefined) {
    helperJs.error(`ERROR: dont know the import account name - use option --import-account`)
    throw('ERROR')
  }

  if (lbpSolde === undefined) {
    helperJs.error(`ERROR: dont know the solde of the import account`)
  }

  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows = await dataRange.value()
  let addRows: dataSheetRowType[] = []
  importRows.forEach(importRow => {
    const found = rows.some((row: dataSheetRowType) => row && (importRow.date===row[0]) && (accountName===row[1]) && ((row[2] !== undefined) && (row[2].endsWith !== undefined) && (row[2].endsWith(importRow.label))) && (importRow.amount===row[3]))
    if (!found) {
      addRows.push([ importRow.date, accountName, importRow.label, importRow.amount, '=== ERREUR ===' ])
    }
  })

  helperJs.info(`  Inserting ${addRows.length} ${accountName} data`)
  if (addRows.length >= 1) {
    const addRange = dataSheet.range(dataRange._maxRowNumber + 1, dataRange._minColumnNumber, dataRange._maxRowNumber + addRows.length, dataRange._maxColumnNumber)
    addRange.value(addRows)
  }

  return { lbpSolde, addRows }
}
