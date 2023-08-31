/// Copyright (c) Pascal Brand
/// MIT License
///
// Based on pdf-lib
//   npm install pdf-lib
//
// from https://pdf-lib.js.org/#fill-form
//
// Check pdf validity using:
//    - https://www.pdf-online.com/osa/validate.aspx
//
//    - Convert to pdf/A (from https://stackoverflow.com/questions/1659147/how-to-use-ghostscript-to-convert-pdf-to-pdf-a-or-pdf-x)
//      and then check manually the results, if all fields are correct
//      /c/Program\ Files/gs/gs10.00.0/bin/gswin64.exe -dPDFA -dBATCH -dNOPAUSE -sProcessColorModel=DeviceRGB -sDEVICE=pdfwrite -sPDFACompatibilityPolicy=1 -sOutputFile=output_filename.pdf input_filename.pdf
//
//    - Check ghoscript console to see if there can be errors (like more fonts than expected)
//        /c/Program\ Files/gs/gs10.00.0/bin/gswin64.exe -r36x36 file.pdf
//      a single 'Loading font Helvetica' must appear
//
//    Do not use the followings which are too simple (look for count page,...):
//        https://www.npmjs.com/package/is-pdf-valid
//        https://www.npmjs.com/package/@ninja-labs/verify-pdf
//        https://www.npmjs.com/package/ghostscript-node




import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import child_process from 'child_process'
import {decode} from 'html-entities';
import helperEmailContrat from '../helpers/helperEmailContrat.mjs';
import helperPdf from '../helpers/helperPdf.mjs'
import helperJs from '../helpers/helperJs.mjs';


function get_args() {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  var options = yargs
    .usage('Create a contract from an excel compta macro directly\n\nUsage: $0 [options]')
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "root-dir": {
        description: "directory that contains all contract directories, as well as the blank contract",
        requiresArg: true,
        required: true
      },
      "blank-contract": {
        description: "<filename.pdf> of the blank contract",
        requiresArg: true,
        required: true
      },
      "who": {
        description: "who in the compta. Contains cat's name and owner's name",
        requiresArg: true,
        required: true
      },

      "from": {
        description: "Starting date, format dd/mm/yyyy",
        requiresArg: true,
        required: true
      },
      "to": {
        description: "End date, format dd/mm/yyyy",
        requiresArg: true,
        required: true
      },
      "priceday": {
        description: "Price per day, without the € sign",
        requiresArg: true,
        required: true
      },
      "nbdays": {
        description: "Nb of days",
        requiresArg: true,
        required: true
      },
      "services": {
        description: "Services to be included",
        requiresArg: true,
        required: true
      },
      "total": {
        description: "Total price",
        requiresArg: true,
        required: true
      },
      "accompte": {
        description: "Accompte asked for",
        requiresArg: true,
        required: true
      },
      "date_accompte": {
        description: "Date of the accompte if already paid",
        requiresArg: true,
        required: true
      },
      "solde": {
        description: "Amount on arrival date",
        requiresArg: true,
        required: true
      },
      
    })
    .argv;
  
  options.who = decode(options.who)
  options.services = decode(options.services)

  return options;
}


const _currentVersionContrat = 20230826

function getVersion(pdfObject) {
  pdfObject[helperPdf.pdflib.helperProp].version = helperPdf.getTextfieldAsInt(pdfObject, 'versionContrat')
}

function getTextfromCandidates(pdfObject, args) {
  let result = undefined
  // args if a list of fields, being candidate to have the info
  args.every(field => {
    try {
      result = pdfObject.form.getTextField(field).getText();
      if (result === undefined) {
        result = ''
      }
      return false    // found - stop the every function
    } catch {
      return true     // not found - continue
    }
  })
  return result
}

function setPropFromTextfieldCandidates(pdfObject, prop, args, result) {
  result[prop] = getTextfromCandidates(pdfObject, args)
}

function setProplistFromTextfieldCandidates(pdfObject, prop, args, result) {
  result[prop] = [ getTextfromCandidates(pdfObject, args) ]
}

function setProplistFromCheckCandidates(pdfObject, prop, args, result) {
  let res = false
  args.every(field => {
    try {
      res = pdfObject.form.getCheckBox(field).isChecked();
      return false    // found - stop the every function
    } catch {
      return true     // not found - continue
    }
  })

  const lNom = pdfObject[helperPdf.pdflib.helperProp].chat.noms.length
  result[prop] = [ res ].slice(0, lNom)
}

