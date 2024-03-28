#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License
///

import _yargs from 'yargs'
import fontkit from '@pdf-lib/fontkit'
import fs from 'fs'
import path from 'path';
import { fileURLToPath } from 'url';
import child_process from 'child_process'
import helperCattery from '../helpers/helperCattery.mjs';
import helperJs from '../helpers/helperJs.mjs';
import { DateTime } from '../extend/luxon.mjs'
import { PDFDocument } from '../extend/pdf-lib.mjs';

// fill pdf fields corresponding to the owner
function fillProprio(newContract, lastContract, argsComptaPdfLastContract, fontToUse) {
  newContract.setTextfield('pNom',       lastContract.getExtend().proprio.nom,        fontToUse)
  newContract.setTextfield('pAddr1',     lastContract.getExtend().proprio.adr1,       fontToUse)
  newContract.setTextfield('pAddr2',     lastContract.getExtend().proprio.adr2,       fontToUse)
  newContract.setTextfield('pTel',       lastContract.getExtend().proprio.tel,        fontToUse)
  newContract.setTextfield('pEmail',     lastContract.getExtend().proprio.email,      fontToUse)
  newContract.setTextfield('pUrgence1',  lastContract.getExtend().proprio.urgenceNom, fontToUse)
  newContract.setTextfield('pUrgence2',  lastContract.getExtend().proprio.urgenceTel, fontToUse)
}

// fill pdf fields corresponding to the cats
function fillCats(newContract, lastContract, argsComptaPdfLastContract, fontToUse) {
  newContract.setTextfields(['c1Nom', 'c2Nom', 'c3Nom'], lastContract.getExtend().chat.noms, fontToUse)
  newContract.setTextfields(['c1Naissance', 'c2Naissance', 'c3Naissance'], lastContract.getExtend().chat.naissances, fontToUse)
  newContract.setTextfields(['c1Id', 'c2Id', 'c3Id'], lastContract.getExtend().chat.ids, fontToUse)
  newContract.setTextfields(['c1Race', 'c2Race', 'c3Race'], lastContract.getExtend().chat.races, fontToUse)
  newContract.setTextfields(['c1VaccinFELV', 'c2VaccinFELV', 'c3VaccinFELV'], lastContract.getExtend().chat.felvs, fontToUse)
  newContract.setTextfields(['c1VaccinRCP', 'c2VaccinRCP', 'c3VaccinRCP'], lastContract.getExtend().chat.rcps, fontToUse)
  newContract.setTextfields(['c1Maladie1', 'c1Maladie2', 'c1Maladie3'], lastContract.getExtend().chat.maladies[0], fontToUse)
  if (lastContract.getExtend().chat.maladies[1] !== undefined) {
    newContract.setTextfields(['c2Maladie1', 'c2Maladie2', 'c2Maladie3'], lastContract.getExtend().chat.maladies[1], fontToUse)
  }
  if (lastContract.getExtend().chat.maladies[2] !== undefined) {
    newContract.setTextfields(['c3Maladie1', 'c3Maladie2', 'c3Maladie3'], lastContract.getExtend().chat.maladies[2], fontToUse)
  }

  // male / femelle
  const m = ['c1Male', 'c2Male', 'c3Male']
  const f = ['c1Femelle', 'c2Femelle', 'c3Femelle']
  const chat = lastContract.getExtend().chat
  chat.noms.forEach((c, index) => {
    if (chat.males[index]) {
      newContract.checks([ m[index] ])
    }
    if (chat.femelles[index]) {
      newContract.checks([ f[index] ])
    }
  })

  // check vaccination date
  const epochDeparture = DateTime.fromFormatStartOfDay(argsComptaPdfLastContract.options.to).toEpoch()
  helperCattery.helperPdf.isVaccinUptodate(lastContract, epochDeparture, newContract, fontToUse)
}

