#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// TODO: sort (but keep space between year data)
// TODO: check account exist before import
// TODO: check category exists
// TODO: check remb.
// TODO: args reader
// TODO: refactor to have be able to change the xls format easily
// TODO: console in green, red,... to be added in utils

import fs from 'fs'
import path from 'path'
import xlsxPopulate from 'xlsx-populate'
import { DateTime } from '../extend/luxon.mjs'
import helperJs from '../helpers/helperJs.mjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { importLBPData } from './compte/import.mjs'
import { workbookHelper } from './compte/workbookHelper.mjs'

function getArgs(argv) {
  console.log(argv)
  let options = yargs(hideBin(argv))
    .usage('Update compte.xlsx')
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .demandCommand(1, 1)   // exactly 1 arg without options, which is the xlsx file
    .options({
      "import-file": {
        description: 'import a tsv file from LBP',
        type: 'string',
      },
      "import-account": {
        description: 'import account name, typically CCP',
        type: 'string',
      },
      "save": {
        description: 'Use --no-save to run, but do not save the result',
        type: 'boolean',
        default: true,
      },
    })
    .check((argv) => {
      if ((!argv['import-file']) && (argv['import-account'])) {
        throw new Error('--import-file, but no --import-account')
      } else if ((argv['import-file']) && (!argv['import-account'])) {
        throw new Error('no --import-file, but --import-account');
      } else {
        return true;
      }
    }).strict()   // raise an error if an option is unknown
    .argv;

  return options;
}



function updateCategories(workbookHelp) {
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

  const categoryMatchRows = initCategoryMatch(workbookHelp.workbook)

  function process(index, date, account, label, amount, category) {
    let newCategory = undefined
    if (label && (!category || category === '=== ERREUR ===')) {
      categoryMatchRows.some(match => {
        if (match[0].exec(label)) {
          newCategory = match[1]
          return true
        } else {
          return false
        }
      })
    }
    return { category: newCategory }
  }
  workbookHelp.dataSheetForEachRow(process)
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
      accounts[account].type1 = type1
      accounts[account].type2 = type2
      accounts[account].type3 = type3
    }
  })

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


function displayErrors(workbookHelp, accounts, yearData, lbpSolde, importAccountName) {
  if (lbpSolde) {
    // check, but raise an error and stop immediately s a problem in a import may corrupt the xlsx file
    if (!accounts[importAccountName]) {
      helperJs.error(`PLEASE CHECK: Import account ${importAccountName} not found`)
    }
    if (accounts[importAccountName].amount !== lbpSolde) {
      helperJs.error(`PLEASE CHECK: ${importAccountName} solde: ${accounts[importAccountName].amount}€ (computed)  vs  ${lbpSolde}€ (expected from tsv imported file)`)
    }
  }

  // check all labeled are categorized
  Object.keys(yearData).forEach(key => {
    if (yearData[key].category['=== ERREUR ==='] !== undefined) {
      workbookHelp.setError(`${key}: contains not categorized values (alimentation,...)`)
    }
    if ((yearData[key].category['Virement'] !== 0) && (yearData[key].category['Virement'] !== undefined)) {
      workbookHelp.setError(`${key}: Virement are not null: ${yearData[key].category['Virement']}`)
    }
  })

  workbookHelp.displayErrors()
}

function perYear(workbookHelp) {
  const yearData = {}

  function process(index, date, account, label, amount, category) {
    amount = amount ? amount : 0
    category = category ? category : '=== ERREUR ==='
    if (date) {
      const year = DateTime.fromExcelSerialStartOfDay(date).toObject().year
      if (yearData[year] === undefined) {
        yearData[year] = {}
        yearData[year].category = {}
      }

      if (yearData[year].category[category] === undefined) {
        if (category === '=== ERREUR ===') {
          // display a warning
          workbookHelp.setError(`Year ${year}: === ERREUR === at line ${index+1}`)
        }
        yearData[year].category[category] = 0
      }
      const wasNan = isNaN(yearData[year].category[category])
      yearData[year].category[category] += amount
      yearData[year].category[category] = Math.round(yearData[year].category[category] * 100) / 100
      if (!wasNan && isNaN(yearData[year].category[category])) {
        workbookHelp.setError(`NaN at line ${index+1}`)
      }
    }
  }

  workbookHelp.dataSheetForEachRow(process)

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

  // save the updated execl file
  await workbook.toFileAsync(compteName);
}


function getAccounts(workbookHelp) {
  const accounts = initAccounts(workbookHelp.workbook)

  function process(index, date, account, label, amount, category) {
    if (account && amount && (date > accounts[account].initDate)) {
      accounts[account].amount += amount
      accounts[account].amount = Math.round(accounts[account].amount * 100) / 100
      if (accounts[account].lastUpdate < date) {
        accounts[account].lastUpdate = date
      }
    }
  }
  workbookHelp.dataSheetForEachRow(process)
  return accounts
}

async function main() {
  const options = getArgs(process.argv)

  const compteName = options['_'][0]
  const importName = options.importFile
  const importAccountName = options.importAccount

  const workbook = await xlsxPopulate.fromFileAsync(compteName)
  const workbookHelp = new workbookHelper(workbook)

  const lbpSolde = importLBPData(importName, importAccountName, workbook)

  updateCategories(workbookHelp)
  const accounts = getAccounts(workbookHelp)

  createResumeSheet(workbook, accounts)

  const yearData = perYear(workbookHelp)
  displayErrors(workbookHelp, accounts, yearData, lbpSolde, importAccountName)


  if (options.save) {
    await save(compteName, workbook)
  }
}

await main();
console.log('DONE!')
process.exit(0)
