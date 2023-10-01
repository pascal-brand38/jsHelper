/// Copyright (c) Pascal Brand
/// MIT License

import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import { decode } from 'html-entities';
import fs from 'fs'
import os from 'os'
import path from 'path'
import helperJs from './helperJs.mjs';
import helperExcel from './helperExcel.mjs'
import { DateTime } from '../extend/luxon.mjs'
import { PDFDocument, setProplist } from '../extend/pdf-lib.mjs'


async function getArgsComptaPdf({ usage, exactPdf, checkError }) {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  let options = yargs
    .usage(usage)
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "compta-xls": {
        description: "fullname of the compta.xls file",
        requiresArg: true,
        required: false
      },
      "who": {
        description: "who in the compta. Contains cat's name and owner's name",
        requiresArg: true,
        required: true
      },
      "from": {
        description: "Starting date, format dd/mm/yyyy. This is the one in the contract",
        requiresArg: true,
        required: true
      },
      "services": {
        description: "Services string to be included in new contract",
        requiresArg: true,
        required: true
      },
    })
    .argv;

  options.who = decode(options.who)
  options.services = decode(options.services)

  // from these options, read the compta.xls, and get the row data used for this request
  let dataCompta = helperExcel.readXls(options.comptaXls, xlsFormatCompta)
  const serialArrival = DateTime.fromFormatStartOfDay(options.from).toExcelSerial()
  const rows = dataCompta.filter(row => (row.name === options.who) && (row.comptaArrival === serialArrival))
  if (rows.length !== 1) {
    helperJs.error(`Cannot find in ${options.comptaXls} name ${options.who} arriving at ${options.from}`)
  }
  const rowCompta = rows[0]

  // get pdf properties
  const {pdfObject, contractName} = await getPdfDataFromDataCompta(
    rowCompta,
    options.comptaXls,
    exactPdf)

  // populate other properties in options
  const rootDir = path.parse(options.comptaXls).dir
  options.enterprise = path.parse(rootDir).base
  options.to = DateTime.fromExcelSerialStartOfDay(rowCompta.comptaDeparture).toFormat('dd/MM/yyyy')

  // Dump values
  console.log()
  console.log(`Properties extracted from ${contractName}:`)
  console.log(pdfObject.getExtend())
  console.log()

  if (checkError) {
    await postErrorCheck(pdfObject, undefined)
  }

  return {
    options,
    dataCompta,
    rowCompta,
    pdfObject,
    contractName
  }
}

function getImmediateSubdirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);
}

function getCurrentContractDir(rootDir, who, returnList = false) {
  const reDoubleSpace = /[\s]{2,}/g;
  const reSlash = /\//g;
  const reTrailing = /[\s]+$/g;
  const reStarting = /^[\s]+/g;
  who = who
    .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
    .replace(reDoubleSpace, ' ')
    .replace(reTrailing, '')
    .replace(reStarting, '')
    .replace(reSlash, '-')
    .toLowerCase();  // so now who does contain neither accents nor double-space nor slash (replace with dash)
  var candidates;

  // 1st method: look if who and subdir are a prefix of the other after / and accents and double-space removal
  candidates = [];
  const subdirs = getImmediateSubdirs(rootDir);
  subdirs.forEach((subdir) => {
    var subdirProcessed = subdir
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
      .replace(reDoubleSpace, ' ')
      .replace(reTrailing, '')
      .replace(reStarting, '')
      .replace(reSlash, '-')
      .toLowerCase();  // so now who does contain neither accents nor double-space nor slash (replace with dash)

    if (subdirProcessed.startsWith(who) || who.startsWith(subdirProcessed)) {
      candidates.push(subdir);
    }
  })
  if (candidates.length == 1) {
    if (returnList) {
      // for testing only
      return candidates;
    } else {
      return candidates[0];
    }
  }

  // 3rd method: look for catname only
  const reCatNameExtract = /[\s]+-.*/;    // look for 1st dash, and remove the remaining
  const catCompta = who.replace(reCatNameExtract, '');

  candidates = [];
  subdirs.forEach((subdir) => {
    var subdirProcessed = subdir
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
      .replace(reDoubleSpace, ' ')
      .replace(reTrailing, '')
      .replace(reStarting, '')
      .replace(reSlash, '-')
      .toLowerCase()
      .replace(reCatNameExtract, '');  // so now who does contain neither accents nor double-space nor slash (replace with dash)
    if (subdirProcessed === catCompta) {
      candidates.push(subdir);
    }
  })

  if (returnList) {
    return candidates;
  } else {
    if (candidates.length === 0) {
      helperJs.error('Impossible de trouver le répertoire de contrat de ' + catCompta);
    } else if (candidates.length > 1) {
      helperJs.error('Plusieurs chats s\'appellent ' + catCompta + '\n' + candidates)
    }

    return candidates[0];
  }
}

