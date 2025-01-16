#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// import data from external account

import databaseHooks from './databaseHooks.mjs'

// @ts-ignore
import helperJs from '../../../helpers/helperJs.mjs'

interface dataSheetRowType {
  date: string,
  account: string,
  label: string,
  amount: string,
  category: string,
}

interface accountType {   // list of all the accounts
  name: string,
  initialAmount: 0,
  type1: string,
  type2: string,
  type3: string,
  lastUpdate: number,
}

interface categoryParamType {
  type1: string,      // Dépenses, Revenus, Somme nulle
  type2: string,      // Courant, Exceptionnel
}

interface histoYearType {
  accounts: { [key: string]: number },    // the key is the account name, the number is the amount
  categories: { [key: string]: number },  // the key is the category name, the number is the amount of this category
}

export interface databaseType  {
  inputs: {
    compteName: string,             // xslx file to be updated: categpry, importing new data,...
    importName: string|undefined,             // name of the file to import, from LBP. May be optional
    importAccountName: string|undefined,   // account that is being imported, from LBP. Linked to importName
  },
  params: {   // parameter of the xslx datas: startDate, account names, categories,...
    startDate: number,
    startYear: number,
    currentYear: number,

    // TODO: make accounts as an object of accountName
    accounts: accountType[],
    categories: { [ key: string]: categoryParamType},   // the key is the category name
    categoryMatches: [],                        // list of { regex, category }  to match LBP labels
  },
  histo: {  // historic data, per years
    [key: string]: histoYearType    // the key is the year, and the values are the data for this year
  },
  hooks: any,
  getParamsAccount: (accountName: string) => accountType

}

export class workbookHelper {
  workbook: any
  errors: string[]
  database: databaseType

  constructor(compteName: string, importFile: string|undefined, importAccount: string|undefined) {
    this.workbook = undefined
    this.errors = []             // list of strings of errors to check
    this.database = {
      inputs: {    // the inputs
        compteName: compteName,             // xslx file to be updated: categpry, importing new data,...
        importName: importFile,             // name of the file to import, from LBP. May be optional
        importAccountName: importAccount,   // account that is being imported, from LBP. Linked to importName
      },
      params: {   // parameter of the xslx datas: startDate, account names, categories,...
        startDate: 0,
        startYear: 0,
        currentYear: 0,

        // TODO: make accounts as an object of accountName
        accounts: [],                               // list of all the accounts  { name, initialAmount, type1, type2, type3, lastUpdate }
        categories: {},                             // object of 'categoryName': { type1, type2 }
        categoryMatches: [],                        // list of { regex, category }  to match LBP labels
      },
      histo: {  // historic data, per years
      },
      hooks: databaseHooks,
      getParamsAccount: (accountName) => this.database.params.accounts.filter(account => (account.name === accountName))[0],
    }
  }

  setError(text: string) {
    if (!this.errors.includes(text)) {
      this.errors.push(text)
    }
  }

  displayErrors() {
    if (this.errors.length !== 0) {
      console.log('\x1b[32m' + '******* ERRORS TO BE CHECKED' + '\x1b[0m')
      this.errors.forEach(e => console.log('\x1b[31m' + e + '\x1b[0m'))
    } else {
      console.log('\x1b[32m' + '******* No detected errors' + '\x1b[0m')
    }
  }

  async readSheet(sheetName: string) {
    const dataSheet = this.workbook.sheet(sheetName)
    const dataRange = dataSheet.usedRange()
    return await dataRange.value()
  }

  // "data" sheet
  dataSheetExtractRow(row: string[]) {
    return {
      date: row[0],       // excel serial date
      account: row[1],    // Livret
      label: row[2],      // I bought a present
      amount: row[3],     // 100
      category: row[4],   // Alimentation
    }
  }

  dataSheetCreateRow(data: dataSheetRowType) {
    return [ data.date, data.account, data.label, data.amount, data.category, ]
  }

  // callback is a function taking in arguments:
  //    (index, date, account, label, amount, category)
  // and returns an array of new rows. If undefined, they should not be updated
  async dataSheetForEachRow(callback: (index: number, date: string, account: string, label: string, amount: string, category: string) => dataSheetRowType) {
    let update = false
    const dataSheet = this.workbook.sheet("data")
    const dataRange = dataSheet.usedRange()
    const rows = await dataRange.value()

    const updatedRows = rows.map((row: string[], index: number) => {
      const { date, account, label, amount, category } = this.dataSheetExtractRow(row)
      const result = callback(index, date, account, label, amount, category)
      // check it is coherent (always return, or never)
      if (index >= 1) {
        if (update !== (result !== undefined)) {
          helperJs.error('Process() returns undefined and not undefined')
        }
      }

      if (result !== undefined) {
        update = true
        return this.dataSheetCreateRow({
          date: result.date ? result.date : date,
          account: result.account ? result.account : account,
          label: result.label ? result.label : label,
          amount: result.amount ? result.amount : amount,
          category: result.category ? result.category : category,
        })
      }
    })

    if (update) {
      // update the data sheet
      await dataRange.value(updatedRows)
    }
  }
}
