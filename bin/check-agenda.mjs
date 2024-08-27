#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License
///
/// Check  https://www.geeksforgeeks.org/how-to-read-and-write-excel-file-in-node-js/
/// and https://docs.sheetjs.com/
///
/// arg1 is the compta, and arg2 is the agenda

import helperExcel from '../helpers/helperExcel.mjs'
import helperCattery from '../helpers/helperCattery.mjs'
import { DateTime } from '../extend/luxon.mjs'
import helperJs from '../helpers/helperJs.mjs'

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
  console.log()
  console.log('-------------------------------------------------')
  console.log('------------------------------ COMPTA  vs  AGENDA')
  console.log('-------------------------------------------------')

  let dates = []
  populateDates(dates, dataCompta)
  populateDates(dates, dataAgenda)

  const todaySerial = DateTime.fromNowStartOfDay().toExcelSerial()
  dates.forEach(d => {
    if (todaySerial <= d.date) {
      const what = d.what
      const compta = dataCompta.filter(e => e[what] === d.date)
      const agenda = dataAgenda.filter(e => e[what] === d.date)
      if (compta.length !== agenda.length) {
        console.log(`--- ${what} on ${DateTime.fromExcelSerialStartOfDay(d.date).toFormat('dd/MM/yyyy')} ----------------`)
        console.log('Compta: ')
        compta.forEach(c => console.log(`   ${c.name}`))
        console.log('Agenda: ')
        agenda.forEach(c => console.log(`   ${c.name}`))
      }
    }
  })
}

function checkStatusPay(dataCompta) {
  const epochToday = DateTime.fromNowStartOfDay().toEpoch();

  console.log()
  console.log('-------------------------------------------------')
  console.log('-------------------------------------- PAY STATUS')
  console.log('-------------------------------------------------')
  dataCompta.forEach(data => {
    const dArrival = DateTime.fromExcelSerialStartOfDay(data.arrival)
    const arrivalStr = dArrival.toFormat('dd/MM/yyyy')
    const epochArrival = dArrival.toEpoch()
    const epochArrival10 = epochArrival + DateTime.epochNDays(10)
    const epochArrival20 = epochArrival + DateTime.epochNDays(20)
    if (epochArrival <= epochToday) {
      //console.log(data.name)
      data.statusPay.forEach(status => {
        switch (status) {
          case 'Attente':
            console.log(`*** ATTENTE  ${arrivalStr} ${data.name}`)
            break
          case 'Reçu':
            if (epochArrival10 < epochToday) {
              console.log(`    Reçu     ${arrivalStr} ${data.name}`)
            }
            break
          case 'Envoyé':
            if (epochArrival20 < epochToday) {
              console.log(`    Envoyé   ${arrivalStr} ${data.name}`)
            }
            break
          }
      })
    }
  })
}

function _newFromCompta(dataFilled, excelStart, name, amount, date, type, status) {
  let doNotAdd = false
  doNotAdd |= (name===undefined)
  doNotAdd |= (amount==undefined)
  doNotAdd |= (type==='Espèce')
  doNotAdd |= (status!=='Encaissé')

  if (doNotAdd) {
    return
  }
  dataFilled.push({name, amount, date, type, status})
}


function checkAcompte(dataComptaNoSort) {
  console.log()
  console.log('-------------------------------------------------')
  console.log('-------------------------------- ACOMPTE RECOVERY')
  console.log('-------------------------------------------------')
  const todaySerial = DateTime.fromNowStartOfDay().toExcelSerial()
  let warning = false
  //console.log(dataComptaNoSort)
  dataComptaNoSort.findLastIndex(row => {
    if (warning) {
      if ((!row.acompteDate) && (row.acompteAmount)) {
        console.log(`${row.name} ${row.acompteAmount}€`)
      }
    } else {
      warning = ((row.acompteDate) && (row.acompteDate+15<todaySerial))
    }
  })
}

