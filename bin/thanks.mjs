#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License
///

import helperCattery from '../helpers/helperCattery.mjs'
import helperJs from '../js/helpers/helperJs.mjs'


async function main() {
  const argsComptaPdf = await helperCattery.getArgsComptaPdf({
      usage: 'Open thinderbird to send a THANKS email, from an excel compta macro directly\n\nUsage: $0 [options]',
      exactPdf: true,
      checkError: true,
    }
  );

  await helperCattery.checkInFuture(argsComptaPdf.options.from)

  const email = helperCattery.helperPdf.getEmail(argsComptaPdf.pdfObject)
  const catNames = await helperCattery.helperPdf.getCatNames(argsComptaPdf.pdfObject)

  let subject = `Merci pour votre acompte pour les vacances de ${catNames}`
  let body = ""
  body += `Bonjour,`
  body += `<br>`
  body += `<br>`

  body += `J'ai bien reçu l'acompte de ${argsComptaPdf.rowCompta.acompteAmount}€ `
  body += `pour les vacances de ${catNames} à ${argsComptaPdf.options.enterprise} `
  body += `du ${argsComptaPdf.options.from} au ${argsComptaPdf.options.to}.`
  body += `<br>`
  body += `<br>`

  body += `En vous remerciant,`
  body += `<br>`
  body += `<br>`

  body += `A très bientôt,`
  body += `<br>`
  body += `Virginie - ${argsComptaPdf.options.enterprise}`
  body += `<br>`


  await helperJs.thunderbird.compose(email, subject, body)
}

try {
  await main();
  console.log('DONE')
} catch (e) {
  console.log(e)
  console.log('Error is catched')
}
await helperJs.utils.sleep(60*60)   // sleep for 1 hour, so that the console does not disappear when ran from Excel
