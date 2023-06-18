/// Copyright (c) Pascal Brand
/// MIT License
///
// Based on pdf-lib
//   npm install pdf-lib
//

import { PDFDocument } from 'pdf-lib'
import fs from 'fs'

import helperEmailContrat from '../helpers/helperEmailContrat.mjs'

// https://nodejs.org/api/readline.html
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';
const rl = readline.createInterface({ input, output });

function getVotrePtitLoulou(gender) {
  switch (gender) {
    case '1':
      return 'votre ptit loulou'
    case '2':
      return 'votre ptite louloutte'
    case '3':
      return 'vos ptits loulous'
    case '4':
      return 'vos ptites loulouttes'
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

async function sendMail(options, currentContractDir) {
  const contractName = helperEmailContrat.getContractFrom(options.from, currentContractDir);
  const pdfFullName = `${currentContractDir}\\${contractName}`
  const pdfContract = await PDFDocument.load(fs.readFileSync(pdfFullName));
  const formContract = pdfContract.getForm();

  let attachment = `file:///${pdfFullName}`

  let email
  try {
    email = formContract.getTextField('Adresse email').getText();
  } catch {
    error('Impossible de connaitre l\'email de ' + options.who)
  }

  // email = 'toto@gmail.com'
  const reCatNameExtract = /[\s]+[-/].*/;    // look for 1st dash, and remove the remaining
  const catName = options.who.replace(reCatNameExtract, '');

  let gender = '0'
  while ((gender!='1') && (gender!='2') && (gender!='3') && (gender!='4')) {
    gender = await new Promise(resolve => {
      rl.question('1- Male  or  2- Female  or   3- At least 1 Male   or  4- Only Female?  ', resolve)
    })
  }

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

  if ((options.accompte != '') && (options.accompte != '0')) {
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

  body += `A très bientôt, des bisous à ${catName} de la part de ${getSa(gender)} nounou.`
  body += `<br>`
  body += `<br>`

  helperEmailContrat.composeThunderbird(email, subject, body, attachment)
}


function main() {
  const options = helperEmailContrat.get_args('Open thinderbird to send a THANKS email, from an excel compta macro directly\n\nUsage: $0 [options]');
  const currentContractDir = options.rootDir + '\\' + helperEmailContrat.getCurrentContractDir(options.rootDir, options.who);

  sendMail(options, currentContractDir)
}


main();
