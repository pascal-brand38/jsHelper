#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// doc of xlsx-populate at
//    https://github.com/dtjohnson/xlsx-populate#readme

// TODO: check account exist before import

import * as fs from 'fs'
import * as path from 'path'

// @ts-ignore
import xlsxPopulate from 'xlsx-populate'

import { DateTime } from 'luxon'
import '../../extend/luxon.mjs'
import helperJs from '../../helpers/helperJs.mjs'

import yargs, { help, string } from 'yargs'
import { hideBin } from 'yargs/helpers'

import { importLBPData } from './import.mjs'
import { dataSheetRowType, categoryMatchType, workbookHelper, accountParamType, categoryParamType } from './workbookHelper.mjs'

function getArgs(argv: string[]) {
  let options = yargs(hideBin(argv))
    .usage('node bin/compte.mjs /c/Users/pasca/Mon\ Drive/coffre-fort/comptes/new/compte.xlsx  --import-file /c/Users/pasca/Downloads/00000.tsv --import-account "CCP"')
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
    .check((argv: any) => {
      if ((!argv['import-file']) && (argv['import-account'])) {
        throw new Error('--import-file, but no --import-account')
      } else if ((argv['import-file']) && (!argv['import-account'])) {
        throw new Error('no --import-file, but --import-account');
      } else {
        return true;
      }
    }).strict()   // raise an error if an option is unknown
    .parseSync();

  return options;
}

function extractYear(datetime: DateTime): number {
  // remove toObject()
  const year = datetime.year
  if (year===undefined) {
    helperJs.error('Internal error: year is undefined')
    return 0    // useless as throw an exception
  } else {
    return year
  }
}

async function updateCategories(workbookHelp: workbookHelper) {
  const database = workbookHelp.database
  function process(index: number, date: number|undefined, account: string|undefined, label: string|undefined, amount: number|undefined, category: string|undefined) {
    if (label && amount) {
      if ((!category || category === '=== ERREUR ===')) {
        category = '=== ERREUR ==='
        database.params.categoryMatches.some((match: categoryMatchType) => {
          if (match.regex.exec(label)) {
            category = match.category
            return true
          } else {
            return false
          }
        })
      }

      if (!(Object.keys(database.params.categories).includes(category))) {
        workbookHelp.setError(`${category}: unknown category line ${index+1}`)
      }

      if (category === '=== ERREUR ===') {
        if (date) {
          const year = extractYear(DateTime.fromExcelSerialStartOfDay(date))
          workbookHelp.setError(`${year}: there are some ${category}`)
        } else {
          workbookHelp.setError(`there are some ${category}`)
        }
      }
    }
    return {
      date: undefined,
      account: undefined,
      label: undefined,
      amount: undefined,
      category: category,
    }
  }
  await workbookHelp.dataSheetForEachRow(process)
}

async function createRawdata(workbookHelp: workbookHelper) {
  const workbook = workbookHelp.workbook
  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows: dataSheetRowType[]  = await dataRange.value()
  rows.forEach(row => {
    const rawdata = workbookHelp.rawdataCreateFromRow(row)
    if (rawdata) {
      workbookHelp.database.rawData.push(rawdata)
    }
  })
}

async function check(workbookHelp: workbookHelper) {
  const workbook = workbookHelp.workbook
  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows: dataSheetRowType[]  = await dataRange.value()

  rows.forEach((row, index) => {
    if (row) {
      // check account
      const account = row[1]
      if (account && workbookHelp.database.params.accounts[account] === undefined) {
        helperJs.error(`Internal error: wrong account ${account} at line ${index+1}`)
      }

      // check category
      const category = row[4]
      if (category && workbookHelp.database.params.categories[category] === undefined) {
        helperJs.error(`Internal error: wrong category ${category} at line ${index+1}`)
      }
    }
  })
}