function getLastContract(dir) {
  const all_files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.startsWith('20'))
    .map((item) => item.name);
  if (all_files.length == 0) {
    helperJs.warning('Aucun contrat existant dans ' + dir)
    return undefined
  }
  return all_files[all_files.length - 1];
}

function getContractName(from, dir) {
  const fromParts = from.split("/");
  const start = fromParts[2] + ' - ' + fromParts[1] + ' - ' + fromParts[0] + ' - '

  const all_files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.startsWith(start))
    .map(item => item.name)
  if (all_files.length === 1) {
    return all_files[0]
  }

  return undefined
}


// list of equivalent field name - 1st one is the one in the new contract
// Each item is an object that contains:
// - type: 'T' for text field, 'C' for checkbox
// - prope: property name in js structure
// - fields: list of field names, the 1st one being in the more recent pdf version

const catSeparator = [' / ', ' - ', ' // ', ' et ',]   // 'et' is the last one because of race that may include it

function separate(value) {
  let results = [value]
  catSeparator.forEach(sep => {
    let split = value.split(sep)
    if (split.length > results.length) {
      results = split
    }
  })

  return results
}

function normalize(value) {
  return value
    .trim()
    // .normalize("NFD").replace(/[\u0300-\u036f]/g, "")     // remove accent that may be confused
    .replace(/[,:()]/g, " ")
    // .replace(/[.-]/g, "/")
    .replace(/\s+/g, " ")
}


function getDate(array, prop) {
  const dateFormats = ['d/M/yy', 'd/M/y', 'M/y']
  let lastDate = ''
  let found = false
  array.every(s => {
    s = s.replace(/[.-]/g, '/')
    dateFormats.every(format => {
      let date = DateTime.fromFormat(s, format)
      if (date.isValid) {
        lastDate = date.toFormat('dd/MM/yyyy')
        found = true    // found
      }
      return (!found)
    })
    return !found
  })
  // if (!found) {
  //   helperJs.warning(`Propriété ${prop}: Impossible d'extraire une date dans ${array}`)
  // }

  if (!found && array.length >= 2) {
    const s = `${array[array.length - 2]} ${array[array.length - 1]}`
    let date = DateTime.fromFormat(s, 'MMMM yyyy', { locale: 'fr' })
    if (date.isValid) {
      lastDate = date.toFormat('dd/MM/yyyy')
      found = true    // found
    }
  }

  return lastDate
}


function postComputationSheet(rows) {
  rows = rows.filter(e => (e.name !== undefined) && !isNaN(e.arrival) && !isNaN(e.departure))
  rows.sort(function (a, b) { return a.arrival - b.arrival });
  return rows
}

