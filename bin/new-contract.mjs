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
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import child_process from 'child_process'
import helperCattery from '../helpers/helperCattery.mjs';
import helperPdf from '../helpers/helperPdf.mjs'
import helperJs from '../helpers/helperJs.mjs';



async function main() {
  const argsComptaPdfLastContract = await helperCattery.getArgsComptaPdf({
    usage: 'Open thunderbird to send a contract, from an excel compta macro directly\n\nUsage: $0 [options]',
    exactPdf: false,
    checkError: true,
  })

  const contratDir =  path.parse(argsComptaPdfLastContract.options.comptaXls).dir + '\\Contrat Clients ' + argsComptaPdfLastContract.options.enterprise
  const lastContract = argsComptaPdfLastContract.pdfObject
  const newContract = await helperPdf.pdflib.load(contratDir + '\\' + argsComptaPdfLastContract.options.blankContract, helperCattery.helperPdf.getVersion)

  if (newContract[helperPdf.pdflib.helperProp].version !== helperCattery.helperPdf.currentVersionContrat) {
    helperJs.error(`New contract version:\n  Expected: ${helperCattery.helperPdf.currentVersionContrat}\n  and is: ${newContract[helperPdf.pdflib.helperProp].version}`)
  }

  // cf. https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedfont
  // const helvetica = await newContract.pdf.embedFont(StandardFonts.Helvetica)
  newContract.pdf.registerFontkit(fontkit)
  //const fontToUse = await newContract.pdf.embedFont(fs.readFileSync('C:\\Windows\\Fonts\\ARLRDBD.TTF'))
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fontToUse = await newContract.pdf.embedFont(fs.readFileSync(path.join(__dirname, 'Helvetica.ttf')))

  const epochDeparture = helperJs.date.toEpoch(helperJs.date.fromFormatStartOfDay(argsComptaPdfLastContract.options.to))

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
    if (chat.males[index]) {
      helperPdf.pdflib.checks(newContract, [ m[index] ])
    }
    if (chat.femelles[index]) {
      helperPdf.pdflib.checks(newContract, [ f[index] ])
    }
  })

  // check vaccination date
  const remarque = ['c1VaccinRemarque', 'c2VaccinRemarque', 'c3VaccinRemarque']
  console.log(lastContract[helperPdf.pdflib.helperProp].chat)
  lastContract[helperPdf.pdflib.helperProp].chat.rcps.forEach((date, index) => {
    const epochRcp = helperJs.date.toEpoch(helperJs.date.fromFormatStartOfDay(date))
    const epochRcpNext = epochRcp + helperJs.date.epochNDays(365)
    if (epochRcpNext < epochDeparture) {
      helperPdf.pdflib.setTextfield(newContract, remarque[index], 'RAPPEL A REFAIRE', fontToUse)
    }
  })

  let services = []
  if (argsComptaPdfLastContract.options.services==='') {
    services.push('0€')
  } else {
    services = argsComptaPdfLastContract.options.services.split(' + ')
  }
  const reservations = [
    [ 'sArriveeDate', argsComptaPdfLastContract.options.from ],
    [ 'sDepartDate', argsComptaPdfLastContract.options.to ],
    [ 'sNbJours', argsComptaPdfLastContract.rowCompta.nbJours.toString() ],
    [ 'sTarifJour', argsComptaPdfLastContract.rowCompta.prixJour + '€' ],
    [ 'sTotal', argsComptaPdfLastContract.rowCompta.total + '€' ],
    [ 'sAcompte', (argsComptaPdfLastContract.rowCompta.accompte===undefined) ? ('0€') : (argsComptaPdfLastContract.rowCompta.accompte + '€') ],
    [ 'sAcompteDate', argsComptaPdfLastContract.rowCompta.dateAccompte ],
    [ 'sSolde', argsComptaPdfLastContract.rowCompta.solde + '€' ],
    [ 'sService1', services[0] ],
    [ 'sService2', (services.length >= 2) ? services[1] : '' ],
    [ 'sService3', (services.length >= 3) ? services[2] : '' ],
  ]
  reservations.forEach(resa => helperPdf.pdflib.setTextfield(newContract, resa[0], resa[1], fontToUse))

  // get new contract name
  const currentContractDir = path.parse(lastContract[helperPdf.pdflib.helperProp].pdfFullName).dir
  const reContractName = /^[0-9]*[a-z]?[\s]*-[\s]*/;    // remove numbers (dates) 4 times
  var newContractName = argsComptaPdfLastContract.contractName;
  newContractName = newContractName.replace(reContractName, '');
  newContractName = newContractName.replace(reContractName, '');
  newContractName = newContractName.replace(reContractName, '');
  const fromParts = argsComptaPdfLastContract.options.from.split("/");
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
    helperJs.error("Impossible d'écrire le fichier   " + newContractName);
  }
  child_process.exec('explorer ' + newContractName);
}



main();