function getNamesAndBirthFromNameAndBirth(value) {
  value = helperEmailContrat.normalize(value)
  let values = helperEmailContrat.separate(value)    // get a list of values per cat in this pdf
  let noms = []
  let naissances = []

  let firstBirthDate = undefined

  values.forEach(v => {
    let name = v.split(' dit ')
    let next
    if (name.length === 2) {
      next = name[1].split(' ')
      noms.push(`${name[0]} dit ${next.shift()}`)
    } else {
      name = v.split(' ')
      noms.push(name.shift())
      next = name
    }

    let d = helperEmailContrat.getDate(next, undefined)
    naissances.push(d)
    if ((d !== '') && (firstBirthDate !== undefined)) {
      firstBirthDate = d
    }
  })

  // check for all birth date, in case some are not found
  if (firstBirthDate !== undefined) {
    naissances.forEach((d, index) => {
      if (d === '') {
        naissances[index] = d
      }
    })
  }

  return { noms: noms, naissances: naissances}
}

function setCatNamesFromSingleName(pdfObject, prop, args, result) {
  let res = getNamesAndBirthFromNameAndBirth(getTextfromCandidates(pdfObject, args))
  result[prop] = res.noms
}

function setBirthsFromSingleName(pdfObject, prop, args, result) {
  let res = getNamesAndBirthFromNameAndBirth(getTextfromCandidates(pdfObject, args))
  result[prop] = res.naissances
}

function setPropMultipleFromSingle(pdfObject, prop, args, result) {
  let value = getTextfromCandidates(pdfObject, args)
  value = helperEmailContrat.normalize(value)
  const values = helperEmailContrat.separate(value)    // get a list of values per cat in this pdf
  result[prop] = values
}

function setDatesFromSingle(pdfObject, prop, args, result) {
  let value = getTextfromCandidates(pdfObject, args)
  value = helperEmailContrat.normalize(value)
  let values = helperEmailContrat.separate(value)    // get a list of values per cat in this pdf

  let catNames = pdfObject[helperPdf.pdflib.helperProp]['chat']['noms']
  if ((catNames !== undefined) && (catNames.length !== values.length)) {
    // different number of cats and dates
    pdfObject[helperPdf.pdflib.helperProp].errors.push(`setDatesFromSingle: error with cats and ${prop} number: ${catNames}  vs  ${values}`)
    return
  }

  result[prop] = []
  values.forEach((v, i) => {
    if (catNames !== undefined) {
      catNames.every((cat, j) => {
        if ((i!==j) && (v.toLowerCase().includes(cat.toLowerCase()))) {
          // different cats order
          pdfObject[helperPdf.pdflib.helperProp].errors.push(`setDatesFromSingle: error with cat order in ${values}`)
          return false
        }
        return true
      })
    }
     let d = helperEmailContrat.getDate(v.split(' '), prop)
     if (d === '') {
      pdfObject[helperPdf.pdflib.helperProp].errors.push(`setDatesFromSingle: error with ${v}`)
    } else {
      result[prop].push(d)
     }
  })
}


function postErrorCheck(pdfObject, result) {
  if (pdfObject[helperPdf.pdflib.helperProp].errors.length !== 0) {
    console.log('List of errors:')
    console.log(pdfObject[helperPdf.pdflib.helperProp].errors)
    helperJs.error('QUIT')
  }
}

function postSetPropFromFieldsV0(pdfObject, result) {
  const chat = result.chat

  // check coherency on number of cats and number of ids,...
  const nbChats = chat.noms.length
  if (nbChats == 0) {
    pdfObject[helperPdf.pdflib.helperProp].errors.push(`Impossible d'extraire le nom du chat du contrat ${pdfObject[helperPdf.pdflib.helperProp].pdfFullName}`)
  }
  if (nbChats > 3) {
    pdfObject[helperPdf.pdflib.helperProp].errors.push(`Impossible d'avoir plus de 3 chats dans le contrat`)
  }

  [ chat.naissances, chat.ids, chat.races, chat.felvs, chat.rcps ] . forEach ( v => {
    const l = v.length
    if ((l !== 0) && (l != nbChats)) {
      pdfObject[helperPdf.pdflib.helperProp].errors.push(`Incoherence entre nombre de chats et ${v}`)
    }
  })

  // check maladies, when several cats, this is not possible to know which on it is
  if ((chat.maladies[0] !== '') && (nbChats > 1)) {
    pdfObject[helperPdf.pdflib.helperProp].errors.push(`Maladies et plus de 1 chat`)
  }

  // post proc maladies as array of array
  const m = chat.maladies
  chat.maladies = [ [ m[0] ], [], [] ]

  // check male and femelle
  if ((chat.male[0]) && (chat.femelle[0])) {
    pdfObject[helperPdf.pdflib.helperProp].errors.push(`Male ET femelle`)
  }

  postErrorCheck(pdfObject, result)
}



