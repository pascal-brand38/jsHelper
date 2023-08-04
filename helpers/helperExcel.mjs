/// Copyright (c) Pascal Brand
/// MIT License

import reader from 'xlsx'

// from a serial day in excel (nb of days since 01/01/1900),
// return a string of the date  yyyy/mm/dd
// https://stackoverflow.com/questions/26792144/converting-days-since-jan-1-1900-to-todays-date
function serialToDate(serial) {
  let l = serial + 68569 + 2415019;
  let n = Math.floor((4 * l) / 146097);
  l = l - Math.floor((146097 * n + 3) / 4);
  let i = Math.floor((4000 * (l + 1)) / 1461001);
  l = l - Math.floor((1461 * i) / 4) + 31;
  let j = Math.floor((80 * l) / 2447);
  let nDay = l - Math.floor((2447 * j) / 80);
  l = Math.floor(j / 11);
  let nMonth = j + 2 - (12 * l);
  let nYear = 100 * (n - 49) + i + l;
  return { nDay, nMonth, nYear}
}

function numberWithFixDigits(n, d) {
  return ("0" + n).slice(-d)
}

function serialToStr(serial, format='yyyy/MM/dd') {
  let d = serialToDate(serial)
  if (format === 'yyyy/MM/dd')
    return numberWithFixDigits(d.nYear, 4) + '/' + numberWithFixDigits(d.nMonth, 2) + '/' + numberWithFixDigits(d.nDay, 2)
  else if (format === 'dd/MM/yyyy')
    return numberWithFixDigits(d.nYear, 4) + '/' + numberWithFixDigits(d.nMonth, 2) + '/' + numberWithFixDigits(d.nDay, 2)
  error(`serialToStr(): format=${format} is not recognized`)
}

function dateCompare(date1, date2) {
  if (date1.nYear < date2.nYear) {
    return -1
  } else if (date1.nYear > date2.nYear) {
    return +1
  }
  if (date1.nMonth < date2.nMonth) {
    return -1
  } else if (date1.nMonth > date2.nMonth) {
    return +1
  }
  if (date1.nDay < date2.nDay) {
    return -1
  } else if (date1.nDay > date2.nDay) {
    return +1
  }
  return 0
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
  serialToStr,
  dateCompare
}
