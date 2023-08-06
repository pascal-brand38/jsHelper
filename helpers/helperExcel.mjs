/// Copyright (c) Pascal Brand
/// MIT License

import reader from 'xlsx'
import helperJs from './helperJs.mjs';

// read a sheet of an xls or ods file
// name is the excel filename,
// xlsFormat is how the sheet is formatted. Cf. helperEmailContrat.mjs, variable xlsFormatCompta
// it returns a json with all the sheet information
function readXls(name, xlsFormat) {
  // sheetName, colName, colArrival, colDeparture, colStatusPay1=null, colStatusPay2=null, colStatusPay3=null) {
  const file = reader.readFile(name)
  let rows = []
  // { header: "A" } indicates the json keys are A, B, C,... (cf. https://docs.sheetjs.com/docs/api/utilities/)
  reader.utils.sheet_to_json(file.Sheets[xlsFormat.sheetName], { header: "A" }).forEach((res) => {
    let row = {}
    xlsFormat.cols.forEach(col => {
      row[col.prop] = res[col.col]
      if (col.postComputation !== undefined) {
        row[col.prop] = col.postComputation(row[col.prop])
      }
    })
    if (xlsFormat.postComputationRow) {
      row = xlsFormat.postComputationRow(row)
    }
    rows.push(row)
  })

  if (xlsFormat.postComputationSheet) {
    rows = xlsFormat.postComputationSheet(rows)
  }

  return rows
}


export default {
  readXls,
}
