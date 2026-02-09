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
        default: return 'votre loulou'
      }
    case '2':
      switch (r) {
        case 0: return 'votre ptite miss'
        default: return 'votre louloutte'
      }
    case '3':
      switch (r) {
        default: return 'vos loulous'
      }
    case '4':
      switch (r) {
        case 0: return 'vos ptites miss'
        default: return 'vos loulouttes'
      }
  }
}

function getLeCarnet(gender) {
  switch (gender) {
    case '1':
    case '2':
      return 'le carnet'
    case '3':
    case '4':
      return 'les carnets'
  }
}

function getSa(gender) {
  switch (gender) {
    case '1':
    case '2':
      return 'sa'
    case '3':
    case '4':
      return 'leur'
  }
}

function getSon(gender) {
  switch (gender) {
    case '1':
    case '2':
      return 'son'
    case '3':
    case '4':
      return 'leur'
  }
}

function getSes(gender) {
  switch (gender) {
    case '1':
    case '2':
      return 'ses'
    case '3':
    case '4':
      return 'leurs'
  }
}

function getAura(gender) {
  switch (gender) {
    case '1':
    case '2':
      return 'aura'
    case '3':
    case '4':
      return 'auront'
  }
}

function getDevraEtreVermifuge(gender) {
  switch (gender) {
    case '1':
      return 'devra être vermifugé'
    case '2':
      return 'devra être vermifugée'
    case '3':
      return 'devront être vermifugés'
    case '4':
      return 'devront être vermifugées'
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

async function getYesNo(text) {
  let answer = ''
  while ((answer!='y') && (answer!='n')) {
    answer = await helperJs.question.question(`${text} (y/n)? `)
  }
  return answer
}

async function sendMail(argsComptaPdf) {
  await helperCattery.checkInFuture(argsComptaPdf.options.from)

  const email = helperCattery.helperPdf.getEmail(argsComptaPdf.pdfObject)

  const catNames = await helperCattery.helperPdf.getCatNames(argsComptaPdf.pdfObject)

  let gender = await getGender(argsComptaPdf.pdfObject)

  let subject = `Réservation pour les vacances de ${catNames} à ${argsComptaPdf.options.enterprise}`

  let body = ""
  body += `Bonjour,`
  body += `<br>`
  body += `<br>`

  body += `Je vous envoie le contrat pour les vacances de ${catNames} à ${argsComptaPdf.options.enterprise} `
  body += `du ${DateTime.fromFormatStartOfDay(argsComptaPdf.options.from).weekdayStr()} ${argsComptaPdf.options.from} `
  body += `au ${DateTime.fromFormatStartOfDay(argsComptaPdf.options.to).weekdayStr()} ${argsComptaPdf.options.to}. `
  body += `<br>`
  body += `<br>`
  body += `En vous remerciant de finir de le remplir, notamment les anti-parasitaires et de me le retourner signé, `
  body += `à l'arrivée de ${getVotrePtitLoulou(gender)} pour le début de ${getSes(gender)} vacances le ${argsComptaPdf.options.from}.`
  body += `<br>`
  body += `<br>`

  const acompteAmount = argsComptaPdf.rowCompta.acompteAmount
  const acompteDate = argsComptaPdf.rowCompta.acompteDate
  if (((acompteAmount !== undefined) && (acompteAmount !== '0')) && ((acompteDate === '') || (acompteDate === undefined))) {
    body += `Afin de valider la réservation de ${getVotrePtitLoulou(gender)}, un acompte de 30% du montant total `
    body += `vous est demandé, soit ${acompteAmount}€. `
    body += `<br>`
    body += `Vous pouvez régler soit par virement (coordonnées bancaires dans le contrat) soit par `
    body += `chèque à l'ordre de Virginie Roux, car je suis auto-entrepreneur. `
    body += `<br>`
    body += `En vous remerciant. `
    body += `<br>`
    body += `<br>`
  } else {
    // pas de demande d'acompte. solde en espèce?
    let espece = await getYesNo(`Solde en espèce?`)
    console.log()
    if (espece == 'y') {
      body += `Le solde de la garderie sera à régler en espèce à l'arrivée de ${catNames} pour le début de ses vacances.`
      body += `<br>`
      body += `<br>`
    }
  }

  body += `<div style="border: 2px solid red; padding: 10px;">`
  body += `De plus en plus de chats arrivant avec des puces ou des vers à la garderie, le traitement doit `
  body += `maintenant être <span style="font-weight:700; text-decoration: underline;">obligatoirement</span> `
  body += `effectué avec l'un des produits suivants `
  body += `<span style="font-weight:700;">8 jours avant l'arrivée</span> `
  body += `de ${catNames}:`
  body += `<br>`
  body += `<br>`
  body += `- contre les vers: en comprimé <span style="color:red;">Milbemax ou Milbactor</span> uniquement. `
  body += `Les traitements par pipettes expulsent les vers par l'anus, mais ne les tuent pas. `
  body += `<span style="font-weight:700;"> Ces vers expédiés contagieux (ténias, etc.) `
  body += `peuvent être transmis à la nounou </span> et entraîner de graves complications.`
  body += `<br>`
  body += `<br>`
  body += `- contre les puces: `
  body += `<span style="color:red;"> Stronghold, Credelio, Bravecto, Nexgard Combo.</span>`
  body += `<br>`
  body += `<br>`
  body += `Merci de votre compréhension afin de protéger ${catNames}, la garderie et sa nounou.`
  body += `</div>`
  body += `<br>`
  body += `<br>`

  const epochDeparture = DateTime.fromFormatStartOfDay(argsComptaPdf.options.to).toEpoch()
  const vaccinUptodate = helperCattery.helperPdf.isVaccinUptodate(argsComptaPdf.pdfObject, epochDeparture)
  if (!vaccinUptodate) {
    const vaccin = await getYesNo('Vaccins à refaire')    // ask as they seem not up-to-date
    if (vaccin == 'y') {
      body += `Les vaccins de ${catNames} seront à refaire avant ${getSes(gender)} vacances. `
      body += `Aurez vous la possibilité de me faire une photo quand ${catNames} ${getAura(gender)} refait ${getSes(gender)} vaccins `
      body += `afin que je mette le contrat à jour? Merci.`
      body += `<br>`
      body += `<br>`
    }
  }

  body += `Pensez à amener l'alimentation ainsi que ${getLeCarnet(gender)} de santé de ${catNames} pour toute la durée du séjour.`
  body += `<br>`
  body += `<br>`

  body += `Des bisous à ${catNames} de la part de ${getSa(gender)} nounou.`
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