function checkBank(dataCompta, dataBank) {
  console.log()
  console.log('-------------------------------------------------')
  console.log('---------------------------------- BANK vs COMPTA')
  console.log('-------------------------------------------------')
  const epochStart = DateTime.fromNowStartOfDay().toEpoch() - DateTime.epochNDays(60)
  const excelStart = DateTime.fromEpochStartOfDay(epochStart).toExcelSerial()

  let dataFilled = []
  dataCompta.forEach(data => {
    _newFromCompta(dataFilled, excelStart, data.name, data.acompteAmount, data.acompteDate, data.acompteType, data.acompteStatus)
    _newFromCompta(dataFilled, excelStart, data.name, data.soldeAmount, data.soldeDate, data.soldeType, data.soldeStatus)
    _newFromCompta(dataFilled, excelStart, data.name, data.extraAmount, data.extraDate, data.extraType, data.extraStatus)
  })
  dataFilled.sort(function(a, b) { return a.date - b.date } );

  let dataBankToCheck = dataBank.filter(bank => {
    const epochDate = DateTime.fromExcelSerialStartOfDay(bank.date).toEpoch()
    return (epochDate >= epochStart) && (bank.credit !== undefined)
  })

  // look for same name / date / amount
  dataBankToCheck = dataBankToCheck.filter(bank => {
    const index = dataFilled.findIndex(data => (bank.name===data.name && bank.date===data.date && bank.credit===data.amount))
    if (index === -1) {
      return true   // keep it as not found
    } else {
      dataFilled.splice(index, 1)    // remove 1 element at index 'index'
      return false  // found, so remove from dataBankToCheck
    }
  })

  // look for same name / date, and amount spread amoung different lines
  // used for transfers, that includes several acomptes
  dataBankToCheck = dataBankToCheck.filter(bank => {
    let sum = 0
    let indexArray = []
    dataFilled.forEach((data, index) => {
      if ((data.name===bank.name) && (data.date === bank.date)) {
        indexArray.unshift(index)   // this is a push in front
        sum += data.amount
      }
    })
    if (sum !== bank.credit) {
      return true
    } else {
      indexArray.forEach(i => dataFilled.splice(i, 1))
      return false
    }
  })

  // look for same name / amount, and date bank greater
  // used for checks, that are in bank account after we received the check
  dataBankToCheck = dataBankToCheck.filter(bank => {
    const index = dataFilled.findLastIndex(data => (bank.name===data.name && bank.date>data.date && bank.credit===data.amount))
    if (index === -1) {
      return true   // keep it as not found
    } else {
      dataFilled.splice(index, 1)    // remove 1 element at index 'index'
      return false  // found, so remove from dataBankToCheck
    }
  })

  // look for same name / date, and amount spread amoung different lines
  // used for transfers, that includes several acomptes
  dataBankToCheck = dataBankToCheck.filter(bank => {
    let values = {}
    dataFilled.forEach((data, index) => {
      if (data.name===bank.name) {
        if (values[data.date.toString()] === undefined) {
          values[data.date.toString()] = { sum: 0, indexArray: []}
        }
        // indexArray.unshift(index)   // this is a push in front
        values[data.date.toString()].sum += data.amount
        values[data.date.toString()].indexArray.unshift(index)   // this is a push in front
      }
    })

    let result = true   // not found
    Object.keys(values).forEach(key => {
      if (values[key].sum === bank.credit) {
        result = false
        values[key].indexArray.forEach(i => dataFilled.splice(i, 1))
        Object.keys(values).forEach(key => values[key].sum = 0)
      }
    })
    return result
  })


  dataBankToCheck.forEach(bank => {
    console.log(`Bank: ${DateTime.fromExcelSerialStartOfDay(bank.date).toFormat('dd/MM/yyyy')} - ${bank.name} ${bank.credit}€`)
  })

  dataFilled = dataFilled.filter(data => (data.date >= excelStart))
  dataFilled.forEach(data => {
    console.log(`Compta: ${DateTime.fromExcelSerialStartOfDay(data.date).toFormat('dd/MM/yyyy')} - ${data.name} ${data.amount}€`)
  })

}

