/// Copyright (c) Pascal Brand
/// MIT License

import helperExcel from '../helpers/helperExcel.mjs'
import helperEmailContrat from '../helpers/helperEmailContrat.mjs'
import helperJs from '../helpers/helperJs.mjs'

function nameOrEmpty(name, first=false) { 
  const sep = (first ? '' : '\n')
  return (name!==undefined && name!=='') ? sep + name : ''
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

  // debug purpose
  // set to name in compta to filter only these and have some verbose
  // set it to '' to disable debug mode
  const verboseStr = ''
  if (verboseStr !== '') {
    dataCompta = dataCompta.filter(c => (c.name === verboseStr))
  }

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  await Promise.all(dataCompta.map(async (data) => {
    const arrivalCell = helperJs.date.toFormat(helperJs.date.fromExcelSerialStartOfDay(data.arrival))
    let departureCell
    if (data.departure <= serialToday) {
      departureCell = helperJs.date.toFormat(helperJs.date.fromExcelSerialStartOfDay(data.departure))
    } else {
      departureCell = ''
    }

    const {fields, decompose, contractName} = await helperEmailContrat.getPdfDataFromDataCompta(data, comptaName, excludes)
    if (verboseStr !== '') {
      console.log('fields: ', fields)
      console.log('decompose: ', decompose)
    }

    const errorCell = `ERROR in ${contractName} from ${data.name}`
    if (decompose === undefined) {
      rows.push([
        data.arrival,
        data.departure,
        arrivalCell,
        '',
        '',
        departureCell,
        errorCell,
      ])
      return
    }

    // owner: name, address1, address2, phone
    const ownerCell = `${nameOrEmpty(fields.nom,true)}${nameOrEmpty(fields.adr1)}${nameOrEmpty(fields.adr2)}${nameOrEmpty(fields.tel)}`

    const error = 
      (decompose.error !== undefined) ||
      (decompose.chatNom.length !== decompose.chatNaissance.length) ||
      (decompose.chatNom.length !== decompose.id.length)
      // do not check the race. Take the same if not same length
    
    if (error) {
      rows.push([
        data.arrival,
        data.departure,
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
          data.departure,
          arrivalCell,
          `${nameOrEmpty(decompose.chatNom[index], true)}${nameOrEmpty(decompose.chatNaissance[index])}\n${decompose.id[index]}${nameOrEmpty(race)}${nameOrEmpty(sexe)}`,
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
}

main();
