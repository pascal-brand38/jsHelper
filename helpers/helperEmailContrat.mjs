/// Copyright (c) Pascal Brand
/// MIT License

import { exit } from 'process';
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import {decode} from 'html-entities';
import child_process from 'child_process'
import fs from 'fs'
import { DateTime } from 'luxon'

function warning(s) {
  console.log('WARNING');
  console.log(`WARNING  ${s}`);
  console.log('WARNING');
}

function error(s) {
  console.log('***');
  console.log('***  ERREUR');
  console.log('*** ', s);
  console.log('***');

  exit(-1)
}

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
      error('Impossible de trouver le répertoire de contrat de ' + catCompta);
    } else if (candidates.length > 1) {
      error('Plusieurs chats s\'appellent ' + catCompta + '\n' + candidates)
    }

    return candidates[0];
  }
}

function getLastContract(dir) {
  const all_files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.startsWith('20'))
    .map((item) => item.name);
  if (all_files.length == 0) {
    error('Aucun contrat existant dans ' + dir)
  }
  return all_files[all_files.length - 1];
}

function getContractName(from, dir) {
  const fromParts = from.split("/");
  const start = fromParts[2] + ' - ' + fromParts[1] + ' - ' + fromParts[0] + ' - ';

  const all_files = fs.readdirSync(dir, { withFileTypes: true })
    .filter((item) => item.isFile() && item.name.startsWith(start))
    .map((item) => item.name);
  if (all_files.length == 0) {
    error('Aucun contrat existant dans ' + dir)
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

const catSeparator = [ ' // ', ' et ', ' / ']

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
      .replace(/[.-]/g, "/")
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
    s = s.replace(/.-/g, '/')
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
  if (!found) {
    warning(`Propriété ${prop}: Impossible d'extraire une date dans ${array}`)
  }
  return lastDate
}

function decomposeDatesCats(prop, value, results) {
  value = normalize(value)
  let values = separate(value)    // get a list of values per cat in this pdf

  let catNames = results['chatNom']
  if ((catNames !== undefined) && (catNames.length !== values.length)) {
    console.log('Cat names: ', catNames)
    console.log('Dates data: ', values)
    error(`Different number of cats and dates`)
  }
console.log(values)
  results[prop] = []
  values.forEach((v, i) => {
    if (catNames !== undefined) {
      catNames.forEach((cat, j) => {
        if ((i!==j) && (v.toLowerCase().includes(cat.toLowerCase()))) {
          console.log('Cat names: ', catNames)
          console.log('Dates data: ', values)
          error(`Cats order is different`)
        }
      })
    }
    results[prop].push(getDate(v.split(' '), prop))
  })
}

function decomposeCatName(prop, value, results) {
  value = normalize(value)
  let values = separate(value)    // get a list of values per cat in this pdf
  results['chatNom'] = []
  results['chatNaissance'] = []

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
    results['chatNaissance'].push(getDate(next), prop)
  })
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
  { type: 'T', prop: 'id',                                            fields: [ '2' ] },
  { type: 'T', prop: 'race',                                          fields: [ 'undefined' ] },
  { type: 'T', prop: 'felv',                                          fields: [ 'Leucose FELV' ] },
  { type: 'T', prop: 'rcp',         decompose: decomposeDatesCats,    fields: [ 'Typhus coryza RCP' ] },
  { type: 'T', prop: 'maladies',                                      fields: [ 'Oui Non Si oui lesquelles' ] },

  { type: 'C', prop: 'male',                                          fields: [ 'Mâle' ] },
  { type: 'C', prop: 'femelle',                                       fields: [ 'Femelle' ] },
  { type: 'C', prop: 'maladieOui',                                    fields: [ 'undefined_2' ] },
  { type: 'C', prop: 'maladieNon',                                    fields: [ 'undefined_3' ] },

  // now is the booking dates and others
];

const xlsFormatCompta = {
  sheetName: 'Compta',
  cols: [
    { col: 'B', prop: 'name',                                               },
    { col: 'W', prop: 'arrival',            postComputation: Math.floor,    },
    { col: 'X', prop: 'departure',          postComputation: Math.floor,    },
    { col: 'K', prop: 'statusPayAcompte',                                   },
    { col: 'O', prop: 'statusPaySolde',                                     },
    { col: 'S', prop: 'statusPayExtra',                                     },
  ],
  postComputation: (row => {
    row['statusPay'] = [ row['statusPayAcompte'], row['statusPaySolde'], row['statusPayExtra'] ]
  })
}

const xlsFormatAgenda = {
  sheetName: 'Résa',
  cols: [
    { col: 'A', prop: 'name',                                               },
    { col: 'I', prop: 'arrival',            postComputation: Math.floor,    },
    { col: 'K', prop: 'departure',          postComputation: Math.floor,    },
  ],
}



export default {
  error,
  warning,
  get_args,
  getCurrentContractDir,
  getLastContract,
  getContractName,
  composeThunderbird,
  fieldsMatch,
  xlsFormatCompta,
  xlsFormatAgenda,
}