function pdfExtractInfoDatas(version) {
  if (version === undefined) {
    return {
      setPropFromFieldsDatas: [
        {
          prop: 'proprio',
          setPropFromFieldsDatas: [
            { prop: 'nom',             method: setPropFromTextfieldCandidates,     args: [ 'Nom Prénom' ] },
            { prop: 'adr1',            method: setPropFromTextfieldCandidates,     args: [ 'Adresse 1' ] },
            { prop: 'adr2',            method: setPropFromTextfieldCandidates,     args: [ 'Adresse 2' ] },
            { prop: 'tel',             method: setPropFromTextfieldCandidates,     args: [ 'Téléphone' ] },
            { prop: 'email',           method: setPropFromTextfieldCandidates,     args: [ 'Adresse email' ] },
            { prop: 'urgenceNom',      method: setPropFromTextfieldCandidates,     args: [ 'Personne autre que moi à prévenir en cas durgence', 'Personne à prévenir en cas durgence' ] },
            { prop: 'urgenceTel',      method: setPropFromTextfieldCandidates,     args: [ 'Téléphone_2' ] },
          ],
        },
        {
          prop: 'chat',
          setPropFromFieldsDatas: [
            { prop: 'noms',            method: setCatNamesFromSingleName,          args: [ '1' ] },
            { prop: 'naissances',      method: setBirthsFromSingleName,            args: [ '1' ] },
            { prop: 'ids',             method: setPropMultipleFromSingle,          args: [ '2' ] },
            { prop: 'races',           method: setPropMultipleFromSingle,          args: [ 'undefined' ] },
            { prop: 'felvs',           method: setDatesFromSingle,                 args: [ 'Leucose FELV' ] },
            { prop: 'rcps',            method: setDatesFromSingle,                 args: [ 'Typhus coryza RCP' ] },
            { prop: 'maladies',        method: setProplistFromTextfieldCandidates, args: [ 'undefined_4' ] },
            { prop: 'male',            method: setProplistFromCheckCandidates,     args: [ 'Mâle' ] },
            { prop: 'femelle',         method: setProplistFromCheckCandidates,     args: [ 'Femelle' ] },
          ],
        },
      ],
      postSetPropFromFields: postSetPropFromFieldsV0,
    }
  } else if (version === 20230826) {
    return {
      setPropFromFieldsDatas: [
        {
          prop: 'proprio',
          setPropFromFieldsDatas: [
            { prop: 'nom',             method: setPropFromTextfieldCandidates,     args: [ 'pNom' ] },
            { prop: 'adr1',            method: setPropFromTextfieldCandidates,     args: [ 'pAddr1' ] },
            { prop: 'adr2',            method: setPropFromTextfieldCandidates,     args: [ 'pAddr2' ] },
            { prop: 'tel',             method: setPropFromTextfieldCandidates,     args: [ 'pTel' ] },
            { prop: 'email',           method: setPropFromTextfieldCandidates,     args: [ 'pEmail' ] },
            { prop: 'urgenceNom',      method: setPropFromTextfieldCandidates,     args: [ 'pUrgence1' ] },
            { prop: 'urgenceTel',      method: setPropFromTextfieldCandidates,     args: [ 'pUrgence1' ] },
          ],
        },
        {
          prop: 'chat',
          setPropFromFieldsDatas: [
            { prop: 'noms',            method: helperPdf.pdflib.setProplistFromTextfieldlist,  args: [ 'c1Nom', 'c2Nom', 'c3Nom' ] },
            { prop: 'naissances',      method: helperPdf.pdflib.setProplistFromTextfieldlist,  args: [ 'c1Naissance', 'c2Naissance', 'c3Naissance' ] },
            { prop: 'ids',             method: helperPdf.pdflib.setProplistFromTextfieldlist,  args: [ 'c1Id', 'c2Id', 'c3Id' ] },
            { prop: 'races',           method: helperPdf.pdflib.setProplistFromTextfieldlist,  args: [ 'c1Race', 'c2Race', 'c3Race' ] },
            { prop: 'felvs',           method: helperPdf.pdflib.setProplistFromTextfieldlist,  args: [ 'c1VaccinFELV', 'c2VaccinFELV', 'c3VaccinFELV' ] },
            { prop: 'rcps',            method: helperPdf.pdflib.setProplistFromTextfieldlist,  args: [ 'c1VaccinRCP', 'c2VaccinRCP', 'c3VaccinRCP' ] },
            { prop: 'maladies',        method: helperPdf.pdflib.setProplistlistFromTextfieldlistlist, args: [ [ 'c1Maladie1', 'c1Maladie2', 'c1Maladie3' ], [ 'c2Maladie1', 'c2Maladie2', 'c2Maladie3' ], [ 'c3Maladie1', 'c3Maladie2', 'c3Maladie3' ] ] },
            { prop: 'male',            method: helperPdf.pdflib.setProplistFromChecklist,      args: [ 'c1Male', 'c2Male', 'c3Male' ] },
            { prop: 'femelle',         method: helperPdf.pdflib.setProplistFromChecklist,      args: [ 'c1Femelle', 'c2Femelle', 'c3Femelle' ] },
          ],
        },
      ],
      postSetPropFromFields: postErrorCheck,
    }
  }

  helperJs.error(`pdfExtractInfoDatas() does not know version ${version}`)
  return undefined
}

