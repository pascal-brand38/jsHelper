/// Copyright (c) Pascal Brand
/// MIT License

import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import {decode} from 'html-entities';
import child_process from 'child_process'
import fs from 'fs'
import { DateTime } from 'luxon'
import path from 'path'
import helperJs from './helperJs.mjs';
import helperPdf from './helperPdf.mjs';
import os from 'os'

function get_args(usage) {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  var options = yargs
    .usage(usage)
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "compta-xls": {
        description: "fullname of the compta.xls file",
        requiresArg: true,
        required: false
      },
      "root-dir": {
        description: "directory that contains all contract directories, as well as the blank contract",
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

      "accompte": {
        description: "Accompte asked for",
        requiresArg: true,
        required: true
      },
      "date_accompte":   {
        description: "Date of the accompte if already paid",
        requiresArg: true,
        required: true
      },
      "solde": {
        description: "Amount on arrival date",
        requiresArg: true,
        required: true
      },
      "entreprise": {
        description: "Enterprise name",
        requiresArg: true,
        required: true
      },
      
    })
    .argv;
  
  options.who = decode(options.who)
  options.services = decode(options.services)

  return options;
}

function getImmediateSubdirs(dir) {
  return fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isDirectory())
    .map((item) => item.name);
}

function getCurrentContractDir(rootDir, who, returnList=false) {
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
  // TODO: only consider "dd/MM/yyyy" and "MM/yyyy"
  const fromParts = from.split("/");
  const start = fromParts[2] + ' - ' + fromParts[1] + ' - ' + fromParts[0] + ' - '

  let all_files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.startsWith(start))
    .map((item) => item.name)
  if (all_files.length == 0) {
    helperJs.warning('Aucun contrat existant dans ' + dir)
    return undefined
  }
  return all_files[all_files.length - 1];
}

function composeThunderbird(email, subject, body, attachment=null) {
  // http://kb.mozillazine.org/Command_line_arguments_-_Thunderbird
  let exe = '"C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe"'
  let to = `to='${email}'`
  subject = `subject=${encodeURIComponent(subject)}`
  body = `body=${encodeURIComponent(body)}`

  let cmd
  if (attachment != null) {
    attachment = `attachment=${attachment.replace(/\\/g, '/')}`
    cmd = `${exe} -compose "${to},${subject},${body},${attachment}"` 
  } else {
    cmd = `${exe} -compose "${to},${subject},${body}"` 
  }
  console.log(cmd)
  child_process.exec(cmd)
}


// list of equivalent field name - 1st one is the one in the new contract
// Each item is an object that contains:
// - type: 'T' for text field, 'C' for checkbox
// - prope: property name in js structure
// - fields: list of field names, the 1st one being in the more recent pdf version

const catSeparator = [ ' / ', ' - ', ' // ', ' et ', ]   // 'et' is the last one because of race that may include it

function separate(value) {
  let results = [ value ]
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

function decomposeIdentical(prop, value, results) {
  results[prop] = value
}

function getDate(array, prop) {
  const dateFormats = [ 'd/M/yy', 'd/M/y', 'M/y' ]
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
    const s = `${array[array.length-2]} ${array[array.length-1]}`
    let date = DateTime.fromFormat(s, 'MMMM yyyy', { locale: 'fr' })
    if (date.isValid) {
      lastDate = date.toFormat('dd/MM/yyyy')
      found = true    // found
    }
  }

  return lastDate
}

function decomposeDatesCats(prop, value, results) {
  value = normalize(value)
  let values = separate(value)    // get a list of values per cat in this pdf

  let catNames = results['chatNom']
  if ((catNames !== undefined) && (catNames.length !== values.length)) {
    // different number of cats and dates
    results[prop] = [ `Error with cats and ${prop} number: ${catNames}  vs  ${values}` ]
    results.error = true
    return
  }

  results[prop] = []
  values.forEach((v, i) => {
    if (catNames !== undefined) {
      catNames.every((cat, j) => {
        if ((i!==j) && (v.toLowerCase().includes(cat.toLowerCase()))) {
          // different cats order
          results[prop].push(`Error with cat order in ${values}`)
          results.error = true
          return false
        }
        return true
      })
    }
     let d = getDate(v.split(' '), prop)
     if (d === '') {
      results[prop].push(`Error with ${v}`)
      results['error'] = true
     } else {
      results[prop].push(d)
     }
  })
}

function decomposeMultiple(prop, value, results) {
  value = normalize(value)
  const values = separate(value)    // get a list of values per cat in this pdf
  results[prop] = values
}

function decomposeCatName(prop, value, results) {
  value = normalize(value)
  let values = separate(value)    // get a list of values per cat in this pdf
  results['chatNom'] = []
  results['chatNaissance'] = []

  let firstBirthDate = undefined

  values.forEach(v => {
    let name = v.split(' dit ')
    let next
    if (name.length === 2) {
      next = name[1].split(' ')
      results['chatNom'].push(`${name[0]} dit ${next.shift()}`)
    } else {
      name = v.split(' ')
      results['chatNom'].push(name.shift())
      next = name
    }

    let d = getDate(next, prop)
    results['chatNaissance'].push(d)
    if ((d !== '') && (firstBirthDate !== undefined)) {
      firstBirthDate = d
    }
  })

  // check for all birth date, in case some are not found
  if (firstBirthDate !== undefined) {
    results['chatNaissance'].forEach((d, index) => {
      if (d === '') {
        results['chatNaissance'][index] = d
      }
    })
  }
}

