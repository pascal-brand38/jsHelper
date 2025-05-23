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
import { DateTime } from 'luxon'
import '../js/extend/luxon.mjs'
import helperJs from '../js/helpers/helperJs.mjs'

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


function normalizeStr(str) {
  const reSpace = /[\s]+/g;   // series of space, tab, non-printeable space... to a single space
  const reSlash = /\//g;      // '/' as a '-'
  return str
    .toLowerCase()
    .trim()
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
    .replace(reSpace, ' ')
    .replace(reSlash, '-')  // so now who does contain neither accents nor double-space nor slash (replace with dash)
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
      let errorFound = false
      const what = d.what
      const whatStr = (what === 'departure' ? 'Départ ' : 'Arrivée')
      const compta = dataCompta.filter(e => e[what] === d.date)   // .sort((a,b) => a.name.localeCompare(b.name))
      const agenda = dataAgenda.filter(e => e[what] === d.date)
      const mustHaveAnError = (compta.length !== agenda.length)
      for (let i=0; i<agenda.length; i++) {
        // get the corresponding compta book
        let found = -1
        const agendaNames = normalizeStr(agenda[i].name).split(' ').filter(n => ((n !== 'et') && (n.length >= 3)))
        for (let j=0; j<compta.length; j++) {
          // corresponding if first 3 letters are the same
          const startComptaNames = normalizeStr(compta[j].name).split(' ')
          const startComptaName = startComptaNames[0]   // name of the 1st cat
          if (agendaNames.includes(startComptaName)) {
            found = j
            break
          }
        }

        if (found === -1) {
          // did not found a match ==> error: in agenda, but not in compta
          errorFound = true
          console.log(`${whatStr} le ${DateTime.fromExcelSerialStartOfDay(d.date).toFormat('dd/MM/yyyy')} - ${'\x1b[31m'}Agenda${'\x1b[0m'}: ${agenda[i].name}`)
        } else {
          // remove this compta from the list to search
          compta.splice(found, 1)
        }
      }
      for (let i=0; i<compta.length; i++) {
        errorFound = true
        console.log(`${whatStr} le ${DateTime.fromExcelSerialStartOfDay(d.date).toFormat('dd/MM/yyyy')} - ${'\x1b[34m'}Compta${'\x1b[0m'}: ${compta[i].name}`)
      }

      if ((!errorFound) && (mustHaveAnError)) {
        helperJs.logError(`${DateTime.fromExcelSerialStartOfDay(d.date).toFormat('dd/MM/yyyy')}: Incohérence sur les ${whatStr} entre agenda et compta`)
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
      data.statusPay.forEach((status, index) => {
        switch (status) {
          case 'Attente':
            console.log(`*** ATTENTE  ${arrivalStr} ${data.name} ${data.amountPay[index]}€`)
            break
          case 'Reçu':
            if (epochArrival10 < epochToday) {
              console.log(`    Reçu     ${arrivalStr} ${data.name} ${data.amountPay[index]}€`)
            }
            break
          case 'Envoyé':
            if (epochArrival20 < epochToday) {
              console.log(`    Envoyé   ${arrivalStr} ${data.name} ${data.amountPay[index]}€`)
            }
            break
        }
      })
    }

    data.statusPay.forEach((status, index) => {
      switch (status) {
        case undefined:
          if ((data.amountPay[index] !== undefined) || (data.datePay[index] !== undefined) || (data.typePay[index] !== undefined)) {
            console.log(`*** status=${status} but some data for ${arrivalStr} ${data.name}`)
          }
          break
        case 'Attente':
          if ((data.amountPay[index] === undefined) || (data.datePay[index] !== undefined) || (data.typePay[index] !== undefined)) {
            console.log(`*** status=${status} but wrong data for ${arrivalStr} ${data.name}`)
          }
          break
        case 'Reçu':
        case 'Envoyé':
        case 'Encaissé':
          if ((data.amountPay[index] === undefined) || (data.datePay[index] === undefined) || (data.typePay[index] === undefined)) {
            console.log(`*** status=${status} but wrong data for ${arrivalStr} ${data.name}`)
          }
          break
      }
    })
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
  console.log('------------------------------ ACOMPTE EN ATTENTE')
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

  dataFilled = dataFilled.filter(data => (data.date >= excelStart))

  if ((dataBankToCheck.length !==0) || (dataFilled.length !==0)) {
  console.log()
    console.log('-------------------------------------------------')
    console.log('---------------------------------- BANK vs COMPTA')
    console.log('-------------------------------------------------')


    dataBankToCheck.forEach(bank => {
      console.log(`Bank: ${DateTime.fromExcelSerialStartOfDay(bank.date).toFormat('dd/MM/yyyy')} - ${bank.name} ${bank.credit}€`)
    })

    dataFilled.forEach(data => {
      console.log(`Compta: ${DateTime.fromExcelSerialStartOfDay(data.date).toFormat('dd/MM/yyyy')} - ${data.name} ${data.amount}€`)
    })
  }
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


// check if vaccination rcp is up-to-date for the cats that are in the cattery
// it helps updating the contract accordingly
async function missingInformation(dataCompta, comptaName, AgendaName) {
  const epochToday = DateTime.fromNowStartOfDay().toEpoch();

  let toBeCheckeds = []

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  await Promise.all(dataCompta.map(async (data) => {
    const epochArrival = DateTime.fromExcelSerialStartOfDay(data.arrival).toEpoch()
    const epochDeparture = DateTime.fromExcelSerialStartOfDay(data.departure).toEpoch()

    if ((epochArrival <= epochToday) && (epochToday <= epochDeparture)) {
      const {pdfObject, contractName} = await helperCattery.helperPdf.getPdfDataFromDataCompta(data, comptaName, false, true)
      if (pdfObject.getExtend().version === undefined) {
        // return when version is undefined as the rcp vaccination date is not accurate enough
        return
      }
      await helperCattery.helperPdf.postErrorCheck(pdfObject, undefined)

      // vaccination date
      let check = false
      const vaccinUptodate = helperCattery.helperPdf.isVaccinUptodate(pdfObject, epochDeparture)
      if (!vaccinUptodate) {
        data.rcps = pdfObject.getExtend().chat.rcps
        check = true
      }
      const missing = helperCattery.helperPdf.missingInformation(pdfObject)
      if (missing.length !== 0) {
        data.missing = missing
        check = true
      }
      if (check) {
        toBeCheckeds.push(data)
      }
    }
  }))

  if (toBeCheckeds.length !== 0) {
    console.log()
    console.log('-------------------------------------------------')
    console.log('------------------------- INFORMATIONS MANQUANTES')
    console.log('-------------------------------------------------')

    toBeCheckeds.sort(function(a, b) { return b.epochArrival - a.epochArrival } );    // reverse order
    toBeCheckeds.forEach(data => {
      if (data.rcps) {
        console.log(`${data.name} Départ le ${DateTime.fromExcelSerialStartOfDay(data.departure).toFormat('dd/MM/yyyy')}, ${helperJs.textColor('Vaccination RCP', 'FgGreen')}, le ${data.rcps}`)
      }
      if (data.missing !== undefined) {
        console.log(`${data.name} Informations manquantes`)
        console.log('    ', data.missing)
      }
    })
  }
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
  await missingInformation(dataCompta, argv[2], argv[3])

  // filter the dates from the compta that are prior the 1st arrival in the agenda
  checkDates(dataCompta.filter(e => e.arrival >= dataAgenda[0].arrival), dataAgenda)

  checkStatusPay(dataCompta)
  checkBank(dataCompta, dataBank)
}

try {
  await main();
  console.log('DONE')
} catch (e) {
  console.log(e)
}
await helperJs.utils.sleep(60*60)   // sleep for 1 hour, so that the console does not disappear when ran from Excel
