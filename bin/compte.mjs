#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import fs from 'fs'
import path from 'path'
import xlsxPopulate from 'xlsx-populate'
import { DateTime } from '../extend/luxon.mjs'


import helperJs from '../helpers/helperJs.mjs'

function getLastAmounts(workbook, accounts) {
  const dataSheet = workbook.sheet("last")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()

  rows.forEach(row => {
    const account = row[0]
    const lastAmount = row[2] ? row[2] : 0

    if (account) {
      accounts[account].lastAmount = lastAmount
    }
  })
}


function updateCategories(workbook) {
  function initCategoryMatch(workbook) {
    const categoryMatchSheet = workbook.sheet("category")
    const categoryMatchRange = categoryMatchSheet.usedRange()
    let rows = categoryMatchRange.value()
    rows.shift()
    rows.shift()
    rows.shift()
    rows.shift()
    // rows.shift()

    rows =  rows.filter(row => row[0])
    rows.forEach((row, index) => {
      rows[index][0] = new RegExp(`^${row[0]}`, 'i');
    })
    return rows
  }

  const categoryMatchRows = initCategoryMatch(workbook)

  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()
  let update = false
  rows.forEach((row, index) => {
    const label = row[2]
    const category = row[4]
    if (label && (!category || category === '=== ERREUR ===')) {
      // try to set the category
      categoryMatchRows.some(match => {
        // let re = new RegExp(`^${match[0]}`, 'i');
        if (match[0].exec(label)) {
        // if (label.startsWith(match[0])) {
          row[4] = match[1]
          update = true
          return true
        } else {
          return false
        }
      })
    }
  })
  if (update) {
    dataRange.value(rows)
  }
}

function initAccounts(workbook) {
  const accounts = {}
  const dataSheet = workbook.sheet("init")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()

  rows.forEach((row, index) => {
    if (index < 5) {
      return    // title of columns
    }
    const account = row[0]
    const initDate = row[1]   // all the same date
    const initAmount = row[2] ? row[2] : 0
    const type1 = row[3]    // immo / liquidites
    const type2 = row[4]    // compte courant, livrets,...
    const type3 = row[5]    // court terme, long terme,...

    if (account) {
      accounts[account] = {}
      accounts[account].init = initAmount
      accounts[account].initDate = initDate
      accounts[account].lastUpdate = initDate
      accounts[account].amount = initAmount
      accounts[account].lastAmount = 0
      accounts[account].type1 = type1
      accounts[account].type2 = type2
      accounts[account].type3 = type3
    }
  })

  getLastAmounts(workbook, accounts)
  return accounts
}

function createResumeSheet(workbook, accounts) {
  const dataSheet = workbook.sheet("Résumé")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()

  // clean the rows, apart the title
  rows.forEach((row, index) => {
    if (index < 5) {
      return    // title of columns
    }
    rows[index] = [ '', '', '' ]
  })

  let currentRow = 4
  let lastType2 = undefined
  Object.keys(accounts).map(key => {
    if (accounts[key].amount !== 0) {
      if (accounts[key].type2 !== lastType2) {
        lastType2 = accounts[key].type2
        currentRow++
      }
      rows[currentRow] = [ key, accounts[key].amount, accounts[key].lastUpdate ]
      currentRow++
    }
  })


  dataRange.value(rows)
}

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

