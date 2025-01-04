#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// import data from external account

export class workbookHelper {
  constructor(workbook) {
    this.workbook = workbook
    this.errors = []             // list of strings of errors to check
  }

  setError(text) {
    this.errors.push(text)
  }

  displayErrors() {
    if (this.errors.length !== 0) {
      console.log('\x1b[32m' + '******* ERRORS TO BE CHECKED' + '\x1b[0m')
      this.errors.forEach(e => console.log('\x1b[31m' + e + '\x1b[0m'))
    } else {
      console.log('\x1b[32m' + '******* No detected errors' + '\x1b[0m')
    }
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

  // callback is a function taking in arguments:
  //    (date, account, label, amount, category)
  dataSheetForEachRow(callback) {
    const dataSheet = this.workbook.sheet("data")
    const dataRange = dataSheet.usedRange()
    const rows = dataRange.value()

    rows.forEach(row => {
      const { date, account, label, amount, category } = this.dataSheetExtractRow(row)
      callback(date, account, label, amount, category)
    })
  }
}