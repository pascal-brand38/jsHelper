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

function updateCategories(workbookHelp, database) {
  function process(index, date, account, label, amount, category) {
    let newCategory = undefined
    if (label && (!category || category === '=== ERREUR ===')) {
      database.params.categoryMatches.some(match => {
        if (match.regex.exec(label)) {
          newCategory = match.category
          return true
        } else {
          return false
        }
      })
    }
    if (category && !database.params.categories.includes(category)) {
      workbookHelp.setError(`${category}: unknown category line ${index+1}`)
    }
    if (newCategory && !database.params.categories.includes(newCategory)) {
      workbookHelp.setError(`${newCategory}: unknown category line ${index+1}`)
    }
    return { category: newCategory }
  }
  workbookHelp.dataSheetForEachRow(process)
}

function initAccounts(database) {
  const accounts = {}

  database.params.accounts.forEach(account => {
    accounts[account.name] = {}
    accounts[account.name].init = account.initialAmount
    accounts[account.name].initDate = database.params.startDate
    accounts[account.name].lastUpdate = database.params.startDate
    accounts[account.name].amount = account.initialAmount
    accounts[account.name].type1 = account.type1
    accounts[account.name].type2 = account.type2
    accounts[account.name].type3 = account.type3
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
    if (date && amount!==0) {
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
      yearData[year].category[category] += amount
      yearData[year].category[category] = Math.round(yearData[year].category[category] * 100) / 100
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


function getAccounts(workbookHelp, database) {
  const accounts = initAccounts(database)

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

async function readParams(workbookHelp, database) {
  const rows = workbookHelp.readSheet("params")
  rows.forEach(row => {
    if (row[0] === 'startDate') {
      database.params.startDate = row[1]    // excel serial date, when the data starts (the year before, to have an init of all accounts)
    } else if (row[0] === 'account') {
      // adding an account, with its types (short-term,...) and initial amount at startDate
      database.params.accounts.push({
        name: row[1],
        initialAmount: row[2] ? row[2] : 0,
        type1: row[3],
        type2: row[4],
        type3: row[5],
      })
    } else if (row[0] === 'category') {
      database.params.categories.push(row[1])
    } else if (row[0] === 'categoryMatch') {
      database.params.categoryMatches.push({
        regex: new RegExp(`^${row[1]}`, 'i'),
        category: row[2],
      })
    } else if (row[0] !== undefined) {
      helperJs.error(`Internal Error: do not know param named ${row[0]}`)
    }
  })
}

async function main() {
  const options = getArgs(process.argv)

  const database = {
    input: {    // the inputs
      compteName: options['_'][0],                // xslx file to be updated: categpry, importing new data,...
      importName: options.importFile,             // name of the file to import, from LBP. May be optional
      importAccountName: options.importAccount,   // account that is being imported, from LBP. Linked to importName
    },
    params: {   // parameter of the xslx datas: startDate, account names, categories,...
      startDate: undefined,
      accounts: [],                               // list of all the account  { name, initialAmount, type1, type2, type3 }
      categories: [],                             // list of the categories
      categoryMatches: [],                        // list of { regex, category }  to match LBP labels
    },
    histo: {  // historic data, per years
    }
  }

  const workbook = await xlsxPopulate.fromFileAsync(database.input.compteName)
  const workbookHelp = new workbookHelper(workbook)

  readParams(workbookHelp, database)

  const lbpSolde = importLBPData(database.input.importName, database.input.importAccountName, workbook)
  updateCategories(workbookHelp, database)

  const accounts = getAccounts(workbookHelp, database)

  createResumeSheet(workbook, accounts)

  const yearData = perYear(workbookHelp)
  displayErrors(workbookHelp, accounts, yearData, lbpSolde, database.input.importAccountName)


  if (options.save) {
    await save(database.input.compteName, workbook)
  }
}

await main();
console.log('DONE!')
process.exit(0)