const xlsFormatCompta = {
  sheetName: 'Compta',
  cols: [
    { col: 'B', prop: 'name',                                               },
    { col: 'W', prop: 'arrival',            postComputation: Math.floor,    },    // real arrival
    { col: 'X', prop: 'departure',          postComputation: Math.floor,    },
    { col: 'C', prop: 'comptaArrival',      postComputation: Math.floor,    },    // arrival on the contract
    { col: 'D', prop: 'comptaDeparture',    postComputation: Math.floor,    },
    { col: 'E', prop: 'prixJour'                                            },
    { col: 'F', prop: 'nbJours'                                             },
    { col: 'G', prop: 'total'                                               },
    { col: 'H', prop: 'accompte'                                            },
    { col: 'I', prop: 'dateAccompte'                                        },
    { col: 'L', prop: 'solde'                                               },
    { col: 'I', prop: 'dateAccompte'                                        },
    { col: 'K', prop: 'statusPayAcompte',                                   },
    { col: 'O', prop: 'statusPaySolde',                                     },
    { col: 'S', prop: 'statusPayExtra',                                     },
  ],
  postComputationRow: (row => {
    row['statusPay'] = [ row['statusPayAcompte'], row['statusPaySolde'], row['statusPayExtra'] ]
    return row
  }),
  postComputationSheet: postComputationSheet,
}

const xlsFormatAgenda = {
  sheetName: 'Résa',
  cols: [
    { col: 'A', prop: 'name',                                               },
    { col: 'I', prop: 'arrival',            postComputation: Math.floor,    },
    { col: 'K', prop: 'departure',          postComputation: Math.floor,    },
  ],
  postComputationSheet: postComputationSheet,
}

async function getPdfDataFromDataCompta(dataCompta, comptaName, exact=true) {
  const rootDir = path.parse(comptaName).dir
  const enterprise = path.parse(rootDir).base
  const contractRootDir = rootDir + '\\Contrat Clients ' + enterprise

  // get the pdf contract
  let sComptaArrival
  if (dataCompta.hasOwnProperty('sComptaArrival')) {
    sComptaArrival = dataCompta['sComptaArrival']
  } else {
   sComptaArrival = DateTime.fromExcelSerialStartOfDay(dataCompta['comptaArrival']).toFormat('dd/MM/yyyy')
  }
  const currentContractDir = contractRootDir + '\\' + getCurrentContractDir(contractRootDir, dataCompta['name']);
  let contractName = getContractName(sComptaArrival, currentContractDir);
  if ((contractName === undefined) && (!exact)) {
    // fall-back on last known contract
    contractName = getLastContract(currentContractDir)
  }
  if (contractName === undefined) {
    return { pdfObject: undefined, contractName: dataCompta['name'] }
  }

  // load the pdf and extract properties
  const pdfObject = await PDFDocument.loadInit(currentContractDir + '\\' + contractName, getVersion)
  const pdfInfoData = pdfExtractInfoDatas(pdfObject.getExtend().version)
  pdfObject.setPropFromFields(pdfInfoData.setPropFromFieldsDatas, pdfInfoData.postSetPropFromFields)
  // no postErrorCheck(pdfContract, undefined)
  // as we can have errors with old contracts. To be done manually later in the process when required

  return { pdfObject, contractName }
}

function getEmail(pdfObject) {
  let email = pdfObject.getExtend().proprio.email
  if ((email === undefined) || (email === '')) {
    email = ''
    helperJs.warning(`Impossible de connaitre l'email de ${pdfObject.getExtend().proprio.nom}`)
  } else if (os.userInfo().username == 'pasca') {
    helperJs.warning(`WARNING - As you are pasca, replace real email ${email} with a fake one`)
    email = 'toto@titi.com'
  }

  return email
}


//
// Set of function to help getting pdf form fields, setting properties, and setting
// pdf form fields of contract of the cattery
//

function getVersion(pdfObject) {
  pdfObject.getExtend().version = pdfObject.getTextfieldAsInt('versionContrat')
}

