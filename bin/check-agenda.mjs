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

  dates.forEach(d => {
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
  })
}

function checkStatusPay(dataCompta) {
  const epochToday = DateTime.fromNowStartOfDay().toEpoch();

  console.log()
  console.log('-------------------------------------------------')
  console.log('--------------------------------------------- PAY')
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


async function main() {
  const argv = process.argv

  // Reading compta and agenda data
  let dataCompta = helperExcel.readXls(argv[2], helperCattery.helperXls.xlsFormatCompta)
  let dataAgenda = helperExcel.readXls(argv[3], helperCattery.helperXls.xlsFormatAgenda)
  dataAgenda = filterConsecutive(dataAgenda)

  // filter the dates from the compta that are prior the 1st arrival in the agenda
  const firstDate = dataAgenda[0].arrival
  dataCompta = dataCompta.filter(e => e.arrival >= firstDate)

  // check coherency
  await checkVaccination(dataCompta, argv[2], argv[3])
  checkDates(dataCompta, dataAgenda)
  checkStatusPay(dataCompta)
}

await main();