function readCCPTSV(filename) {
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

function insertCCPData(insRows, workbook) {
  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()
  let addRows = []
  insRows.forEach(insRow => {
    let found = rows.some(row => (insRow[0]===row[0]) && (insRow[1]===row[2]) && (insRow[2]===row[3]))
    if (!found) {
      console.log(`Not found: ${insRow}`)
      addRows.push([ insRow[0], 'CCP', insRow[1], insRow[2], '=== ERREUR ===' ])
    }
  })
  if (addRows.length >= 1) {
    console.log(`Inserting ${addRows.length} CCP data`)
    console.log(`${dataRange._maxRowNumber + 1} ${dataRange._minColNumber} $  ${dataRange._maxRowNumber + addRows.length} ${dataRange._maxColNumber}`)
    const addRange = dataSheet.range(dataRange._maxRowNumber + 1, dataRange._minColumnNumber, dataRange._maxRowNumber + addRows.length, dataRange._maxColumnNumber)
    addRange.value(addRows)
  }
}

function displayErrors(workbook, accounts, yearData, ccpSolde) {
  const errors = []
  if (ccpSolde && accounts['CCP'].amount !== ccpSolde) {
    errors.push(`PLEASE CHECK: CCP solde: ${accounts['CCP'].amount}€ (computed)  vs  ${ccpSolde}€ (provided)`)
  }

  Object.keys(accounts).map(key => {
    if (accounts[key].amount !==  accounts[key].lastAmount) {
      errors.push(`${key}: ${accounts[key].amount}€ (computed) vs  ${accounts[key].lastAmount}€ (expected from tsv imported file)`)
    }
  })

  // check all labeled are categorized
  Object.keys(yearData).forEach(key => {
    if (yearData[key].category['=== ERREUR ==='] !== undefined) {
      errors.push(`${key}: contains not categorized values (alimentation,...)`)
    }
    if (yearData[key].category['Virement'] !== 0) {
      errors.push(`${key}: Virement are not null: ${yearData[key].category['Virement']}`)
    }
  })

  if (errors.length !== 0) {
    console.log('\x1b[32m' + '******* ERRORS TO BE CHECKED' + '\x1b[0m')
    errors.forEach(e => console.log('\x1b[31m' + e + '\x1b[0m'))
  } else {
    console.log('\x1b[32m' + '******* No detected errors' + '\x1b[0m')
  }
}

function perYear(workbook) {
  const yearData = {}
  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()
  rows.forEach(row => {
    const date = row[0]       // excel serial date
    const account = row[1]    // ex: 'Livret'
    const label = row[2]
    const amount = row[3]
    const category = row[4] ? row[4] : '=== ERREUR ==='

    if (date) {
      const year = DateTime.fromExcelSerialStartOfDay(date).toObject().year
      if (yearData[year] === undefined) {
        yearData[year] = {}
        yearData[year].category = {}
      }
      if (yearData[year].category[category] === undefined) {
        yearData[year].category[category] = 0
      }
      yearData[year].category[category] += amount
      yearData[year].category[category] = Math.round(yearData[year].category[category] * 100) / 100

    }
  })
  return yearData
}

async function save(compteName, workbook) {
  // save a backup
  const now = DateTime.now().setZone('Europe/Paris').toFormat('yyyyMMdd-HHmmss')
  const dir = path.dirname(compteName)
  const ext = path.extname(compteName)
  const base = path.basename(compteName, ext)

  const copyName = path.join(dir, base + '-' + now + ext)
  console.log(dir, base, ext)
  console.log(copyName)
  fs.copyFileSync(compteName, copyName)
  await workbook.toFileAsync(compteName);
}


async function main() {
  const argv = process.argv
  if (argv.length < 3) {
    helperJs.error('Usage: node bin/comptes.mjs /c/Users/pasca/Desktop/compte.xlsx')
  }

  const compteName = argv[2]
  const insName = argv[3]

  const workbook = await xlsxPopulate.fromFileAsync(compteName)
  let ccpSolde = undefined

  if (insName) {
    const { solde, rows: insRows } = readCCPTSV(insName)
    insertCCPData(insRows, workbook)
    ccpSolde = solde  // the one provided form data transfer from the bank
  }

  updateCategories(workbook)

  const accounts = initAccounts(workbook)

  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()
  rows.forEach(row => {
    const date = row[0]       // excel serial date
    const account = row[1]    // ex: 'Livret'
    // row[2] = comment
    const amount = row[3]
    // row[4] = category

    if (account && amount && (date > accounts[account].initDate)) {
      accounts[account].amount += amount
      accounts[account].amount = Math.round(accounts[account].amount * 100) / 100
      if (accounts[account].lastUpdate < date) {
        accounts[account].lastUpdate = date
      }
    }
  })

  createResumeSheet(workbook, accounts)

  // check CCP solde if known
  const yearData = perYear(workbook)
  displayErrors(workbook, accounts, yearData, ccpSolde)


  await save(compteName, workbook)


}

await main();
console.log('DONE!')
process.exit(0)
