/// Copyright (c) Pascal Brand
/// MIT License

// xlsx from https://git.sheetjs.com/sheetjs/sheetjs (new one) 
// and https://github.com/SheetJS/sheetjs (old one)
import xlsx from 'xlsx'
import fs from 'fs'

// read a sheet of an xls or ods file
// name is the excel filename,
// xlsFormat is how the sheet is formatted. Cf. helperCattery.mjs, variable xlsFormatCompta
// it returns a json with all the sheet information
function readXls(name, xlsFormat) {
  // sheetName, colName, colArrival, colDeparture, colStatusPay1=null, colStatusPay2=null, colStatusPay3=null) {
  const file = xlsx.readFile(name)
  let rows = []
  // { header: "A" } indicates the json keys are A, B, C,... (cf. https://docs.sheetjs.com/docs/api/utilities/)
  xlsx.utils.sheet_to_json(file.Sheets[xlsFormat.sheetName], { header: "A" }).forEach((res) => {
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


// write a xls file
// https://redstapler.co/sheetjs-tutorial-create-xlsx/

// output file type: https://docs.sheetjs.com/docs/api/write-options/#supported-output-formats
// - biff8 for excel-2003
// - ods for libreoffice
function writeXls(fileName, sheetName, data, bookType='biff8') {
  const wb = xlsx.utils.book_new()
  wb.SheetNames.push(sheetName)
  let ws = xlsx.utils.aoa_to_sheet(data)
  // ws['!cols'] = [
  //   {'width' : 15}, // width for col A
  //   {'width' : 50}, // width for col B
  //   {'width' : 50}, // width for col C
  //   {'width' : 15}, // width for col D
  // ]
  wb.Sheets[sheetName] = ws

  // do not use xlsx.writeFile as it is not possible to control file overwrite
  // const options = {
  //   bookType: bookType,   // output file type: https://docs.sheetjs.com/docs/api/write-options/#supported-output-formats
  //                         // biff8 for excel-2003
  // }
  // xlsx.writeFile(wb, fileName, options)

  // https://blog.theodo.com/2022/08/sheetjs-programmatically-generating-stylish-excel-documents/
  const excelBuffer = xlsx.write(wb, {
    bookType: bookType,
    type: 'buffer'
  });
  fs.writeFileSync(fileName, excelBuffer, { flag: 'wx' });
}


export default {
  readXls,
  writeXls,
}
