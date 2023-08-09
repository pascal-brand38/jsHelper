/// Copyright (c) Pascal Brand
/// MIT License

import helperExcel from '../helpers/helperExcel.mjs'
import helperEmailContrat from '../helpers/helperEmailContrat.mjs'
import helperJs from '../helpers/helperJs.mjs'

function nameOrEmpty(name) { 
  return name!==undefined ? '\n' + name : ''
}
async function main() {
  // helperExcel.writeXls('C:\\tmp\\test.ods', undefined, 'ods')

  const argv = process.argv
  if (argv.length !== 4) {
    helperJs.error('Usage: node bin/livre-entrees-sorties.mjs /c/Users/pasca/Desktop/P*Cats/compta.xls 01/01/2023')
  }

  const comptaName = argv[2]
  const from = argv[3]
  // console.log(argv)

  // Reading compta and agenda data
  let dataCompta = helperExcel.readXls(comptaName, helperEmailContrat.xlsFormatCompta)

  const dFrom = helperJs.date.fromFormatStartOfDay(from)
  const serialFrom = helperJs.date.toExcelSerial(dFrom)

  const dToday = helperJs.date.fromNowStartOfDay()
  const serialToday = helperJs.date.toExcelSerial(dToday)

  dataCompta = dataCompta.filter(c => ((serialFrom <= c.arrival) && (c.arrival <= serialToday)))

  const excludes = [ 'felv', 'rcp', 'maladies' ]
  let rows = []

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  await Promise.all(dataCompta.map(async (data) => {
    const arrivalCell = helperJs.date.toFormat(helperJs.date.fromExcelSerialStartOfDay(data.arrival))
    let departureCell
    if (data.departure <= serialToday) {
      const dDepature = helperJs.date.fromExcelSerialStartOfDay(data.departure)
      const sDeparture = helperJs.date.toFormat(dDepature)
      departureCell = helperJs.date.toFormat(helperJs.date.fromExcelSerialStartOfDay(data.departure))
    } else {
      departureCell = ''
    }

    const {fields, decompose, contractName} = await helperEmailContrat.getPdfDataFromDataCompta(data, comptaName, excludes)
    const errorCell = `ERROR in ${contractName}`
    if (decompose === undefined) {
      rows.push([
        data.arrival,
        arrivalCell,
        '',
        '',
        departureCell,
        errorCell,
      ])
      return
    }


    // owner: name, address1, address2, phone
    const ownerCell = `${fields.nom}\n${fields.adr1}\n${fields.adr2}\n${fields.tel}`

    const error = 
      (decompose.error !== undefined) ||
      (decompose.chatNom.length !== decompose.chatNaissance.length) ||
      (decompose.chatNom.length !== decompose.id.length)
      // do not check the race. Take the same if not same length

    if (error) {
      rows.push([
        data.arrival,
        arrivalCell,
        `${fields.chat}\n${fields.id}\n${fields.race}`,
        ownerCell,
        departureCell,
        errorCell,
      ])
    } else {
      let sexe = undefined
      if (fields.male && !fields.femelle) {
        sexe = 'Mâle'
      } if (!fields.male && fields.femelle) {
        sexe = 'Femelle'
      } 

      decompose.chatNom.forEach((c, index) => {
        let race = decompose.race[index]
        if (race === undefined) {
          race = decompose.race[0]    // A single race is provided when several cats have the same
        }
        if (race === '') {
          race = undefined
        }

        rows.push([
          data.arrival,
          arrivalCell,
          `${decompose.chatNom[index]}\n${decompose.chatNaissance[index]}\n${decompose.id[index]}${nameOrEmpty(race)}${nameOrEmpty(sexe)}`,
          ownerCell,
          departureCell,
          '',  
        ])
      })
    }
  }))

  rows.sort(function(a, b) { return a[0] - b[0] })    // sort using the serial arrival
  rows.forEach(row => row.shift())    // remove serial arrival used to sort the rows

  const odsFileName = 'C:\\tmp\\update-livre-entrees-sorties.ods'
  helperExcel.writeXls(odsFileName, 'Feuil 1', rows, 'ods')
  console.log(`Written file: ${odsFileName}`)
}

main();
