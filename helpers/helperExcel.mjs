/// Copyright (c) Pascal Brand
/// MIT License

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

function serialToStr(serial) {
  let d = serialToDate(serial)
  return d.nYear + '/' + d.nMonth + '/' + d.nDay;
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


export default {
  serialToDate,
  serialToStr,
  dateCompare
}
