/// Copyright (c) Pascal Brand
/// MIT License
///
/// Check  https://www.geeksforgeeks.org/how-to-read-and-write-excel-file-in-node-js/
/// and https://docs.sheetjs.com/
///
/// arg1 is the compta, and arg2 is the agenda

import helperExcel from '../helpers/helperExcel.mjs'
import helperEmailContrat from '../helpers/helperEmailContrat.mjs'
import helperPdf from '../helpers/helperPdf.mjs'
import helperJs from '../helpers/helperJs.mjs'

import path from 'path'
import fs from 'fs'

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
      console.log(`--- ${what} on ${helperJs.date.toFormat(helperExcel.serialToDate(d.date))} ----------------`)
      console.log('Compta: ')
      compta.forEach(c => console.log(`   ${c.name}`))
      console.log('Agenda: ')
      agenda.forEach(c => console.log(`   ${c.name}`))
    }
  })
}

function checkStatusPay(dataCompta) {
  const epochToday = helperJs.date.epoch(helperJs.date.now());

  console.log('-------------------------------------------------')
  console.log('------------------------------------------ COMPTA')
  console.log('-------------------------------------------------')
  dataCompta.forEach(data => {
    const dArrival = helperExcel.serialToDate(data.arrival)
    const arrivalStr = helperJs.date.toFormat(dArrival)
    const epochArrival = helperJs.date.epoch(dArrival)
    const epochArrival10 = epochArrival + helperJs.date.epochNDays(10)
    const epochArrival20 = epochArrival + helperJs.date.epochNDays(20)
    if (epochArrival < epochToday) {
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
  const epochToday = helperJs.date.epoch(helperJs.date.now());
  const rootDir = path.parse(comptaName).dir
  const enterprise = path.parse(rootDir).base
  const contractRootDir = rootDir + '\\Contrat Clients ' + enterprise

  console.log()
  console.log('-------------------------------------------------')
  console.log('------------------------------------- VACCINATION')
  console.log('-------------------------------------------------')

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  await Promise.all(dataCompta.map(async (data) => {
    const epochArrival = helperJs.date.epoch(helperExcel.serialToDate(data.arrival))

    if (epochToday < epochArrival) {
      // this one should come in the future
      // check in the contract if vaccination rcp is up-to-date

      // get the pdf contract
      const sComptaArrival = helperJs.date.toFormat(helperExcel.serialToDate(data['comptaArrival']))
      const currentContractDir = contractRootDir + '\\' + helperEmailContrat.getCurrentContractDir(contractRootDir, data['name']);
      const contractName = helperEmailContrat.getContractName(sComptaArrival, currentContractDir);

      // check rcp date
      const pdf = await helperPdf.load(currentContractDir + '\\' + contractName)
      const fields = helperPdf.getFields(pdf, helperEmailContrat.fieldsMatch)
      const decompose = helperPdf.decomposeFields(fields, helperEmailContrat.fieldsMatch)

      // if an rcp date starts with Error, that means something's wrong withe the extraction
      let toBeChecked = ((decompose['rcp'] === undefined) || (decompose['rcp'] === []))
      if (!toBeChecked) {
        const epochDeparture = helperJs.date.epoch(helperExcel.serialToDate(data.departure))
    
        decompose['rcp'].every(date => {
          toBeChecked = date.startsWith('Error')
          if (!toBeChecked) {
            const rcpDate = helperJs.date.fromFormat(date)
            const epochRcp = helperJs.date.epoch(rcpDate)
            const epochRcpNext = epochRcp + helperJs.date.epochNDays(365)
            toBeChecked = (epochRcpNext < epochDeparture)
          }
          return !toBeChecked
        })
      }
      if (toBeChecked) {
        console.log('RESULT: ', data['name'], sComptaArrival, ': ', decompose['rcp'])
      }
      //console.log(decompose.chatNom, ': ', decompose['rcp'])
    }
  }))
}


async function main() {

  // console.log(helperJs.date.now())
  // helperEmailContrat.error('QUIT')

  const argv = process.argv
  // console.log(argv)

  // Reading compta and agenda data
  let dataCompta = helperExcel.readXls(argv[2], helperEmailContrat.xlsFormatCompta)
  let dataAgenda = helperExcel.readXls(argv[3], helperEmailContrat.xlsFormatAgenda)
  dataAgenda = filterConsecutive(dataAgenda)

  // filter the dates from the compta that are prior the 1st arrival in the agenda
  const firstDate = dataAgenda[0].arrival
  dataCompta = dataCompta.filter(e => e.arrival >= firstDate)

  // check coherency
  checkDates(dataCompta, dataAgenda)
  checkStatusPay(dataCompta)
  await checkVaccination(dataCompta, argv[2], argv[3])
}

main();
