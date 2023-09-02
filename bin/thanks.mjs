/// Copyright (c) Pascal Brand
/// MIT License
///

import helperCattery from '../helpers/helperCattery.mjs'
import path from 'path'

async function sendMail(options) {
  console.log(options.rootDir)
  const {pdfObject, contractName} = await helperCattery.getPdfDataFromDataCompta(
    {name: options.who, sComptaArrival: options.from}, 
    path.parse(options.rootDir).dir + '\\compta.xls',
    true)
  helperCattery.helperPdf.postErrorCheck(pdfObject, undefined)

  const email = helperCattery.helperPdf.getEmail(pdfObject)

  // TODO use the one in the pdf
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
  
  body += `En vous remerciant,`

  helperJs.thunderbird.compose(email, subject, body)
}


async function main() {
  const options = helperCattery.get_args('Open thinderbird to send a THANKS email, from an excel compta macro directly\n\nUsage: $0 [options]');

  await sendMail(options, currentContractDir, lastContractName)
}


await main();
