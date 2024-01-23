/// Copyright (c) Pascal Brand
/// MIT License

// xlsx from https://git.sheetjs.com/sheetjs/sheetjs (new one)
// and https://github.com/SheetJS/sheetjs (old one)
import xlsx from 'xlsx'
import _ from 'lodash';

import fs from 'fs'

// read a sheet of an xls or ods file
// name is the excel filename,
// xlsFormat is how the sheet is formatted. Cf. helperCattery.mjs, variable xlsFormatCompta
// it returns a json with all the sheet information
function readXls(name, xlsFormat) {
  sheetList = workbook.SheetNames

  // // sheetName, colName, colArrival, colDeparture, colStatusPay1=null, colStatusPay2=null, colStatusPay3=null) {
  // const file = xlsx.readFile(name)
  // let rows = []
  // // { header: "A" } indicates the json keys are A, B, C,... (cf. https://docs.sheetjs.com/docs/api/utilities/)
  // xlsx.utils.sheet_to_json(file.Sheets[xlsFormat.sheetName], { header: "A" }).forEach((res) => {
  //   let row = {}
  //   xlsFormat.cols.forEach(col => {
  //     row[col.prop] = res[col.col]
  //     if (col.postComputation !== undefined) {
  //       row[col.prop] = col.postComputation(row[col.prop])
  //     }
  //   })
  //   if (xlsFormat.postComputationRow) {
  //     row = xlsFormat.postComputationRow(row)
  //   }
  //   rows.push(row)
  // })

  // if (xlsFormat.postComputationSheet) {
  //   rows = xlsFormat.postComputationSheet(rows)
  // }

  // return rows
}

async function checkSheetNames(excel, ods) {
  const excelOk = excel.SheetNames.every(name => {
    if (!ods.SheetNames.includes(name)) {
      console.log(`Excel sheet name ${name} not in ods file`)
      return false
    }
    return true
  });
  if (!excelOk) {
    return false
  }
  const odsOk = ods.SheetNames.every(name => {
    if (!excel.SheetNames.includes(name)) {
      console.log(`Ods sheet name ${name} not in excel file`)
      return false
    }
    return true
  });
  if (!odsOk) {
    return false
  }

  return true
}

function isFloat(value) {
  if (
    typeof value === 'number' &&
    !Number.isNaN(value) &&
    !Number.isInteger(value)
  ) {
    return true;
  }

  return false;
}

function translateValue(value) {
  if (isFloat(value)) {
    return Math.floor(value)
  }
  if (typeof value === 'string') {
    return value.trim()
  }
  return value
}

async function main() {
  const excel = xlsx.readFile('C:\\Users\\pasca\\Desktop\\compta.xls');
  const ods = xlsx.readFile('C:\\Users\\pasca\\Desktop\\compta.ods');

  if (! await checkSheetNames(excel, ods)) {
    return false
  }

  const sheetsEqual = excel.SheetNames.every(sheetName => {
    const opts = {
      header: "A",
      //cellDates: true,
      //UTC: true,
      //raw: false,
    }
    const rowsExcel = xlsx.utils.sheet_to_json(excel.Sheets[sheetName], opts)
    const rowsOds = xlsx.utils.sheet_to_json(ods.Sheets[sheetName], opts)
    //const rowsExcel = xlsx.utils.sheet_to_json(excel.Sheets[sheetName])
    //const rowsOds = xlsx.utils.sheet_to_json(ods.Sheets[sheetName])

    if (rowsExcel.length != rowsOds.length) {
      console.log(`Sheet ${sheetName} Excel Length: ${rowsExcel.length} ${rowsOds.length}`)
      return false
    }


    const rowsEqual = rowsExcel.every((rowExcel, i) => {
      const rowOds = rowsOds[i]

      const rowExcelArray = Object.keys(rowExcel).map((key) => translateValue(rowExcel[key]));
      const rowOdsArray = Object.keys(rowOds).map((key) => translateValue(rowOds[key]))

      if (!_.isEqual(rowExcelArray, rowOdsArray)) {
        console.log(`Not the same`)
        console.log(rowExcelArray)
        console.log(rowOdsArray)
        return false
      }
      return true

      // if (!_.isEqual(rowExcel, rowOds)) {
      //   console.log(`Not the same`)
      //   console.log(rowExcel)
      //   console.log(rowOds)
      //   return false
      // }
      // return true

      // if (rowExcel !== rowOds) {
      //   console.log(`Not the same`)
      //   console.log(rowExcel)
      //   console.log(rowOds)
      //   return false
      // }
      // return true

      // const rowEqual = rowExcel.every((cellExcel, j) => {
      //   if (cellExcel !== rowOds[j]) {
      //     console.log(`Not the same cell ${i} ${j} : ${cellExcel} vs ${rowOds[j]}`)
      //     return false
      //   }
      //   return true
      // })
      // return rowEqual
    })

    if (!rowsEqual) {
      console.log(`Rows are not equal in sheet ${sheetName}`)
      //return false
    }

    return true
  })

  if (!sheetsEqual) {
    console.log('Sheets are not equal')
    return false
  }

  console.log(`Files are the same`)
  return true

}


await main()