function getTextfromCandidates(pdfObject, args) {
  let result = undefined
  // args if a list of fields, being candidate to have the info
  args.every(field => {
    try {
      result = pdfObject.getForm().getTextField(field).getText();
      if (result === undefined) {
        result = ''
      }
      return false    // found - stop the every function
    } catch {
      return true     // not found - continue
    }
  })
  if (result === undefined) {
    helperJs.warning(`getTextfromCandidates: undefined on ${pdfObject.getExtend().fullname} with args=${args}`)
  }
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
      res = pdfObject.getForm().getCheckBox(field).isChecked();
      return false    // found - stop the every function
    } catch {
      return true     // not found - continue
    }
  })

  const lNom = pdfObject.getExtend().chat.noms.length
  result[prop] = Array(lNom).fill(res)
}

function getNamesAndBirthFromNameAndBirth(value) {
  value = normalize(value)
  let values = separate(value)    // get a list of values per cat in this pdf
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

    let d = getDate(next, undefined)
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
  value = normalize(value)
  const values = separate(value)    // get a list of values per cat in this pdf
  result[prop] = values
}

function setDatesFromSingle(pdfObject, prop, args, result) {
  let value = getTextfromCandidates(pdfObject, args)
  if (value === '') {
    result[prop] = []
    return
  }
  value = normalize(value)
  let values = separate(value)    // get a list of values per cat in this pdf

  let catNames = pdfObject.getExtend()['chat']['noms']
  if ((catNames !== undefined) && (catNames.length !== values.length)) {
    // different number of cats and dates
    pdfObject.setWarning(`setDatesFromSingle: error with cats and ${prop} number: ${catNames}  vs  ${values}`)
    result[prop] = []
    return
  }

  result[prop] = []
  values.forEach((v, i) => {
    if (catNames !== undefined) {
      catNames.every((cat, j) => {
        if ((i!==j) && (v.toLowerCase().includes(cat.toLowerCase()))) {
          // different cats order
          pdfObject.setWarning(`setDatesFromSingle: error with cat order in ${values}`)
          result[prop] = []
          return false
        }
        return true
      })
    }
    let d = getDate(v.split(' '), prop)
    if (d === '') {
      pdfObject.setWarning(`setDatesFromSingle: error with ${v}`)
      result[prop] = []
    } else {
      result[prop].push(d)
    }
  })
}


async function postErrorCheck(pdfObject, result) {
  const fullname = pdfObject.getFullname()
  const errors = pdfObject.getErrors()
  if (errors.length !== 0) {
    console.log(`List of errors in ${fullname}:`)
    console.log(errors)
    helperJs.error('QUIT')
  }

  const warnings = pdfObject.getWarnings()
  if (warnings.length !== 0) {
    console.log(`List of warnings in ${fullname}:`)
    console.log(warnings)
    await helperJs.question.question('Liste des warnings à manipuler à la main - Appuyer sur entrée')
  }
}


function postSetPropNoUndefined(pdfObject, result) {
  let toBeChecked = []

  const proprio = result.proprio
  const l1 = [ 'nom', 'adr1', 'adr2', 'tel', 'email', 'urgenceNom', 'urgenceTel' ]
  l1.forEach(key => {
    if (!proprio.hasOwnProperty(key)) {
      toBeChecked.push(key)
    }
  })

  const chat = result.chat
  const l2 = [ 'noms', 'naissances', 'ids', 'races', 'felvs', 'rcps', 'males', 'femelles' ]
  l2.forEach(key => {
    if (!chat.hasOwnProperty(key)) {
      toBeChecked.push(key)
    } else {
      const l = chat[key]
      l.forEach((i, index) => {
        if (i === undefined) {
          toBeChecked.push(key )
        }
      })
    }
  })

  const l3 = [ 'maladies' ]
  l3.forEach(key => {
    if (!chat.hasOwnProperty(key)) {
      toBeChecked.push(key)
    } else {
      const l = chat[key]
      l.forEach(i => {
        if (i === undefined) {
          toBeChecked.push(key )
        } else {
          i.forEach(j => {
            if (j === undefined) {
              toBeChecked.push(key )
            }
          })
        }
      })
    }
  })

  if (toBeChecked.length !== 0) {
    helperJs.warning(`Check these that are undefined in ${pdfObject.getExtend().fullname}: `)
    console.log(toBeChecked)
  }
}

