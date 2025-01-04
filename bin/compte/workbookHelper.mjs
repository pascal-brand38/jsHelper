#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

// import data from external account

export class workbookHelper {
  constructor(workbook) {
    this.workbook = workbook
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
