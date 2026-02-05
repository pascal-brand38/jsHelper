#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License

import path from 'path'

import helperCattery from '../helpers/helperCattery.mjs'
import helperJs from '../js/helpers/helperJs.mjs'
import { DateTime } from 'luxon'
import '../js/extend/luxon.mjs'

function getVotrePtitLoulou(gender) {
  const nChoices = 2
  const r = Math.floor(Math.random() * nChoices);
  switch (gender) {
    case '1':
      switch (r) {
        case 0: return 'votre ptit bonhomme'
        default: return 'votre ptit loulou'
      }
    case '2':
      switch (r) {
        case 0: return 'votre ptite miss'
        default: return 'votre ptite louloutte'
      }
    case '3':
      switch (r) {
        default: return 'vos ptits loulous'
      }
    case '4':
      switch (r) {
        case 0: return 'vos ptites miss'
        default: return 'vos ptites loulouttes'
      }
  }
}

async function getGender(pdfObject) {
  let hasMale = false
  let hasFemelle = false
  let hasUndefined = false

  const chat = pdfObject.getExtend().chat
  const nbCats = chat.males.length
  chat.males.forEach((m, i) => {
    const f = chat.femelles[i]
    if (m && f) {
      hasUndefined = true
    } else if (m) {
      hasMale = true
    } else if (f) {
      hasFemelle = true
    } else {
      hasUndefined = true
    }
  })

  if (!hasUndefined) {
    if (nbCats === 1) {
      if (hasMale) {
        return '1'    // 1 male
      } else {
        return '2'    // 1 female
      }
    } else {
      if (!hasMale && hasFemelle) {
        return '4'    // several females
      } else {
        return '3'    // several cats, with at least 1 male
      }
    }
  }

  // we do not know, so we ask
  let gender = '0'
  while ((gender!='1') && (gender!='2') && (gender!='3') && (gender!='4')) {
    gender = await helperJs.question.question('0- Quit  or  1- Male  or  2- Female  or   3- At least 1 Male   or  4- Only Female?  ')
    if (gender == 0) {
      helperJs.error("Quitting")
    }
  }
  return gender
}

async function sendMail(argsComptaPdf) {
  await helperCattery.checkInFuture(argsComptaPdf.options.from)

  const email = helperCattery.helperPdf.getEmail(argsComptaPdf.pdfObject)

  const catNames = await helperCattery.helperPdf.getCatNames(argsComptaPdf.pdfObject)

  let gender = await getGender(argsComptaPdf.pdfObject)

  const acompteAmount = argsComptaPdf.rowCompta.acompteAmount
  const acompteDate = argsComptaPdf.rowCompta.acompteDate
  if (((acompteAmount !== undefined) && (acompteAmount !== '0')) && ((acompteDate === '') || (acompteDate === undefined))) {
    // deposit is required and not yet paid
  } else {
    helperJs.error(`No need to send relance email as acompteAmount is ${acompteAmount} and acompteDate is ${acompteDate}`)
  }

  let subject = `Réservation pour les vacances de ${catNames} à ${argsComptaPdf.options.enterprise}`

  let body = ""
  body += `Bonjour,`
  body += `<br>`
  body += `<br>`

  body += `Je reviens vers vous car vous n'avez pas finalisé la réservation pour `
  body += `les vacances de ${catNames} `
  body += `du ${DateTime.fromFormatStartOfDay(argsComptaPdf.options.from).weekdayStr()} ${argsComptaPdf.options.from} `
  body += `au ${DateTime.fromFormatStartOfDay(argsComptaPdf.options.to).weekdayStr()} ${argsComptaPdf.options.to}. `

  body += `Si les vacances de ${getVotrePtitLoulou(gender)} sont toujours d'actualité, merci de `
  body += `faire le règlement de l'acompte de ${acompteAmount}€ pour réserver la chambre de ${catNames} `
  body += `car actuellement, je refuse des loulous car la garderie est complète.`
  body += `<br>`
  body += `<br>`

  body += `En vous remerciant et merci de votre compréhension,`
  body += `<br>`
  body += `<br>`

  body += `A très bientôt,`
  body += `<br>`
  body += `Virginie - ${argsComptaPdf.options.enterprise}`
  body += `<br>`

  // add the flatten attachement.
  // if not flat, the printed form from a smartphone may be empty :(

  argsComptaPdf.pdfObject.flatten()
  const flattenName = path.join('C:', 'tmp', path.basename(argsComptaPdf.contractName))
  try {
    await argsComptaPdf.pdfObject.saveWrite(flattenName, { flag: 'w' })
  } catch(e) {
    helperJs.error(`Impossible to write file ${flattenName}`)
  }

  let attachment = `file:///${flattenName}`

  await helperJs.thunderbird.compose(email, subject, body, attachment)
}

async function main() {
  const argsComptaPdf = await helperCattery.getArgsComptaPdf({
    usage: 'Open thunderbird to send a contract, from an excel compta macro directly\n\nUsage: $0 [options]',
    exactPdf: true,
    checkError: true,
  })

  await sendMail(argsComptaPdf)
}

try {
  await main();
  console.log('DONE')
} catch (e) {
  console.log(e)
  console.log('Error is catched')
}
await helperJs.utils.sleep(60*60)   // sleep for 1 hour, so that the console does not disappear when ran from Excel