// fill pdf fields corresponding to the booking
async function fillBooking(newContract, lastContract, argsComptaPdfLastContract, fontToUse) {
  // services: from string to list
  let services = argsComptaPdfLastContract.options.services
  if (services !== '') {
    services = services.split(' + ')
  } else {
    services = []
  }

  // check daily tariff
  const noms = lastContract.getExtend().chat.noms
  let prixJour = argsComptaPdfLastContract.rowCompta.prixJour
  const prixChambreMin = helperCattery.helperContract.priceDay[noms.length-1][0].price
  const prixChambreMax = helperCattery.helperContract.priceDay[noms.length-1][1].price
  if (prixJour < prixChambreMin) {
    await helperJs.question.question(`${prixJour}€ pour ${noms} ???? - Appuyer sur entrée`)
  }

  // check how many rooms we take
  let prixSoins = (prixJour - prixChambreMin)
  if ((prixJour >= prixChambreMax) && (prixChambreMin!==prixChambreMax)) {
    let answer
    while ((answer!=='0') && (answer!=='1')) {
      console.log(`0) ${helperCattery.helperContract.priceDay[noms.length-1][0].nbRooms} chambre`)
      console.log(`1) ${helperCattery.helperContract.priceDay[noms.length-1][1].nbRooms} chambre`)
      answer = await helperJs.question.question(`==> `)
    }
    if (answer === '0') {
      prixJour = prixChambreMin
    } else {
      prixSoins = (prixJour - prixChambreMax)
      prixJour = prixChambreMax
    }
  } else {
    prixJour = prixChambreMin
  }

  if (prixSoins !== 0) {
    if (prixSoins % 2 != 0) {
      console.log(`Prix des soins journalier n'est pas pair: ${prixSoins}€`)
      await helperJs.question.question(`Appuyer pour continuer`)
    }

    const soins = `${prixSoins * argsComptaPdfLastContract.rowCompta.nbJours}€ (${prixSoins / 2}x2€/jour - soins)`

    console.log(`Prix journalier ajusté à: ${prixJour}€`)
    services.forEach((s, i) => {
      services[i] = s.replace(argsComptaPdfLastContract.rowCompta.prixJour, prixJour)
      console.log(`- Services: ${services[i]}`)
    })
    console.log(`- Services: ${soins}`)
    const answer = await helperJs.question.question(`Appuyer sur entrée pour approuver, ou entrer un nouveau service: `)
    if (answer === '') {
      services.push(soins)
    } else {
      services.push(answer)
    }
  }

  if (services.length === 0) {
    services.push('0€')
  }

  let sAcompteDate = argsComptaPdfLastContract.rowCompta.acompteDate
  if (sAcompteDate) {
    sAcompteDate = DateTime.fromExcelSerialStartOfDay(sAcompteDate).toFormat('d/M/y')
  } else {
    sAcompteDate = ''
  }
  console.log(argsComptaPdfLastContract.rowCompta.acompteDate)
  const reservations = [
    [ 'sArriveeDate', argsComptaPdfLastContract.options.from ],
    [ 'sDepartDate', argsComptaPdfLastContract.options.to ],
    [ 'sNbJours', argsComptaPdfLastContract.rowCompta.nbJours.toString() ],
    [ 'sTarifJour', prixJour + '€' ],
    [ 'sTotal', argsComptaPdfLastContract.rowCompta.total + '€' ],
    [ 'sAcompte', (argsComptaPdfLastContract.rowCompta.acompteAmount===undefined) ? ('0€') : (argsComptaPdfLastContract.rowCompta.acompteAmount + '€') ],
    [ 'sAcompteDate', sAcompteDate ],
    [ 'sSolde', argsComptaPdfLastContract.rowCompta.soldeAmount + '€' ],
    [ 'sService1', services[0] ],
    [ 'sService2', (services.length >= 2) ? services[1] : '' ],
    [ 'sService3', (services.length >= 3) ? services[2] : '' ],
  ]
  const forbiddenWords = [ 'undefined', 'nan', ]    // must be a lower case list
  reservations.forEach(resa => {
    console.log(`${resa[0]} ${resa[1]}`)
    forbiddenWords.forEach(w => {
      if (resa[1].toLowerCase().includes(w)) {
        throw(`${w.toUpperCase()}: ${resa[0]} ${resa[1]}`)
      }
    })
    newContract.setTextfield(resa[0], resa[1], fontToUse)
  })
}


async function main() {
  // TODO: check daily price is the same than last time, not to forget medecine when creating the contract
  const argsComptaPdfLastContract = await helperCattery.getArgsComptaPdf({
    usage: 'Open thunderbird to send a contract, from an excel compta macro directly\n\nUsage: $0 [options]',
    exactPdf: false,
    checkError: true,
  })

  // check the dates are in the future, not in the past
  await helperCattery.checkInFuture(argsComptaPdfLastContract.options.from)

  const lastContract = argsComptaPdfLastContract.pdfObject
  const newContract = await PDFDocument.loadInit(path.join(argsComptaPdfLastContract.options.contractRootDir, argsComptaPdfLastContract.options.blankContract), helperCattery.helperPdf.getVersion)


  if (newContract.getExtend().version !== helperCattery.helperPdf.currentVersionContrat) {
    helperJs.utils.error(`New contract version:\n  Expected: ${helperCattery.helperPdf.currentVersionContrat}\n  and is: ${newContract.getExtend().version}`)
  }

  // cf. https://pdf-lib.js.org/docs/api/classes/pdfdocument#embedfont
  // const helvetica = await newContract.embedFont(StandardFonts.Helvetica)
  newContract.registerFontkit(fontkit)
  //const fontToUse = await newContract.embedFont(fs.readFileSync('C:\\Windows\\Fonts\\ARLRDBD.TTF'))
  const __filename = fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  const fontToUse = await newContract.embedFont(fs.readFileSync(path.join(__dirname, 'Helvetica.ttf')))

  fillProprio(newContract, lastContract, argsComptaPdfLastContract, fontToUse)
  fillCats(newContract, lastContract, argsComptaPdfLastContract, fontToUse)
  await fillBooking(newContract, lastContract, argsComptaPdfLastContract, fontToUse)


  // adding cat name on top of page 1
  // newContract.addText(lastContract.getExtend().chat.noms.join(', '))

  // get new contract name
  const currentContractDir = path.parse(lastContract.getFullname()).dir
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

  child_process.exec('explorer ' + currentContractDir.replace(/\//g, '\\'));
  try {
    await newContract.saveWrite(newContractName)
  } catch(e) {
    console.log(e);
    helperJs.utils.error("Impossible d'écrire le fichier   " + newContractName);
  }
  console.log('explorer ' + newContractName)
  child_process.exec('explorer "' + newContractName.replace(/\//g, '\\') + '"');
}

try {
  await main();
  console.log('DONE')
} catch (e) {
  console.log(e)
  console.log('Error is catched')
}
