#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// import data from external account

export class workbookHelper {
  constructor(workbook) {
    this.workbook = undefined
    this.errors = []             // list of strings of errors to check
  }

  setError(text) {
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

  readSheet(sheetName) {
    const dataSheet = this.workbook.sheet(sheetName)
    const dataRange = dataSheet.usedRange()
    return dataRange.value()
  }

  // "data" sheet
  dataSheetExtractRow(row) {
    return {
      date: row[0],       // excel serial date
      account: row[1],    // Livret
      label: row[2],      // I bought a present
      amount: row[3],     // 100
      category: row[4],   // Alimentation
    }
  }

  dataSheetCreateRow({date, account, label, amount, category}) {
    return [ date, account, label, amount, category, ]
  }

  // callback is a function taking in arguments:
  //    (index, date, account, label, amount, category)
  // and returns an array of new rows. If undefined, they should not be updated
  dataSheetForEachRow(callback) {
    let update = false
    const dataSheet = this.workbook.sheet("data")
    const dataRange = dataSheet.usedRange()
    const rows = dataRange.value()

    const updatedRows = rows.map((row, index) => {
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
      dataRange.value(updatedRows)
    }
  }
}