function postSetPropFromFieldsV0(pdfObject, result) {
  const chat = result.chat

  // check coherency on number of cats and number of ids,...
  const nbChats = chat.noms.length
  if (nbChats == 0) {
    pdfObject.setError(`Impossible d'extraire le nom du chat du contrat ${pdfObject.getFullName()}`)
  }
  if (nbChats > 3) {
    pdfObject.setError(`Impossible d'avoir plus de 3 chats dans le contrat`)
  }

  ['naissances', 'ids', 'races', 'felvs', 'rcps', ].forEach(key => {
    if (chat.hasOwnProperty(key)) {
      const l = chat[key].length
      if ((l !== 0) && (l != nbChats)) {
        pdfObject.setWarning(`Incoherence entre nombre de chats et nombre de ${key}`)
        chat[key] = []
      }
    } else {
      pdfObject.setWarning(`Une des entrées du chat est undefined`)
      chat[key] = []
    }
  })

  // check maladies, when several cats, this is not possible to know which on it is
  if ((chat.maladies[0] !== '') && (nbChats > 1)) {
    pdfObject.setWarning(`Maladies et plus de 1 chat`)
    chat.maladies[0] = ''
  }

  // post proc maladies as array of array
  const m = chat.maladies
  chat.maladies = [[m[0]], [], []]

  // check male and femelle
  if ((chat.males[0]) && (chat.femelles[0])) {
    chat.males.forEach((v, index) => chat.males[index] = false)
    chat.femelles.forEach((v, index) => chat.femelles[index] = false)
    pdfObject.setWarning(`Male ET femelle`)
  }

  // check none is undefined
  postSetPropNoUndefined(pdfObject, result)
}

function postSetPropFromFieldsV20230826(pdfObject, result) {
  // check none is undefined
  postSetPropNoUndefined(pdfObject, result)

  // shrink cats array when less than 3 cats
  let chat = pdfObject.getExtend().chat
  chat.noms = chat.noms.filter(n => (n !== '') && (n !== undefined))
  const lNom = chat.noms.length
  Object.keys(chat).forEach(key => { chat[key] = chat[key].slice(0, lNom) })
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
            { prop: 'males',           method: setProplistFromCheckCandidates,     args: [ 'Mâle' ] },
            { prop: 'femelles',        method: setProplistFromCheckCandidates,     args: [ 'Femelle' ] },
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
            { prop: 'urgenceTel',      method: setPropFromTextfieldCandidates,     args: [ 'pUrgence2' ] },
          ],
        },
        {
          prop: 'chat',
          setPropFromFieldsDatas: [
            { prop: 'noms',            method: setProplist.fromTextfieldlist,     args: [ 'c1Nom', 'c2Nom', 'c3Nom' ] },
            { prop: 'naissances',      method: setProplist.fromTextfieldlist,     args: [ 'c1Naissance', 'c2Naissance', 'c3Naissance' ] },
            { prop: 'ids',             method: setProplist.fromTextfieldlist,     args: [ 'c1Id', 'c2Id', 'c3Id' ] },
            { prop: 'races',           method: setProplist.fromTextfieldlist,     args: [ 'c1Race', 'c2Race', 'c3Race' ] },
            { prop: 'felvs',           method: setProplist.fromTextfieldlist,     args: [ 'c1VaccinFELV', 'c2VaccinFELV', 'c3VaccinFELV' ] },
            { prop: 'rcps',            method: setProplist.fromTextfieldlist,     args: [ 'c1VaccinRCP', 'c2VaccinRCP', 'c3VaccinRCP' ] },
            { prop: 'maladies',        method: setProplist.fromTextfieldlistlist, args: [ [ 'c1Maladie1', 'c1Maladie2', 'c1Maladie3' ], [ 'c2Maladie1', 'c2Maladie2', 'c2Maladie3' ], [ 'c3Maladie1', 'c3Maladie2', 'c3Maladie3' ] ] },
            { prop: 'males',           method: setProplist.fromChecklist,         args: [ 'c1Male', 'c2Male', 'c3Male' ] },
            { prop: 'femelles',        method: setProplist.fromChecklist,         args: [ 'c1Femelle', 'c2Femelle', 'c3Femelle' ] },
          ],
        },
      ],
      postSetPropFromFields: postSetPropFromFieldsV20230826,
    }
  }

  helperJs.error(`pdfExtractInfoDatas() does not know version ${version}`)
  return undefined
}