// filter consecutive periods in the agenda, which may be
// there when the room is changed during vacation
function filterConsecutive(data) {
  data.forEach( d => d.remove = false)
  data.forEach( d => {
    if (d.remove === false) {
      data.forEach(e => {
        if (
              (e !== d)      // do not remove the one we are checking, in case (e.departure===e.arrival)
          && (!e.remove)
          && ((e.arrival === d.departure) || (e.arrival-1 === d.departure))
          && (e.name === d.name)
        ) {
          e.remove = true
          d.departure = e.departure
        }
      })
    }
  })

  return data.filter(e => !e.remove)
}


// check if vaccination rcp is up-to-date
async function checkVaccination(dataCompta, comptaName, AgendaName) {
  const epochToday = DateTime.fromNowStartOfDay().toEpoch();

  console.log()
  console.log('-------------------------------------------------')
  console.log('------------------------------------- VACCINATION')
  console.log('-------------------------------------------------')

  let toBeCheckeds = []

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  await Promise.all(dataCompta.map(async (data) => {
    const epochArrival = DateTime.fromExcelSerialStartOfDay(data.arrival).toEpoch()

    if (epochToday < epochArrival) {
      const {pdfObject, contractName} = await helperCattery.helperPdf.getPdfDataFromDataCompta(data, comptaName, false)
      if (pdfObject.getExtend().version === undefined) {
        // return when version is undefined as the rcp vaccination date is not accurate enough
        return
      }
      await helperCattery.helperPdf.postErrorCheck(pdfObject, undefined)

      // vaccination date
      const epochDeparture = DateTime.fromExcelSerialStartOfDay(data.departure).toEpoch()
      const vaccinUptodate = helperCattery.helperPdf.isVaccinUptodate(pdfObject, epochDeparture)
      if (!vaccinUptodate) {
        data.rcps = pdfObject.getExtend().chat.rcps
        toBeCheckeds.push(data)
      }
    }
  }))

  toBeCheckeds.sort(function(a, b) { return b.epochArrival - a.epochArrival } );    // reverse order
  toBeCheckeds.forEach(data => console.log(`${data.name} departure: ${DateTime.fromExcelSerialStartOfDay(data.departure).toFormat('dd/MM/yyyy')}  rcps: ${data.rcps}`))
}

const xlsFormatComptaNoSort = {
  sheetName: helperCattery.helperXls.xlsFormatCompta.sheetName,
  cols: helperCattery.helperXls.xlsFormatCompta.cols,
  postComputationRow: helperCattery.helperXls.xlsFormatCompta.postComputationRow,
  postComputationSheet: (rows) => rows.filter(e => (e.name !== undefined) && !isNaN(e.comptaArrival) && !isNaN(e.comptaDeparture)),
}

async function main() {
  const argv = process.argv
  console.log(argv)
  console.log(`node bin/check-agenda.mjs "${argv[2]}" "${argv[3]}"`)

  // Reading compta and agenda data
  let dataCompta = helperExcel.readXls(argv[2], helperCattery.helperXls.xlsFormatCompta)
  let dataComptaNoSort = helperExcel.readXls(argv[2], xlsFormatComptaNoSort)
  let dataBank   = helperExcel.readXls(argv[2], helperCattery.helperXls.xlsFormatBank)
  let dataAgenda = helperExcel.readXls(argv[3], helperCattery.helperXls.xlsFormatAgenda)
  dataAgenda = filterConsecutive(dataAgenda)

  checkAcompte(dataComptaNoSort)
  checkBank(dataCompta, dataBank)

  // filter the dates from the compta that are prior the 1st arrival in the agenda
  const firstDate = dataAgenda[0].arrival
  dataCompta = dataCompta.filter(e => e.arrival >= firstDate)

  // check coherency
  // await checkVaccination(dataCompta, argv[2], argv[3])
  checkDates(dataCompta, dataAgenda)
  checkStatusPay(dataCompta)
}

try {
  await main();
  console.log('DONE')
} catch (e) {
  console.log(e)
}
helperJs.utils.sleep(60*60)   // sleep for 1 hour, so that the console does not disappear when ran from Excel
