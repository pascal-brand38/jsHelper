/// Copyright (c) Pascal Brand
/// MIT License
///

import helperCattery from '../helpers/helperCattery.mjs'
import helperPdf from '../helpers/helperPdf.mjs'

async function sendMail(options, currentContractDir, lastContractName) {
  const pdfContract = await helperPdf.pdflib.load(currentContractDir + '\\' + lastContractName, helperCattery.helperPdf.getVersion)
  const pdfInfoData = helperCattery.helperPdf.pdfExtractInfoDatas(pdfContract[helperPdf.pdflib.helperProp].version)
  helperPdf.pdflib.setPropFromFields(pdfContract, pdfInfoData.setPropFromFieldsDatas, pdfInfoData.postSetPropFromFields)

  const email = helperCattery.helperPdf.getEmail(pdfContract)

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

  helperCattery.composeThunderbird(email, subject, body)
}


async function main() {
  const options = helperCattery.get_args('Open thinderbird to send a THANKS email, from an excel compta macro directly\n\nUsage: $0 [options]');
  const currentContractDir = options.rootDir + '\\' + helperCattery.getCurrentContractDir(options.rootDir, options.who);
  const lastContractName = helperCattery.getLastContract(currentContractDir);

  await sendMail(options, currentContractDir, lastContractName)
}


await main();