const fieldsMatch = [
  { type: 'T', prop: 'nom',         decompose: decomposeIdentical,    fields: [ 'Nom Prénom' ] },
  { type: 'T', prop: 'adr1',                                          fields: [ 'Adresse 1' ] },
  { type: 'T', prop: 'adr2',                                          fields: [ 'Adresse 2' ] },
  { type: 'T', prop: 'tel',                                           fields: [ 'Téléphone' ] },
  { type: 'T', prop: 'email',                                         fields: [ 'Adresse email' ] },
  { type: 'T', prop: 'urgenceNom',                                    fields: [ 'Personne autre que moi à prévenir en cas durgence', 'Personne à prévenir en cas durgence' ] },
  { type: 'T', prop: 'urgenceTel',                                    fields: [ 'Téléphone_2' ] },
  { type: 'T', prop: 'chat',        decompose: decomposeCatName,      fields: [ '1' ] },
  { type: 'T', prop: 'id',          decompose: decomposeMultiple,     fields: [ '2' ] },
  { type: 'T', prop: 'race',        decompose: decomposeMultiple,     fields: [ 'undefined' ] },
  { type: 'T', prop: 'felv',        decompose: decomposeDatesCats,    fields: [ 'Leucose FELV' ] },
  { type: 'T', prop: 'rcp',         decompose: decomposeDatesCats,    fields: [ 'Typhus coryza RCP' ] },
  { type: 'T', prop: 'maladies',                                      fields: [ 'undefined_4' ] },

  { type: 'C', prop: 'male',                                          fields: [ 'Mâle' ] },
  { type: 'C', prop: 'femelle',                                       fields: [ 'Femelle' ] },
  { type: 'C', prop: 'maladieOui',                                    fields: [ 'undefined_2' ] },
  { type: 'C', prop: 'maladieNon',                                    fields: [ 'undefined_3' ] },

  // now is the booking dates and others
];

function postComputationSheet(rows) {
  rows = rows.filter(e => (e.name !== undefined) && !isNaN(e.arrival) && !isNaN(e.departure))
  rows.sort(function(a, b) { return a.arrival - b.arrival } );
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

async function getPdfDataFromDataCompta(dataCompta, comptaName, excludes) {
  const rootDir = path.parse(comptaName).dir
  const enterprise = path.parse(rootDir).base
  const contractRootDir = rootDir + '\\Contrat Clients ' + enterprise

  // get the pdf contract
  const sComptaArrival = helperJs.date.toFormat(helperJs.date.fromExcelSerialStartOfDay(dataCompta['comptaArrival']))
  const currentContractDir = contractRootDir + '\\' + getCurrentContractDir(contractRootDir, dataCompta['name']);
  let contractName = getContractName(sComptaArrival, currentContractDir);
  if (contractName === undefined) {
    // fall-back on last known contract
    contractName = getLastContract(currentContractDir)
  }
  if (contractName === undefined) {
    return { fields: undefined, decompose: undefined, contractName: dataCompta['name'] }
  }
  
  // check rcp date
  const pdf = await helperPdf.load(currentContractDir + '\\' + contractName)
  const fields = helperPdf.getFields(pdf, fieldsMatch)
  const decompose = helperPdf.decomposeFields(fields, fieldsMatch, excludes)
  
  return { fields, decompose, contractName }
}

function getEmail(pdfObject) {
  let email = pdfObject[helperPdf.pdflib.helperProp].proprio.email
  if ((email === undefined) || (email === '')) {
    email = ''
    helperJs.warning(`Impossible de connaitre l'email de ${options.who}`)
  } else if (os.userInfo().username == 'pasca') {
    helperJs.warning(`WARNING - As you are pasca, replace real email ${email} with a fake one`)
    email = 'toto@titi.com'
  }

  return email
}

export default {
  get_args,
  getCurrentContractDir,
  getLastContract,
  getContractName,
  composeThunderbird,
  fieldsMatch,
  xlsFormatCompta,
  xlsFormatAgenda,
  getPdfDataFromDataCompta,
  normalize,
  separate,
  getDate,

  // specific helpers used by pdf utilities to set prop and set fields of contract of the cattery
  helperPdf: {
    currentVersionContrat: 20230826,
    getVersion: getVersion,
    pdfExtractInfoDatas: pdfExtractInfoDatas,    // TODO: comments
    getEmail: getEmail,
  }
}


//
// Set of function to help getting pdf form fields, setting properties, and setting 
// pdf form fields of contract of the cattery
//

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
  value = normalize(value)
  let values = separate(value)    // get a list of values per cat in this pdf

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
     let d = getDate(v.split(' '), prop)
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

