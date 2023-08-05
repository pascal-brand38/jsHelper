/// Copyright (c) Pascal Brand
/// MIT License

import reader from 'xlsx'
import helperJs from './helperJs.mjs';

// from a serial day in excel (nb of days since 01/01/1900),
// https://stackoverflow.com/questions/26792144/converting-days-since-jan-1-1900-to-todays-date
function serialToDate(serial) {
  // Convert serial to seconds, minus the offset of the number of seconds between Jan-1-1900(Serial Date)
  // and Jan-1-1970(UNIX Time). Which is 2208988800, this leaves us with UNIX time.
  // remove 2 days as:
  // - 1/1/1900 is day 1
  // - according to Excel Feb 29, 1900 exists(a bug in their code they refuse to fix.)
  return helperJs.date.fromEpoch(serial * 60*60*24 - 2208988800 - 60*60*24 *2)

}


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
  serialToDate,
}
