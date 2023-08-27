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
import { PDFDocument, PDFName, PDFBool, StandardFonts } from 'pdf-lib'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import { exit } from 'process';
import child_process from 'child_process'
import {decode} from 'html-entities';
import helperEmailContrat from '../helpers/helperEmailContrat.mjs';
import helperPdf from '../helpers/helperPdf.mjs'
import helperJs from '../helpers/helperJs.mjs';


function error(s) {
  console.log('***');
  console.log('***  ERREUR');
  console.log('*** ', s);
  console.log('***');

  exit(-1)
}

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

async function updatePDF(options, currentContractDir, lastContractName) {
  const lastContract = await helperPdf.loadObject(currentContractDir + '\\' + lastContractName, getVersion)
  const newContract = await helperPdf.loadObject(options.rootDir + '\\' + options.blankContract, getVersion)

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
    error('QUIT')
  }

  // cf. https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedfont
  // const helvetica = await newContract.pdf.embedFont(StandardFonts.Helvetica)
  newContract.pdf.registerFontkit(fontkit)
  //const fontToUse = await newContract.pdf.embedFont(fs.readFileSync('C:\\Windows\\Fonts\\ARLRDBD.TTF'))
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fontToUse = await newContract.pdf.embedFont(fs.readFileSync(path.join(__dirname, 'Helvetica.ttf')))

  if (lastContract.version === undefined) {
    const fields = helperPdf.getFields(lastContract.pdf, helperEmailContrat.fieldsMatch)
    const decompose = helperPdf.decomposeFields(fields, helperEmailContrat.fieldsMatch)
    console.log(decompose)

    const lNom = decompose.chatNom.length
    if (lNom == 0) {
      helperJs.error(`Impossible d'extraire le nom du chat du contrat ${lastContractName}`)
    }
    if (lNom > 3) {
      helperJs.error(`Impossible d'avoir plus de 3 chats dans le contrat`)
    }

    const lNaissance = decompose.chatNaissance.length
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

    helperPdf.updateTextField(newContract.form, 'pNom',       decompose.nom,        fontToUse)
    helperPdf.updateTextField(newContract.form, 'pAddr1',     decompose.adr1,       fontToUse)
    helperPdf.updateTextField(newContract.form, 'pAddr2',     decompose.adr2,       fontToUse)
    helperPdf.updateTextField(newContract.form, 'pTel',       decompose.tel,        fontToUse)
    helperPdf.updateTextField(newContract.form, 'pEmail',     decompose.email,      fontToUse)
    helperPdf.updateTextField(newContract.form, 'pUrgence1',  decompose.urgenceNom, fontToUse)
    helperPdf.updateTextField(newContract.form, 'pUrgence2',  decompose.urgenceTel, fontToUse)

    helperPdf.updateListTextField(newContract.form, ['c1Nom', 'c2Nom', 'c3Nom'], decompose.chatNom, fontToUse)
    helperPdf.updateListTextField(newContract.form, ['c1Naissance', 'c2Naissance', 'c3Naissance'], decompose.chatNaissance, fontToUse)
    helperPdf.updateListTextField(newContract.form, ['c1Id', 'c2Id', 'c3Id'], decompose.id, fontToUse)
    helperPdf.updateListTextField(newContract.form, ['c1Race', 'c2Race', 'c3Race'], decompose.race, fontToUse)
    helperPdf.updateListTextField(newContract.form, ['c1VaccinFELV', 'c2VaccinFELV', 'c3VaccinFELV'], decompose.felv, fontToUse)
    helperPdf.updateListTextField(newContract.form, ['c1VaccinRCP', 'c2VaccinRCP', 'c3VaccinRCP'], decompose.rcp, fontToUse)


    // TODO MALE FEMELLE

    // TODO MALADIES CONNUES SUR 3 LIGNES

    // TODO Check date de vaccins avec remarque

    // TODO si plus de 3 chats

  } else {
    helperJs.error('NOT IMPLEMENTED YET')
  }

  // const textFieldsToCopy = [
  //   [ 'pNom', 'Nom Prénom' ],   // list of equivalent field name - 1st one is the one in the new contract
  //   [ 'pAddr1', 'Adresse 1' ],
  //   [ 'pAddr2', 'Adresse 2' ],
  //   [ 'pTel', 'Téléphone' ],
  //   [ 'pEmail', 'Adresse email' ],
  //   [ 'pUrgence1', 'Personne autre que moi à prévenir en cas durgence', 'Personne à prévenir en cas durgence' ],
  //   [ 'pUrgence2', 'Téléphone_2' ],
    
  //   [ 'c1Nom', '1' ],
  //   [ 'c1Id', '2' ],
  //   [ 'c1Race', 'undefined' ],
  //   [ 'c1VaccinFELV', 'Leucose FELV' ],
  //   [ 'c1VaccinRCP', 'Typhus coryza RCP' ],
  //   [ 'c1Maladie1', 'Oui Non Si oui lesquelles' ],
  // ];
  // textFieldsToCopy.forEach(field => {
  //   let value = '';
  //   field.forEach(text => {
  //     try {
  //       value = lastContract.form.getTextField(text).getText();
  //       console.log(value);
  //     } catch {
  //       // cannot have it
  //     }
  //   });
    
  //   updateTextField(newContract.form, field[0], value, fontToUse)
  // })

  // const checkBoxFieldsToCopy = [
  //   [ 'c1Male', 'Mâle' ],
  //   [ 'c1Femelle', 'Femelle' ],
  //   [ 'undefined_2' ],    // Maladie oui  -  now obsolete
  //   [ 'undefined_3' ],    // Maladie non  -  now obsolete
  // ];
  // checkBoxFieldsToCopy.forEach(field => {
  //   field.forEach(text => {
  //     try {
  //       if (lastContract.form.getCheckBox(text).isChecked()) {
  //         newContract.form.getCheckBox(field[0]).check();
  //       }
  //     } catch {
  //       // cannot have it
  //     }
  //   })
  // });

  // TODO: service sur 3 lignes
  const reservations = [
    [ 'sArriveeDate', options.from ],
    [ 'sDepartDate', options.to ],
    [ 'sNbJours', options.nbdays.toString() ],
    [ 'sTarifJour', options.priceday + '€' ],
    [ 'sTotal', options.total + '€' ],
    [ 'sAcompte', (options.accompte==='') ? ('0€') : (options.accompte + '€') ],
    [ 'sAcompteDate', options.date_accompte ],
    [ 'sSolde', options.solde + '€' ],
    [ 'sService1', (options.services==='') ? ('0€') : (options.services) ],
  ]
  reservations.forEach(resa => helperPdf.updateTextField(newContract.form, resa[0], resa[1], fontToUse))

  // get new contract name
  const reContractName = /^[0-9]*[a-z]?[\s]*-[\s]*/;    // remove numbers (dates) 4 times
  var newContrat = lastContractName;
  newContrat = newContrat.replace(reContractName, '');
  newContrat = newContrat.replace(reContractName, '');
  newContrat = newContrat.replace(reContractName, '');
  const fromParts = options.from.split("/");
  newContrat = fromParts[2] + ' - ' + fromParts[1] + ' - ' + fromParts[0] + ' - ' + newContrat;
  newContrat = currentContractDir + '\\' + newContrat

  // following is causing some isses when opening it with Adobe DC - shows some squares
  // https://github.com/Hopding/pdf-lib/issues/569#issuecomment-1087328416
  // update needappearance field
  //newContract.form.acroForm.dict.set(PDFName.of('NeedAppearances'), PDFBool.True)


  child_process.exec('explorer ' + currentContractDir);
  try {
    const pdfBuf = await newContract.pdf.save(/*{ updateFieldAppearances: true }*/)
    fs.writeFileSync(newContrat, pdfBuf, { flag: 'wx' });
  } catch(e) {
    console.log(e);
    error("Impossible d'écrire le fichier   " + options.rootDir + '\\' + newContrat);
  }
  child_process.exec('explorer ' + newContrat);

}


function main() {
  const options = get_args();
  const currentContractDir = options.rootDir + '\\' + helperEmailContrat.getCurrentContractDir(options.rootDir, options.who);
  const lastContractName = helperEmailContrat.getLastContract(currentContractDir);

  updatePDF(options, currentContractDir, lastContractName)
}


main();
