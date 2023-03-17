/// Copyright (c) Pascal Brand
/// MIT License
///
/// Check  https://www.geeksforgeeks.org/how-to-read-and-write-excel-file-in-node-js/
/// and https://docs.sheetjs.com/
///
/// arg1 is the compta, and arg2 is the agenda

import reader from 'xlsx'

// from a serial day in excel (nb of days since 01/01/1900),
// return a string of the date  dd/mm/yyyy
// https://stackoverflow.com/questions/26792144/converting-days-since-jan-1-1900-to-todays-date
function serialToStr(serial) {
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
  // return nDay + '/' + nMonth + '/' + nYear;
  return nYear + '/' + nMonth + '/' + nDay;
}

// read an xls or ods file
// name is the excel filename, sheetName is the name of the sheet containing
// data, colName is the col that contains the name of the cat (typically 'A'), 
// colArrival and colDeparture are the cat's booking
// it returns a json with object { name, arrival, departure }
function readXls(name, sheetName, colName, colArrival, colDeparture, colStatusPay1=null, colStatusPay2=null, colStatusPay3=null) {
  const file = reader.readFile(name)
  let data = []
  // { header: "A" } indicates the json keys are A, B, C,... (cf. https://docs.sheetjs.com/docs/api/utilities/)
  reader.utils.sheet_to_json(file.Sheets[sheetName], { header: "A" }).forEach((res) => {
    data.push( {
      name: res[colName],
      arrival: Math.floor(res[colArrival]),
      departure: Math.floor(res[colDeparture]),
      statusPay: (colStatusPay1 ? [ res[colStatusPay1], res[colStatusPay2], res[colStatusPay3] ] : null),
    })
  })
  data = data.filter(e => (e.name !== undefined) && !isNaN(e.arrival) && !isNaN(e.departure))
  data.sort(function(a, b) { return a.arrival - b.arrival } );

  return data
}

// populates unique arrival and departure dates, from readXls return data
function populateDates(dates, data) {
  data.forEach(e => { 
    if (!dates.some(d => d.what === 'arrival' && d.date === e.arrival)) {
      dates.push( { what: 'arrival', date: e.arrival })
    }
    if (!dates.some(d => d.what === 'departure' && d.date === e.departure)) {
      dates.push( { what: 'departure', date: e.departure })
    }
  })

  // sort in reverse order to have the one to check in display directly
  dates.sort((e1, e2) => (e2.date - e1.date));
}


// check coherency of arrival and departure number of dates in comta and agenda
function checkDates(dataCompta, dataAgenda) {
  let dates = []
  populateDates(dates, dataCompta)
  populateDates(dates, dataAgenda)

  dates.forEach(d => {
    const what = d.what
    const compta = dataCompta.filter(e => e[what] === d.date)
    const agenda = dataAgenda.filter(e => e[what] === d.date)
    if (compta.length !== agenda.length) {
      console.log(`--- ${what} on ${serialToStr(d.date)} ----------------`)
      console.log('Compta: ')
      compta.forEach(c => console.log(`   ${c.name}`))
      console.log('Agenda: ')
      agenda.forEach(c => console.log(`   ${c.name}`))
    }
  })
}

function checkStatusPay(dataCompta) {
  const epochToday = Date.now();

  console.log('-------------------------------------------------')
  console.log('------------------------------------------ COMPTA')
  console.log('-------------------------------------------------')
  dataCompta.forEach(data => {
    const departureStr = serialToStr(data.departure)
    const epochDeparture = Date.parse(departureStr)
    const epochDeparture10 = epochDeparture + 1000*60*60*24 * 10
    const epochDeparture20 = epochDeparture + 1000*60*60*24 * 20
    if (epochDeparture < epochToday) {
      //console.log(data.name)
      data.statusPay.forEach(status => {
        switch (status) {
          case 'Attente':
            console.log(`*** ATTENTE  ${departureStr} ${data.name}`)
            break
          case 'Reçu':
            if (epochDeparture10 < epochToday) {
              console.log(`    Reçu     ${departureStr} ${data.name}`)
            }
            break
          case 'Envoyé':
            if (epochDeparture20 < epochToday) {
              console.log(`    Envoyé   ${departureStr} ${data.name}`)
            }
            break
          }
      })
    }
  })
}

// filter consecutive periods in the agenda, which may be
// there when the room is changed during vacation
function filterConsecutive(data) {
  data.forEach( d => d.remove = false)
  data.forEach( d => {
    if (d.remove === false) {
      let consecutive = data.filter(e => (
             (e !== d)      // do not remove the one we are checking, in case (e.departure===e.arrival)
          && (!e.remove) 
          && ((e.arrival === d.departure) || (e.arrival-1 === d.departure))
          && (e.name === d.name)
        ))
        if (consecutive.length === 1) {
          consecutive[0].remove = true
          d.departure = consecutive[0].departure
        }
    }
  })

  return data.filter(e => !e.remove)
}

function main() {
  const argv = process.argv
  // console.log(argv)

  // Reading compta and agenda data
  let dataCompta = readXls(argv[2], 'Compta', 'B', 'W', 'X', 'K', 'O', 'S')
  let dataAgenda = readXls(argv[3], 'Résa', 'A', 'I', 'K')
  dataAgenda = filterConsecutive(dataAgenda)

  // filter the dates from the compta that are prior the 1st arrival in the agenda
  const firstDate = dataAgenda[0].arrival
  dataCompta = dataCompta.filter(e => e.arrival >= firstDate)

  // check coherency
  checkDates(dataCompta, dataAgenda)
  checkStatusPay(dataCompta)
}

main();