// nom is the cate name in the contract. It can be 'Titou dit Pixel'
// So allnoms will be [ 'Titou', 'dit', 'Pixel' ]
// and you have to choose between the 3.
async function _chooseCatName(nom) {
  const alphanumeric = /[\p{sc=Latn}\p{Nd}]*/ug;   // https://stackoverflow.com/questions/4434076/best-way-to-alphanumeric-check-in-javascript
                                                   // https://www.codespeedy.com/separate-characters-special-characters-and-numbers-from-a-string-in-javascript/
  const allnoms = nom.match(alphanumeric).filter(i => i!=='')
  const l = allnoms.length
  if (l === 1) {
    return allnoms[0]
  } else {
    let index = undefined
    while ((isNaN(index)) || (index<0) || (index>=l)) {
      const answer = await helperJs.question.question(`Quel nom pour ${allnoms} (de 0 à ${l-1}) ? `)
      index = parseInt(answer)
    }
    return allnoms[index]
  }
}

async function getCatNames(pdfObject) {
  // https://stackoverflow.com/questions/15069587/is-there-a-way-to-join-the-elements-in-an-js-array-but-let-the-last-separator-b
  const noms = pdfObject.getExtend().chat.noms

  const l = noms.length
  let newnames = []
  for (let i=0; i<l; i++) {
    newnames.push(await _chooseCatName(noms[i]))
  }

  const formatter = new Intl.ListFormat('fr', { style: 'long', type: 'conjunction' });
  return formatter.format(newnames)   // something like 'Titou, Pablo et Fifi'
}

function isVaccinUptodate(pdfObject, epochDeparture, newContract = undefined, fontToUse=undefined) {
  const noms = pdfObject.getExtend().chat.noms
  const rcps = pdfObject.getExtend().chat.rcps
  if ((rcps===undefined) || (rcps.length != noms.length) || (rcps.some(v => v===undefined))) {
    return false
  }

  let result = true
  const remarque = ['c1VaccinRemarque', 'c2VaccinRemarque', 'c3VaccinRemarque']
  pdfObject.getExtend().chat.rcps.forEach((date, index) => {
    if ((date === undefined) || (date === '')) {
      result = false
    } else {
      const epochRcp = DateTime.fromFormatStartOfDay(date).toEpoch()
      const epochRcpNext = epochRcp + DateTime.epochNDays(365)
      if (epochRcpNext < epochDeparture) {
        result = false
        if (newContract !== undefined) {
          newContract.setTextfield(remarque[index], 'RAPPEL A REFAIRE', fontToUse)
        }
      }
    }
  })

  return result
}

async function checkInFuture(fromStr) {
  const epochArrival = DateTime.fromFormatStartOfDay(fromStr).toEpoch()
  const now = DateTime.fromNowStartOfDay().toEpoch()
  if (epochArrival < now) {
    await helperJs.question.question('Contrat dans le passé - Appuyer sur entrée')
  }
}

export default {
  getArgsComptaPdf,
  checkInFuture,

  // specific helpers used by pdf utilities to set prop and set fields of contract of the cattery
  helperPdf: {
    currentVersionContrat: 20230826,
    getVersion,
    getEmail,
    postErrorCheck,             // async
    getPdfDataFromDataCompta,
    getCatNames,
    isVaccinUptodate,
  },

  helperXls: {
    xlsFormatCompta,
    xlsFormatAgenda,
  }
}