async function sortData(workbookHelp: workbookHelper) {
  const database = workbookHelp.database
  function isNumber(value: any) {
    return typeof value === 'number';
  }

  const workbook = workbookHelp.workbook
  const dataSheet = workbook.sheet("data")
  const dataRange = dataSheet.usedRange()
  const rows: dataSheetRowType[]  = await dataRange.value()

  // sort by date
  rows.sort((row1: dataSheetRowType, row2: dataSheetRowType) => {
    const date1 = (row1 ? row1[0] : undefined)
    const date2 = (row2 ? row2[0] : undefined)
    if (!isNumber(date1)) {
      return +1
    } else if (!isNumber(date2)) {
      return -1
    } else {
      return (date1 - date2)
    }
  })


  // add a new line when the year changes
  let currentYear = database.params.startYear+1
  rows.forEach((row: dataSheetRowType, index: number) => {
    if (row) {
      const date = row[0]
      if (isNumber(date)) {
        const year = extractYear(DateTime.fromExcelSerialStartOfDay(date))
        if (year !== currentYear) {
          // add a new line
          rows.splice(index, 0, undefined)
          currentYear = year
        }
      }
    }
  })

  // set new values
  await dataRange.clear()
  await dataRange.value(rows)

  // set the last cell so that we ensure that adding newlines do not make thing wrong
  dataRange.endCell().value('END OF DATA - DO NOT REMOVE THIS CELL')

}


async function createResumeSheet(workbookHelp: workbookHelper) {
  const database = workbookHelp.database

  const dataSheet = workbookHelp.workbook.sheet("Résumé")
  const dataRange = dataSheet.usedRange()
  const rows = await dataRange.value()

  // clean the rows, apart the title
  rows.forEach((row: dataSheetRowType, index: number) => {
    if (index < 5) {
      return    // title of columns
    }
    rows[index] = [ '', '', '',  ]
  })

  const accounts = database.histo[database.params.currentYear].accounts

  let currentRow = 4
  let lastType2: string|undefined = undefined
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

  await dataRange.value(rows)
}