async function updatePDF(options, currentContractDir, lastContractName) {
  const lastContract = await helperPdf.pdflib.load(currentContractDir + '\\' + lastContractName, getVersion)
  const newContract = await helperPdf.pdflib.load(options.rootDir + '\\' + options.blankContract, getVersion)

  if (newContract[helperPdf.pdflib.helperProp].version !== _currentVersionContrat) {
    helperJs.error(`New contract version:\n  Expected: ${_currentVersionContrat}\n  and is: ${newContract[helperPdf.pdflib.helperProp].version}`)
  }

  if (false) {
    console.log('printing...')
    const fields = lastContract.form.getFields()
    fields.forEach(field => {
      const type = field.constructor.name;
      const name = field.getName();
      console.log(type + '     ' + name);
    });
    helperJs.error('QUIT')
  }

  // cf. https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedfont
  // const helvetica = await newContract.pdf.embedFont(StandardFonts.Helvetica)
  newContract.pdf.registerFontkit(fontkit)
  //const fontToUse = await newContract.pdf.embedFont(fs.readFileSync('C:\\Windows\\Fonts\\ARLRDBD.TTF'))
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fontToUse = await newContract.pdf.embedFont(fs.readFileSync(path.join(__dirname, 'Helvetica.ttf')))

  const epochDeparture = helperJs.date.toEpoch(helperJs.date.fromFormatStartOfDay(options.to))

  const pdfInfoData = pdfExtractInfoDatas(lastContract[helperPdf.pdflib.helperProp].version)
  helperPdf.pdflib.setPropFromFields(lastContract, pdfInfoData.setPropFromFieldsDatas, pdfInfoData.postSetPropFromFields)

  helperPdf.pdflib.setTextfield(newContract, 'pNom',       lastContract[helperPdf.pdflib.helperProp].proprio.nom,        fontToUse)
  helperPdf.pdflib.setTextfield(newContract, 'pAddr1',     lastContract[helperPdf.pdflib.helperProp].proprio.adr1,       fontToUse)
  helperPdf.pdflib.setTextfield(newContract, 'pAddr2',     lastContract[helperPdf.pdflib.helperProp].proprio.adr2,       fontToUse)
  helperPdf.pdflib.setTextfield(newContract, 'pTel',       lastContract[helperPdf.pdflib.helperProp].proprio.tel,        fontToUse)
  helperPdf.pdflib.setTextfield(newContract, 'pEmail',     lastContract[helperPdf.pdflib.helperProp].proprio.email,      fontToUse)
  helperPdf.pdflib.setTextfield(newContract, 'pUrgence1',  lastContract[helperPdf.pdflib.helperProp].proprio.urgenceNom, fontToUse)
  helperPdf.pdflib.setTextfield(newContract, 'pUrgence2',  lastContract[helperPdf.pdflib.helperProp].proprio.urgenceTel, fontToUse)

  helperPdf.pdflib.setTextfields(newContract, ['c1Nom', 'c2Nom', 'c3Nom'], lastContract[helperPdf.pdflib.helperProp].chat.noms, fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c1Naissance', 'c2Naissance', 'c3Naissance'], lastContract[helperPdf.pdflib.helperProp].chat.naissances, fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c1Id', 'c2Id', 'c3Id'], lastContract[helperPdf.pdflib.helperProp].chat.ids, fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c1Race', 'c2Race', 'c3Race'], lastContract[helperPdf.pdflib.helperProp].chat.races, fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c1VaccinFELV', 'c2VaccinFELV', 'c3VaccinFELV'], lastContract[helperPdf.pdflib.helperProp].chat.felvs, fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c1VaccinRCP', 'c2VaccinRCP', 'c3VaccinRCP'], lastContract[helperPdf.pdflib.helperProp].chat.rcps, fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c1Maladie1', 'c1Maladie2', 'c1Maladie3'], lastContract[helperPdf.pdflib.helperProp].chat.maladies[0], fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c2Maladie1', 'c2Maladie2', 'c2Maladie3'], lastContract[helperPdf.pdflib.helperProp].chat.maladies[1], fontToUse)
  helperPdf.pdflib.setTextfields(newContract, ['c3Maladie1', 'c3Maladie2', 'c3Maladie3'], lastContract[helperPdf.pdflib.helperProp].chat.maladies[2], fontToUse)

  // male / femelle
  const m = ['c1Male', 'c2Male', 'c3Male']
  const f = ['c1Femelle', 'c2Femelle', 'c3Femelle']
  const chat = lastContract[helperPdf.pdflib.helperProp].chat
  chat.noms.forEach((c, index) => {
    if (chat.male[index]) {
      helperPdf.pdflib.checks(newContract, [ m[index] ])
    }
    if (chat.femelle[index]) {
      helperPdf.pdflib.checks(newContract, [ f[index] ])
    }
  })

  // check vaccination date
  const remarque = ['c1VaccinRemarque', 'c2VaccinRemarque', 'c3VaccinRemarque']
  lastContract[helperPdf.pdflib.helperProp].chat.rcps.forEach((date, index) => {
    const epochRcp = helperJs.date.toEpoch(helperJs.date.fromFormatStartOfDay(date))
    const epochRcpNext = epochRcp + helperJs.date.epochNDays(365)
    console.log(`${epochRcp} ${epochRcp}`)
    if (epochRcpNext < epochDeparture) {
      console.log('A REFAIRE')
      helperPdf.pdflib.setTextfield(newContract, remarque[index], 'RAPPEL A REFAIRE', fontToUse)
    }
  })

  let services = []
  if (options.services==='') {
    services.push('0€')
  } else {
    services = options.services.split(' + ')
  }
  const reservations = [
    [ 'sArriveeDate', options.from ],
    [ 'sDepartDate', options.to ],
    [ 'sNbJours', options.nbdays.toString() ],
    [ 'sTarifJour', options.priceday + '€' ],
    [ 'sTotal', options.total + '€' ],
    [ 'sAcompte', (options.accompte==='') ? ('0€') : (options.accompte + '€') ],
    [ 'sAcompteDate', options.date_accompte ],
    [ 'sSolde', options.solde + '€' ],
    [ 'sService1', services[0] ],
    [ 'sService2', (services.length >= 2) ? services[1] : '' ],
    [ 'sService3', (services.length >= 3) ? services[2] : '' ],
  ]
  reservations.forEach(resa => helperPdf.pdflib.setTextfield(newContract, resa[0], resa[1], fontToUse))

  // get new contract name
  const reContractName = /^[0-9]*[a-z]?[\s]*-[\s]*/;    // remove numbers (dates) 4 times
  var newContractName = lastContractName;
  newContractName = newContractName.replace(reContractName, '');
  newContractName = newContractName.replace(reContractName, '');
  newContractName = newContractName.replace(reContractName, '');
  const fromParts = options.from.split("/");
  newContractName = fromParts[2] + ' - ' + fromParts[1] + ' - ' + fromParts[0] + ' - ' + newContractName;
  newContractName = currentContractDir + '\\' + newContractName

  // following is causing some isses when opening it with Adobe DC - shows some squares
  // https://github.com/Hopding/pdf-lib/issues/569#issuecomment-1087328416
  // update needappearance field
  //newContract.form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True)


  child_process.exec('explorer ' + currentContractDir);
  try {
    await helperPdf.pdflib.save(newContract, newContractName)
  } catch(e) {
    console.log(e);
    helperJs.error("Impossible d'écrire le fichier   " + options.rootDir + '\\' + newContractName);
  }
  child_process.exec('explorer ' + newContractName);
}


async function main() {
  const options = get_args();
  const currentContractDir = options.rootDir + '\\' + helperEmailContrat.getCurrentContractDir(options.rootDir, options.who);
  const lastContractName = helperEmailContrat.getLastContract(currentContractDir);

  await updatePDF(options, currentContractDir, lastContractName)
}


main();
