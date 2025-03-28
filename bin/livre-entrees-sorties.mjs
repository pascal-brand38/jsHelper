#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License

import helperExcel from '../helpers/helperExcel.mjs'
import helperCattery from '../helpers/helperCattery.mjs'
import helperJs from '../js/helpers/helperJs.mjs'
import { DateTime } from 'luxon'
import '../js/extend/luxon.mjs'

function nameOrEmpty(name, first=false) {
  const sep = (first ? '' : '\n')
  return (name!==undefined && name!=='') ? sep + name : ''
}
async function main() {
  // helperExcel.writeXls('C:\\tmp\\test.ods', undefined, 'ods')

  const argv = process.argv
  if (argv.length !== 4) {
    helperJs.error('Usage: node bin/livre-entrees-sorties.mjs /c/Users/pasca/Desktop/P*Cats/compta.ods 01/01/2023')
  }

  const comptaName = argv[2]
  const from = argv[3]
  // console.log(argv)

  // Reading compta and agenda data
  let dataCompta = helperExcel.readXls(comptaName, helperCattery.helperXls.xlsFormatCompta)

  const serialFrom = DateTime.fromFormatStartOfDay(from).toExcelSerial()
  const serialToday = DateTime.fromNowStartOfDay().toExcelSerial()

  dataCompta = dataCompta.filter(c => ((serialFrom <= c.arrival) && (c.arrival <= serialToday)))

  let rows = []         // list of rows to be saved in the final ods file
  let skippeds = []     // list of skipped arrival because of errors (no ids,...)

  // debug purpose
  // set to name in compta to filter only these and have some verbose
  // set it to '' to disable debug mode
  const verboseStr = ''
  if (verboseStr !== '') {
    dataCompta = dataCompta.filter(c => (c.name === verboseStr))
  }

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  await Promise.all(dataCompta.map(async (data) => {
    const arrivalCell = DateTime.fromExcelSerialStartOfDay(data.arrival).toFormat('dd/MM/yyyy')
    let departureCell
    if (data.departure <= serialToday) {
      departureCell = DateTime.fromExcelSerialStartOfDay(data.departure).toFormat('dd/MM/yyyy')
    } else {
      departureCell = ''
    }

    const {pdfObject, contractName} = await helperCattery.helperPdf.getPdfDataFromDataCompta(data, comptaName, false)
    if (verboseStr !== '') {
      console.log('pdfObject: ', pdfObject.getExtend())
    }

    // owner: name, address1, address2, phone
    const proprio = pdfObject.getExtend().proprio
    const ownerCell = `${nameOrEmpty(proprio.nom,true)}${nameOrEmpty(proprio.adr1)}${nameOrEmpty(proprio.adr2)}${nameOrEmpty(proprio.tel)}`

    const chat = pdfObject.getExtend().chat
    const error = (chat.noms === undefined)
    if (error) {
      rows.push([
        data.arrival,
        data.departure,
        arrivalCell,
        `${chat.noms}\n${chat.ids}\n${chat.races}`,
        ownerCell,
        departureCell,
        `ERROR in ${contractName} from ${data.name}`,
      ])
    } else {
      chat.noms.forEach((c, index) => {
        if (chat.ids[index] === '') {
          skippeds.push({
            reason: 'id not found',
            name: data.name,
            contract: contractName,
            arrival: arrivalCell,
          })
          return    // skip the cats without known id
        }

        let sexe = ''
        if (chat.males[index]) {
          sexe = 'Male'
        } else if (chat.femelles[index]) {
          sexe = 'Femelle'
        }

        rows.push([
          data.arrival,
          data.departure,
          arrivalCell,
          `${nameOrEmpty(chat.noms[index], true)}${nameOrEmpty(chat.naissances[index])}\n${chat.ids[index]}${nameOrEmpty(chat.races[index])}${nameOrEmpty(sexe)}`,
          ownerCell,
          departureCell,
          '',
        ])
      })
    }
  }))

  rows.sort(function(a, b) {
    if (a[0] === b[0]) {
      return a[1] - b[1]    // sort on departure if same arrival
    }
    return a[0] - b[0]      // sort on arrival
  })
  rows.forEach(row => { row.shift(); row.shift()})    // remove serial arrival and departure used to sort the rows

  const odsFileName = 'C:\\tmp\\update-livre-entrees-sorties.ods'
  helperExcel.writeXls(odsFileName, 'Feuil 1', rows, 'ods')

  console.log(`Written file: ${odsFileName}`)
  console.log('skippeds: ', skippeds)
}

await main();
console.log('DONE!')
process.exit(0)
