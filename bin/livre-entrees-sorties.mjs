/// Copyright (c) Pascal Brand
/// MIT License

import helperExcel from '../helpers/helperExcel.mjs'
import helperCattery from '../helpers/helperCattery.mjs'
import helperJs from '../helpers/helperJs.mjs'
import helperPdf from '../helpers/helperPdf.mjs'

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
  let dataCompta = helperExcel.readXls(comptaName, helperCattery.xlsFormatCompta)

  const dFrom = helperJs.date.fromFormatStartOfDay(from)
  const serialFrom = helperJs.date.toExcelSerial(dFrom)

  const dToday = helperJs.date.fromNowStartOfDay()
  const serialToday = helperJs.date.toExcelSerial(dToday)

  dataCompta = dataCompta.filter(c => ((serialFrom <= c.arrival) && (c.arrival <= serialToday)))

  const excludes = [ 'felv', 'rcp', 'maladies' ]
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
    const arrivalCell = helperJs.date.toFormat(helperJs.date.fromExcelSerialStartOfDay(data.arrival))
    let departureCell
    if (data.departure <= serialToday) {
      departureCell = helperJs.date.toFormat(helperJs.date.fromExcelSerialStartOfDay(data.departure))
    } else {
      departureCell = ''
    }

    const {pdfObject, contractName} = await helperCattery.getPdfDataFromDataCompta(data, comptaName, excludes)
    if (verboseStr !== '') {
      console.log('pdfObject: ', pdfObject[helperPdf.pdflib.helperProp])
    }

    const errorCell = `ERROR in ${contractName} from ${data.name}`
    // if (decompose === undefined) {
    //   rows.push([
    //     data.arrival,
    //     data.departure,
    //     arrivalCell,
    //     '',
    //     '',
    //     departureCell,
    //     errorCell,
    //   ])
    //   return
    // }

    // owner: name, address1, address2, phone
    const proprio = pdfObject[helperPdf.pdflib.helperProp].proprio
    const ownerCell = `${nameOrEmpty(proprio.nom,true)}${nameOrEmpty(proprio.adr1)}${nameOrEmpty(proprio.adr2)}${nameOrEmpty(proprio.tel)}`

    // const error = 
    //   (decompose.error !== undefined) ||
    //   (decompose.chatNom.length !== decompose.chatNaissance.length) ||
    //   (decompose.chatNom.length !== decompose.id.length)
    //   // do not check the race. Take the same if not same length
    const chat = pdfObject[helperPdf.pdflib.helperProp].chat
    const error = (chat.noms === undefined)
    if (error) {
      rows.push([
        data.arrival,
        data.departure,
        arrivalCell,
        `${chat.noms}\n${chat.ids}\n${chat.races}`,
        ownerCell,
        departureCell,
        errorCell,
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
