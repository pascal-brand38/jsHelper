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
  pdfObject.version = helperPdf.getTextfieldAsInt(pdfObject, 'versionContrat')
}

function getTextfromCandidates(pdfOject, args) {
  let result = undefined
  // args if a list of fields, being candidate to have the info
  args.every(field => {
    try {
      result = pdfOject.form.getTextField(field).getText();
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

function setPropFromTextfieldCandidates(pdfOject, prop, args) {
  pdfOject[prop] = getTextfromCandidates(pdfOject, args)
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

function setCatNamesFromSingleName(pdfOject, prop, args) {
  let res = getNamesAndBirthFromNameAndBirth(getTextfromCandidates(pdfOject, args))
  pdfOject[prop] = res.noms
}

function setBirthsFromSingleName(pdfOject, prop, args) {
  let res = getNamesAndBirthFromNameAndBirth(getTextfromCandidates(pdfOject, args))
  pdfOject[prop] = res.naissances
}

function setPropFromFields(pdfObject, setPropFromFieldsDatas) {
  setPropFromFieldsDatas.forEach(data => data.method(pdfObject, data.prop, data.args))
}

function pdfExtractInfoDatas(version) {
  if (version === undefined) {
    return {
      setPropFromFieldsDatas: [
        { prop: 'proprioNom',             method: setPropFromTextfieldCandidates, args: [ 'Nom Prénom' ] },
        { prop: 'proprioAdr1',            method: setPropFromTextfieldCandidates, args: [ 'Adresse 1' ] },
        { prop: 'proprioAdr2',            method: setPropFromTextfieldCandidates, args: [ 'Adresse 2' ] },
        { prop: 'proprioTel',             method: setPropFromTextfieldCandidates, args: [ 'Téléphone' ] },
        { prop: 'proprioEmail',           method: setPropFromTextfieldCandidates, args: [ 'Adresse email' ] },
        { prop: 'proprioUrgenceNom',      method: setPropFromTextfieldCandidates, args: [ 'Personne autre que moi à prévenir en cas durgence', 'Personne à prévenir en cas durgence' ] },
        { prop: 'proprioUrgenceTel',      method: setPropFromTextfieldCandidates, args: [ 'Téléphone_2' ] },
        { prop: 'chatNoms',               method: setCatNamesFromSingleName,      args: [ '1' ] },
        { prop: 'chatNaissances',         method: setBirthsFromSingleName,        args: [ '1' ] },
        // { type: 'T', prop: 'id',          decompose: decomposeMultiple,     fields: [ '2' ] },
        // { type: 'T', prop: 'race',        decompose: decomposeMultiple,     fields: [ 'undefined' ] },
        // { type: 'T', prop: 'felv',        decompose: decomposeDatesCats,    fields: [ 'Leucose FELV' ] },
        // { type: 'T', prop: 'rcp',         decompose: decomposeDatesCats,    fields: [ 'Typhus coryza RCP' ] },
        // { type: 'T', prop: 'maladies',                                      fields: [ 'undefined_4' ] },
        // { type: 'C', prop: 'male',                                          fields: [ 'Mâle' ] },
        // { type: 'C', prop: 'femelle',                                       fields: [ 'Femelle' ] },
        // { type: 'C', prop: 'maladieOui',                                    fields: [ 'undefined_2' ] },
        // { type: 'C', prop: 'maladieNon',                                    fields: [ 'undefined_3' ] },
      ]
    }
  }

  helperJs.error(`pdfExtractInfoDatas() does not knwo version ${version}`)
  return undefined
}

async function updatePDF(options, currentContractDir, lastContractName) {
  const lastContract = await helperPdf.pdflib.load(currentContractDir + '\\' + lastContractName, getVersion)
  const newContract = await helperPdf.pdflib.load(options.rootDir + '\\' + options.blankContract, getVersion)

  if (newContract.version !== _currentVersionContrat) {
    helperJs.error(`New contract version:\n  Expected: ${_currentVersionContrat}\n  and is: ${newContract.version}`)
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

  setPropFromFields(lastContract, pdfExtractInfoDatas(lastContract.version).setPropFromFieldsDatas)

  if (lastContract.version === undefined) {
    const fields = helperPdf.getFields(lastContract.pdf, helperEmailContrat.fieldsMatch)
    const decompose = helperPdf.decomposeFields(fields, helperEmailContrat.fieldsMatch)
    console.log(decompose)

    const lNom = lastContract.chatNoms.length
    if (lNom == 0) {
      helperJs.error(`Impossible d'extraire le nom du chat du contrat ${lastContractName}`)
    }
    if (lNom > 3) {
      helperJs.error(`Impossible d'avoir plus de 3 chats dans le contrat`)
    }

    const lNaissance = lastContract.chatNaissances.length
    if ((lNaissance!=0) && (lNaissance!==lNom)) {
      helperJs.error(`Nombre de chats entre noms et date de naissance différent: ${decompose.chatNom}  vs  ${decompose.chatNaissance}`)
    }

    const lId = decompose.id.length
    if ((lId!=0) && (lId!==lNom)) {
      helperJs.error(`Nombre de chats entre noms et Id différent: ${decompose.chatNom}  vs  ${decompose.id}`)
    }

    const lRace = decompose.race.length
    if ((lRace!=0) && (lRace!==lNom)) {
      helperJs.error(`Nombre de chats entre noms et race différent: ${decompose.chatNom}  vs  ${decompose.race}`)
    }

    const lFelv = decompose.felv.length
    if ((lFelv!=0) && (lFelv!==lNom)) {
      helperJs.error(`Nombre de chats entre noms et felv différent: ${decompose.chatNom}  vs  ${decompose.felv}`)
    }

    const lRcp = decompose.rcp.length
    if ((lRcp!=0) && (lRcp!==lNom)) {
      helperJs.error(`Nombre de chats entre noms et rcp différent: ${decompose.chatNom}  vs  ${decompose.rcp}`)
    }

    helperPdf.pdflib.setTextfield(newContract, 'pNom',       lastContract.proprioNom,        fontToUse)
    helperPdf.pdflib.setTextfield(newContract, 'pAddr1',     lastContract.proprioAdr1,       fontToUse)
    helperPdf.pdflib.setTextfield(newContract, 'pAddr2',     lastContract.proprioAdr2,       fontToUse)
    helperPdf.pdflib.setTextfield(newContract, 'pTel',       lastContract.proprioTel,        fontToUse)
    helperPdf.pdflib.setTextfield(newContract, 'pEmail',     lastContract.proprioEmail,      fontToUse)
    helperPdf.pdflib.setTextfield(newContract, 'pUrgence1',  lastContract.proprioUrgenceNom, fontToUse)
    helperPdf.pdflib.setTextfield(newContract, 'pUrgence2',  lastContract.proprioUrgenceTel, fontToUse)

    helperPdf.pdflib.setTextfields(newContract, ['c1Nom', 'c2Nom', 'c3Nom'], lastContract.chatNoms, fontToUse)
    helperPdf.pdflib.setTextfields(newContract, ['c1Naissance', 'c2Naissance', 'c3Naissance'], lastContract.chatNaissances, fontToUse)
    helperPdf.pdflib.setTextfields(newContract, ['c1Id', 'c2Id', 'c3Id'], decompose.id, fontToUse)
    helperPdf.pdflib.setTextfields(newContract, ['c1Race', 'c2Race', 'c3Race'], decompose.race, fontToUse)
    helperPdf.pdflib.setTextfields(newContract, ['c1VaccinFELV', 'c2VaccinFELV', 'c3VaccinFELV'], decompose.felv, fontToUse)
    helperPdf.pdflib.setTextfields(newContract, ['c1VaccinRCP', 'c2VaccinRCP', 'c3VaccinRCP'], decompose.rcp, fontToUse)

    // maladies on 3 lines, from https://stackoverflow.com/questions/6259515/how-can-i-split-a-string-into-segments-of-n-characters
    // when there is a maladie, and several cats, this is not possible to know which on it is
    if (decompose.maladies !== '') {
      if (lNom > 1) {
        await helperJs.question.question('Maladie and more than 1 cat - A DETERMINER MANUELLEMENT\nAppuyer sur Entrée')
      } else {
        const maladies = decompose.maladies.match(/.{1,18}/g)    // 18 characters are ok in a cell of the contract
        console.log(maladies)
        helperPdf.pdflib.setTextfields(newContract, ['c1Maladie1', 'c1Maladie2', 'c1Maladie3'], maladies, fontToUse)
      }
    }

    // male / femelle
    if (decompose.male && !decompose.femelle) {
      helperPdf.pdflib.checks(newContract, ['c1Male', 'c2Male', 'c3Male'].slice(0, lNom))
    } else if (!decompose.male && decompose.femelle) {
      helperPdf.pdflib.checks(newContract, ['c1Femelle', 'c2Femelle', 'c3Femelle'].slice(0, lNom))
    } else if (decompose.male && decompose.femelle) {
      await helperJs.question.question('Mâle ET Femelle - A DETERMINER MANUELLEMENT\nAppuyer sur Entrée')
    }

    // check vaccination date
    const remarque = ['c1VaccinRemarque', 'c2VaccinRemarque', 'c3VaccinRemarque']
    decompose.rcp.forEach((date, index) => {
      const epochRcp = helperJs.date.toEpoch(helperJs.date.fromFormatStartOfDay(date))
      const epochRcpNext = epochRcp + helperJs.date.epochNDays(365)
      console.log(`${epochRcp} ${epochRcp}`)
      if (epochRcpNext < epochDeparture) {
        console.log('A REFAIRE')
        helperPdf.pdflib.setTextfield(newContract, remarque[index], 'RAPPEL A REFAIRE', fontToUse)
      }
    })

  } else {
    helperJs.error('NOT IMPLEMENTED YET')
  }


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
