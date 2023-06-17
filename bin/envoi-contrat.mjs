/// Copyright (c) Pascal Brand
/// MIT License
///
// Based on pdf-lib
//   npm install pdf-lib
//

import { PDFDocument } from 'pdf-lib'
import fs from 'fs'

import helperEmailContrat from '../helpers/helperEmailContrat.mjs'


async function sendMail(options, currentContractDir, lastContract) {
  const pdfLastContract = await PDFDocument.load(fs.readFileSync(currentContractDir + '\\' + lastContract));
  const formLastContract = pdfLastContract.getForm();

  let email
  try {
    email = formLastContract.getTextField('Adresse email').getText();
  } catch {
    error('Impossible de connaitre l\'email de ' + options.who)
  }

  // email = 'toto@gmail.com'
  const reCatNameExtract = /[\s]+[-/].*/;    // look for 1st dash, and remove the remaining
  const catName = options.who.replace(reCatNameExtract, '');

  let subject = 'Merci pour votre acompte'
  let body = ""
  body += `Bonjour,`
  body += `<br>`
  body += `<br>`
  
  body += `J'ai bien reçu l'acompte de ${options.accompte}€ pour les vacances de ${catName} à ${options.entreprise} `
  body += `du ${options.from} au ${options.to}.`
  body += `<br>`
  body += `<br>`
  
  body += `En vous remercianttt,`

  helperEmailContrat.composeThunderbird(email, subject, body)
}


function main() {
  const options = helperEmailContrat.get_args('Open thinderbird to send a THANKS email, from an excel compta macro directly\n\nUsage: $0 [options]');
  const currentContractDir = options.rootDir + '\\' + helperEmailContrat.getCurrentContractDir(options.rootDir, options.who);
  const lastContract = helperEmailContrat.getLastContract(currentContractDir);

  sendMail(options, currentContractDir, lastContract)
}


main();
