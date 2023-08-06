/// Copyright (c) Pascal Brand
/// MIT License
///
// Based on pdf-lib
//   npm install pdf-lib
//

import { PDFDocument } from 'pdf-lib'
import fs from 'fs'
import path from 'path'
import reader from 'xlsx'
import os from 'os'

import helperEmailContrat from '../helpers/helperEmailContrat.mjs'
import helperExcel from '../helpers/helperExcel.mjs'
import helperJs from '../helpers/helperJs.mjs'

// https://nodejs.org/api/readline.html
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import { error } from 'console'
const rl = readline.createInterface({ input, output });

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
        case 0: return 'vos ptits bonhommes'
        default: return 'vos ptits loulous'
      }
    case '4':
      switch (r) {
        case 0: return 'vos ptites miss'
        default: return 'vos ptites loulouttes'
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

async function getGender(formContract) {
  let male = false
  try {
    male = formContract.getCheckBox('Mâle').isChecked();
  } catch {
  }
  let female = false
  try {
    female = formContract.getCheckBox('Femelle').isChecked();
  } catch {
  }

  let genderError = true
  let gender
  while (genderError) {
    gender = '0'
    while ((gender!='1') && (gender!='2') && (gender!='3') && (gender!='4')) {
      gender = await new Promise(resolve => {
        rl.question('0- Quit  or  1- Male  or  2- Female  or   3- At least 1 Male   or  4- Only Female?  ', resolve)
      })
      if (gender == 0) {
        helperEmailContrat.error("Quitting")
      }
    }
    genderError = 
      (male && female && gender!=3) ||
      (male && !female && gender!=1 && gender!=3) ||
      (!male && female && gender!=2 && gender!=4);
    if (genderError) {
      console.log(`Le contrat indique male=${male} et femelle=${female}`)
    }
  }

  return gender
}

async function getYesNo(text) {
  let answer = ''
  while ((answer!='y') && (answer!='n')) {
    answer = await new Promise(resolve => {
      rl.question(`${text} (y/n)? `, resolve)
    })
  }
  return answer
}

async function sendMail(options, currentContractDir) {
  const contractName = helperEmailContrat.getContractName(options.from, currentContractDir);
  const pdfFullName = `${currentContractDir}\\${contractName}`
  const pdfContract = await PDFDocument.load(fs.readFileSync(pdfFullName));
  const formContract = pdfContract.getForm();

  let email
  try {
    email = formContract.getTextField('Adresse email').getText();
  } catch {
    error('Impossible de connaitre l\'email de ' + options.who)
  }

  if (os.userInfo().username == 'pasca') {
    console.log(`WARNING`)
    console.log(`WARNING - As you are pasca, replace real email ${email} with a fake one`)
    console.log(`WARNING`)
    email = 'toto@titi.com'
  }
  const reCatNameExtract = /[\s]+[-/].*/;    // look for 1st dash, and remove the remaining
  const catName = options.who.replace(reCatNameExtract, '');

  let gender = await getGender(formContract)
  let vaccin = await getYesNo('Vaccins à refaire')

  let subject = `Réservation pour les vacances de ${catName} à ${options.entreprise}`

  let body = ""
  body += `Bonjour,`
  body += `<br>`
  body += `<br>`

  body += `Je vous envoie le contrat pour les vacances de ${catName} à ${options.entreprise} `
  body += `du ${options.from} au ${options.to}. `
  body += `<br>`
  body += `En vous remerciant de finir de le remplir, notamment les anti-parasitaires et de me le retourner signé, `
  body += `à l'arrivée de ${getVotrePtitLoulou(gender)} pour le début des vacances le ${options.from}.`
  body += `<br>`
  body += `<br>`

  if (vaccin == 'y') {
    body += `Les vaccins de ${catName} seront à refaire avant ${getSes(gender)} vacances. `
    body += `Aurez vous la possibilité de me faire une photo quand ${catName} ${getAura(gender)} refait ${getSes(gender)} vaccins? Merci.`
    body += `<br>`
    body += `<br>`  
  }

  if (((options.accompte !== '') && (options.accompte !== '0')) && ((options.date_accompte === '') || (options.date_accompte === undefined))) {
    body += `Afin de valider la réservation de ${getVotrePtitLoulou(gender)}, un acompte de 30% du montant total `
    body += `vous est demandé, soit ${options.accompte}€. `
    body += `<br>`
    body += `Vous pouvez régler soit par virement (coordonnées bancaires dans le contrat) soit par `
    body += `chèque à l'ordre de Virginie Roux, car je suis auto-entrepreneur. `
    body += `<br>`
    body += `En vous remerciant. `
    body += `<br>`
    body += `<br>`
  }

  body += `Pensez à amener l'alimentation ainsi que ${getLeCarnet(gender)} de santé de ${catName} pour toute la durée du séjour.`
  body += `<br>`
  body += `<br>`

  body += `${catName} ${getDevraEtreVermifuge(gender)} depuis moins de 4 mois, `
  body += `avec un produit vétérinaire (milbemax ou milbactor) et avoir reçu un traitement anti-puces `
  body += `8 jours avant son arrivée à la garderie.`
  body += `<br>`
  body += `<br>`

  body += `De plus en plus de chats arrivent avec des puces à la garderie, `
  body += `<span style="color:red; font-weight:700; text-decoration: underline;">JE REFUSE</span> `
  body += `maintenant les produits suivant inefficaces :`
  body += `<br>`
  body += `<br>`
  body += `<div style="color:red; font-weight:700; text-decoration: underline;">`
  body += `Frontline ou Frontline combo,`
  body += `<br>`
  body += `Fiprokil, Effipro, Fiprotec,`
  body += `<br>`
  body += `Advocate, Advantage,`
  body += `<br>`
  body += `Vectra Felis, Capstar chat,`
  body += `<br>`
  body += `ainsi que tous les produits à base de fipronil ...`
  body += `<br>`
  body += `Refus également de produits achetés en grande surface, en pharmacie ou encore par internet !`
  body += `</div>`
  body += `<br>`

  body += `Merci de votre compréhension afin de protéger ${catName} ainsi que la garderie`
  body += `<br>`
  body += `<br>`

  body += `Des bisous à ${catName} de la part de ${getSa(gender)} nounou.`
  body += `<br>`
  body += `<br>`

  // add the flatten attachement.
  // if not flat, the printed form from a smartphone may be empty :(
  let flatFormFullName = path.join('C:', 'tmp', path.basename(pdfFullName))
  formContract.flatten()
  try {
    const pdfBuf = await pdfContract.save(/*{ updateFieldAppearances: true }*/)
    fs.writeFileSync(flatFormFullName, pdfBuf, { flag: 'w' });
  } catch(e) {
    console.log(e);
    error("Impossible d'écrire le fichier   " + options.rootDir + '\\' + newContrat);
  }

  let attachment = `file:///${flatFormFullName}`

  helperEmailContrat.composeThunderbird(email, subject, body, attachment)
}

// Check the contract is coherent with respect to the previous one
// - deposit asking, or not
// - same daily price, not to forget medecine
async function checkXls(options) {
  const sheetName = 'Compta'
  const colName = 'B'
  const colFrom = 'C'
  const file = reader.readFile(options.comptaXls)

  // { header: "A" } indicates the json keys are A, B, C,... (cf. https://docs.sheetjs.com/docs/api/utilities/)
  const dFrom = helperJs.date.fromFormatStartOfDay(options.from)
  let rowPrev = null
  let rowCurrent = null
  reader.utils.sheet_to_json(file.Sheets[sheetName], { header: "A" }).every((row) => {
    if (row[colName] === options.who) {
      let d = helperJs.date.fromExcelSerialStartOfDay(row[colFrom])
      if (helperJs.date.toEpoch(dFrom) == helperJs.date.toEpoch(d)) {
        rowCurrent = row
        return false
      }
      rowPrev = row
      return true
    }
    return true
  })

  const colDailyPrice = 'E'
  const colDepositAmount = 'H'
  const askedDepositCurrent = (rowCurrent[colDepositAmount] != undefined)
  if (rowPrev && rowCurrent) {
    // check a deposit asking is the same (always ask, or never ask)
    const askedDepositPrev = (rowPrev[colDepositAmount] != undefined)
    if (askedDepositPrev != askedDepositCurrent) {
      if (!askedDepositCurrent) {
        console.log(`Pas de demande d'accompte, alors que demande la fois précédente`)
      } else {
        console.log(`Demande d'accompte, alors que pas de demande la fois précédente`)
      }
      let cont = await getYesNo(`On continue`)
      console.log()
      if (cont == 'n') {
        helperEmailContrat.error('Quit')
      }
    }

    // check daily price is the same - can be different in case of medecine
    // console.log(`${rowPrev[colDailyPrice]}    ${rowCurrent[colDailyPrice]}`)
    if (rowPrev[colDailyPrice] != rowCurrent[colDailyPrice])  {
      console.log(`Le prix journalier a été modifié: ${rowCurrent[colDailyPrice]}€ contre ${rowPrev[colDailyPrice]}€ précédemment`)
      let cont = await getYesNo(`On continue`)
      console.log()
      if (cont == 'n') {
        helperEmailContrat.error('Quit')
      }
    }

  } else {
    console.log(`1ere réservation`)
    console.log(`    Prix journalier de (${rowCurrent[colDailyPrice]}€)?`)
    if (askedDepositCurrent) {
      console.log(`    AVEC demande d'acompte?`)
    } else {
      console.log(`    SANS demande d'acompte?`)
    }
    let cont = await getYesNo(`On continue`)
    console.log()
    if (cont == 'n') {
      helperEmailContrat.error('Quit')
    }
  }
}

async function main() {
  const options = helperEmailContrat.get_args('Open thunderbird to send a contract, from an excel compta macro directly\n\nUsage: $0 [options]');
  await checkXls(options)
  const currentContractDir = options.rootDir + '\\' + helperEmailContrat.getCurrentContractDir(options.rootDir, options.who);

  await sendMail(options, currentContractDir)
}


main();
