/// Copyright (c) Pascal Brand
/// MIT License
///

import helperCattery from '../helpers/helperCattery.mjs'
import helperJs from '../helpers/helperJs.mjs'


async function main() {
  const argsComptaPdf = await helperCattery.getArgsComptaPdf({
      usage: 'Open thinderbird to send a THANKS email, from an excel compta macro directly\n\nUsage: $0 [options]',
      exactPdf: true,
      checkError: true,
    }
  );

  const email = helperCattery.helperPdf.getEmail(argsComptaPdf.pdfObject)

  // TODO use the one in the pdf
  const reCatNameExtract = /[\s]+[-/].*/;    // look for 1st dash, and remove the remaining
  const catName = argsComptaPdf.options.who.replace(reCatNameExtract, '');

  let subject = 'Merci pour votre acompte'
  let body = ""
  body += `Bonjour,`
  body += `<br>`
  body += `<br>`
  
  body += `J'ai bien reçu l'acompte de ${argsComptaPdf.rowCompta.accompte}€ `
  body += `pour les vacances de ${catName} à ${argsComptaPdf.options.enterprise} `
  body += `du ${argsComptaPdf.options.from} au ${argsComptaPdf.options.to}.`
  body += `<br>`
  body += `<br>`
  
  body += `En vous remerciant,`

  await helperJs.thunderbird.compose(email, subject, body)
}

await main();
