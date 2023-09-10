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
  const catNames = await helperCattery.helperPdf.getCatNames(argsComptaPdf.pdfObject)

  let subject = 'Merci pour votre acompte'
  let body = ""
  body += `Bonjour,`
  body += `<br>`
  body += `<br>`
  
  body += `J'ai bien reçu l'acompte de ${argsComptaPdf.rowCompta.accompte}€ `
  body += `pour les vacances de ${catNames} à ${argsComptaPdf.options.enterprise} `
  body += `du ${argsComptaPdf.options.from} au ${argsComptaPdf.options.to}.`
  body += `<br>`
  body += `<br>`
  
  body += `En vous remerciant,`

  await helperJs.thunderbird.compose(email, subject, body)
}

await main();