function displayErrors(workbookHelp: workbookHelper, lbpSolde: number|undefined) {
  const database = workbookHelp.database

  if (lbpSolde && database.inputs.importAccountName) {
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
  const sommeNulleCategory: string[] = []
  Object.keys(database.params.categories).forEach(category => {
    if (database.params.categories[category].type1 === 'Somme nulle') {
      sommeNulleCategory.push(category)
    }
  })
  Object.keys(database.histo).forEach(year => {
    sommeNulleCategory.forEach(category => {
      if (database.histo[year].categories[category] !== 0) {
        workbookHelp.setError(`${year}: Category ${category} is not zero-sum: ${database.histo[year].categories[category]}€`)
      }
    })
  })

  workbookHelp.displayErrors()
}

async function save(workbookHelp: workbookHelper) {
  const compteName = workbookHelp.database.inputs.compteName

  // save a backup
  const now = DateTime.now().setZone('Europe/Paris').toFormat('yyyyMMdd-HHmmss')
  const dir = path.dirname(compteName)
  const ext = path.extname(compteName)
  const base = path.basename(compteName, ext)

  const copyName = path.join(dir, base + '-' + now + ext)
  helperJs.info(`   copy ${compteName} as ${copyName}`)
  fs.copyFileSync(compteName, copyName)

  // save the updated execl file
  helperJs.info(`   save ${compteName}`)
  await workbookHelp.workbook.toFileAsync(compteName);
}


async function readParams(workbookHelp: workbookHelper) {
  const database = workbookHelp.database
  const rows = await workbookHelp.readSheet("params")
  if (rows.length >= 999999) {
    helperJs.error(`Reading ${rows.length} in params - way too much!`)
  }
  let lastAccount: accountParamType | undefined = undefined
  let lastCategory: categoryParamType | undefined = undefined
  rows.forEach((row: any) => {
    if (row[0] === 'startDate') {
      database.params.startDate = row[1]    // excel serial date, when the data starts (the year before, to have an init of all accounts)
      database.params.startYear = extractYear(DateTime.fromExcelSerialStartOfDay(database.params.startDate))
      database.params.currentYear = extractYear(DateTime.fromNowStartOfDay())
    } else if (row[0] === 'account') {
      let index = 0
      if (lastAccount) {
        index = lastAccount.index + 1
        if (lastAccount.type2 != row[4]) {
          index ++
        }
      } else {
        index = 0
      }
      // adding an account, with its types (short-term,...) and initial amount at startDate
      database.params.accounts[row[1]] = {
        initialAmount: row[2] ? row[2] : 0,
        type1: row[3],
        type2: row[4],
        type3: row[5],
        lastUpdate: undefined,
        index: index,
      }
      lastAccount = database.params.accounts[row[1]]
    } else if (row[0] === 'category') {
      let index = 0
      if (lastCategory) {
        index = lastCategory.index + 1
        if (lastCategory.type1 != row[2]) {
          index ++
        }
      } else {
        index = 0
      }
      database.params.categories[row[1]] = {
        type1: row[2],
        type2: row[3],
        index: index,
      }
      lastCategory = database.params.categories[row[1]]
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

  // sort the matches by length (longer before)
  // so if there are the same prefix, the longer is checked before the smaller
  database.params.categoryMatches.sort((a: categoryMatchType, b: categoryMatchType) => b.regex.toString().length - a.regex.toString().length)

}

async function updateHisto(workbookHelp: workbookHelper) {
  const database = workbookHelp.database

  const startYear = database.params.startYear
  const currentYear = database.params.currentYear

  // initialize the data structure (account and category per year) to 0
  for (let year=startYear; year<=currentYear; year++) {
    database.histo[year] = {
      accounts: {},
      categories: {}
    }
    Object.keys(database.params.accounts).forEach(account => database.histo[year].accounts[account] = 0)
    Object.keys(database.params.categories).forEach(category => database.histo[year].categories[category] = 0)
  }

  // update the startDate of the histo
  Object.keys(database.params.accounts).forEach(account => database.histo[startYear].accounts[account] = database.params.accounts[account].initialAmount)

  database.rawData.forEach(raw => {
    const year = extractYear(DateTime.fromExcelSerialStartOfDay(raw.date))
    database.getParamsAccount(raw.account).lastUpdate = raw.date
    database.histo[year].accounts[raw.account] += raw.amount
    database.histo[year].categories[raw.category] += raw.amount

  })

  // accumulate and round
  Object.keys(database.histo).forEach(year => {
    const nYear = parseInt(year)
    // accumulate
    if (nYear > startYear) {
      Object.keys(database.histo[year].accounts).forEach(accountName => database.histo[nYear].accounts[accountName] += database.histo[nYear-1].accounts[accountName])
    }

    // round
    Object.keys(database.histo[year].accounts).forEach(accountName => database.histo[year].accounts[accountName] = Math.round(database.histo[year].accounts[accountName] * 100) / 100)
    Object.keys(database.histo[year].categories).forEach(category => database.histo[year].categories[category] = Math.round(database.histo[year].categories[category] * 100) / 100)
  })
}


async function createHistoSheet(workbookHelp: workbookHelper) {
  const database = workbookHelp.database

  const dataSheet = workbookHelp.workbook.sheet("Histo")
  const dataRange = dataSheet.usedRange()
  const rows = await dataRange.value()

  // clean the rows, apart the title
  rows.forEach((row: any[], index: number) => {
    const hook: string | undefined = row[0]
    if (hook) {
      if (database.hooks[hook]) {
        rows[index] = database.hooks[hook](database, row)
      } else {
        helperJs.error(`Internal error: hook ${hook} does not exist`)
      }
    } else {
      rows[index] = undefined // no change - important for formulas
    }
  })

  await dataRange.value(rows)
}



export async function compte() {
  const options = getArgs(process.argv)

  const xlsxName: string = (typeof options['_'][0] === 'string' ? options['_'][0] : '')
  const workbookHelp = new workbookHelper(xlsxName, options.importFile, options.importAccount)

  helperJs.info(`Read ${workbookHelp.database.inputs.compteName}`)
  workbookHelp.workbook = await xlsxPopulate.fromFileAsync(workbookHelp.database.inputs.compteName)

  helperJs.info('readParams')
  await readParams(workbookHelp)

  helperJs.info('importLBPData')
  const lbpSolde = await importLBPData(workbookHelp)

  helperJs.info('Chek')
  await check(workbookHelp)

  helperJs.info('Sort Data')
  await sortData(workbookHelp)

  helperJs.info('Update Categories')
  await updateCategories(workbookHelp)

  helperJs.info('Create row data')
  await createRawdata(workbookHelp)

  helperJs.info('updateHisto')
  await updateHisto(workbookHelp)

  helperJs.info('createResumeSheet')
  await createResumeSheet(workbookHelp)

  helperJs.info('createHistoSheet')
  await createHistoSheet(workbookHelp)

  helperJs.info('displayErrors')
  displayErrors(workbookHelp, lbpSolde)

  if (options.save) {
    await save(workbookHelp)
  }
}
