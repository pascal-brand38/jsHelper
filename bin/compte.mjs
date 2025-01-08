#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// TODO: use TS
// TODO: sort (but keep space between year data)
// TODO: check account exist before import
// TODO: check remb.

import fs from 'fs'
import path from 'path'
import xlsxPopulate from 'xlsx-populate'
import { DateTime } from '../extend/luxon.mjs'
import helperJs from '../helpers/helperJs.mjs'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

import { importLBPData } from './compte/import.mjs'
import { workbookHelper } from './compte/workbookHelper.mjs'
import databaseHooks from './compte/databaseHooks.mjs'

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
    if (category && !(Object.keys(database.params.categories).includes(category))) {
      workbookHelp.setError(`${category}: unknown category line ${index+1}`)
    }
    if (newCategory && !(Object.keys(database.params.categories).includes(newCategory))) {
      workbookHelp.setError(`${newCategory}: unknown category line ${index+1}`)
    }
    return { category: newCategory }
  }
  workbookHelp.dataSheetForEachRow(process)
}

function createResumeSheet(workbook, database) {
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

  const accounts = database.histo[database.params.currentYear].accounts

  let currentRow = 4
  let lastType2 = undefined
  Object.keys(accounts).map(accountName => {
    if (accounts[accountName] !== 0) {
      const params = database.getParamsAccount(accountName)
      const type2 = params.type2
      if (type2 !== lastType2) {
        lastType2 = type2
        currentRow++
      }
      rows[currentRow] = [ accountName, accounts[accountName], params.lastUpdate ]
      currentRow++
    }
  })


  dataRange.value(rows)
}


function displayErrors(workbookHelp, database, lbpSolde) {
  if (lbpSolde) {
    // check, but raise an error and stop immediately as a problem in a import may corrupt the xlsx file
    const computed = database.histo[database.params.currentYear].accounts[database.inputs.importAccountName]
    if (!computed) {
      helperJs.error(`PLEASE CHECK: Import account ${database.inputs.importAccountName} not found`)
    }
    if (computed !== lbpSolde) {
      helperJs.error(`PLEASE CHECK: ${database.inputs.importAccountName} solde: ${computed}€ (computed)  vs  ${lbpSolde}€ (expected from tsv imported file)`)
    }
  }

  // check all labeled are categorized
  Object.keys(database.histo).forEach(year => {
    if (database.histo[year].categories['=== ERREUR ==='] !== 0) {
      workbookHelp.setError(`${year}: contains not categorized values (alimentation,...)`)
    }
    if (database.histo[year].categories['Virement'] !== 0) {
      workbookHelp.setError(`${year}: Virement are not zero: ${database.histo[year].categories['Virement']}`)
    }
  })

  workbookHelp.displayErrors()
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
        lastUpdate: undefined,
      })
    } else if (row[0] === 'category') {
      database.params.categories[row[1]] = {
        type1: row[2],
        type2: row[3],
      }
    } else if (row[0] === 'categoryMatch') {
      database.params.categoryMatches.push({
        regex: new RegExp(`^${row[1]}`, 'i'),
        category: row[2],
      })
    } else if (row[0] !== undefined) {
      workbookHelp.setError(`Internal Error: do not know param named ${row[0]}`)
    }

    if (row[0] !== undefined && row[1] === undefined) {
      workbookHelp.setError(`Internal Error: param ${row[0]} without args`)
    }
  })
}

function updateHisto(workbookHelp, database) {
  const startYear = DateTime.fromExcelSerialStartOfDay(database.params.startDate).toObject().year
  const currentYear = DateTime.fromNowStartOfDay().toObject().year

  database.params.startYear = startYear
  database.params.currentYear = currentYear

  // initialize the data structure (account and category per year) to 0
  for (let year=startYear; year<=currentYear; year++) {
    database.histo[year] = {
      accounts: {},
      categories: {}
    }
    database.params.accounts.forEach(account => database.histo[year].accounts[account.name] = 0)
    Object.keys(database.params.categories).forEach(category => database.histo[year].categories[category] = 0)
  }

  // update the startDate of the histo
  database.params.accounts.forEach(account => database.histo[startYear].accounts[account.name] = account.initialAmount)

  //
  function process(index, date, account, label, amount, category) {
    if (date && amount) {
      const year = DateTime.fromExcelSerialStartOfDay(date).toObject().year
      category = category ? category : "=== ERREUR ==="
      database.getParamsAccount(account).lastUpdate = date
      database.histo[year].accounts[account] += amount
      database.histo[year].categories[category] += amount
    }
  }
  workbookHelp.dataSheetForEachRow(process)

  // accumulate and round
  Object.keys(database.histo).forEach(year => {
    // accumulate
    if (year > startYear) {
      Object.keys(database.histo[year].accounts).forEach(accountName => database.histo[year].accounts[accountName] += database.histo[year-1].accounts[accountName])
    }

    // round
    Object.keys(database.histo[year].accounts).forEach(accountName => database.histo[year].accounts[accountName] = Math.round(database.histo[year].accounts[accountName] * 100) / 100)
    Object.keys(database.histo[year].categories).forEach(category => database.histo[year].categories[category] = Math.round(database.histo[year].categories[category] * 100) / 100)
  })
}


function createHistoSheet(workbookHelp, database) {
  const dataSheet = workbookHelp.workbook.sheet("Histo")
  const dataRange = dataSheet.usedRange()
  const rows = dataRange.value()

  // clean the rows, apart the title
  rows.forEach((row, index) => {
    const hook = row[0]
    if (hook && database.hooks[hook]) {
      const newRows = database.hooks[hook](database, row)
      rows[index] = [ undefined, undefined, undefined, undefined, ...newRows]
    } else {
      rows[index] = undefined // no change - important for formulas
    }
  })

  dataRange.value(rows)
}



async function main() {
  const options = getArgs(process.argv)

  const database = {
    inputs: {    // the inputs
      compteName: options['_'][0],                // xslx file to be updated: categpry, importing new data,...
      importName: options.importFile,             // name of the file to import, from LBP. May be optional
      importAccountName: options.importAccount,   // account that is being imported, from LBP. Linked to importName
    },
    params: {   // parameter of the xslx datas: startDate, account names, categories,...
      startDate: undefined,
      startYear: undefined,
      currentYear: undefined,

      // TODO: make accounts as an object of accountName
      accounts: [],                               // list of all the accounts  { name, initialAmount, type1, type2, type3, lastUpdate }
      categories: {},                             // object of 'categoryName': { type1, type2 }
      categoryMatches: [],                        // list of { regex, category }  to match LBP labels
    },
    histo: {  // historic data, per years
    },
    hooks: databaseHooks,
    getParamsAccount: (accountName) => database.params.accounts.filter(account => (account.name === accountName))[0],
  }

  const workbook = await xlsxPopulate.fromFileAsync(database.inputs.compteName)
  const workbookHelp = new workbookHelper(workbook)

  readParams(workbookHelp, database)

  const lbpSolde = importLBPData(database.inputs.importName, database.inputs.importAccountName, workbook)
  updateCategories(workbookHelp, database)
  updateHisto(workbookHelp, database)

  createResumeSheet(workbook, database)
  createHistoSheet(workbookHelp, database)

  displayErrors(workbookHelp, database, lbpSolde)

  if (options.save) {
    await save(database.inputs.compteName, workbook)
  }
}

await main();
console.log('DONE!')
process.exit(0)
