#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License

import helperCattery from '../helpers/helperCattery.mjs'
import helperJs from '../js/helpers/helperJs.mjs'


async function main() {
  const argsComptaPdf = await helperCattery.getArgsComptaPdf({
    usage: 'Check contract booking data',
    exactPdf: true,
    checkError: true,
  })

  await helperCattery.helperContract.checkComptaData(argsComptaPdf)
  await helperCattery.helperContract.checkContractBooking(argsComptaPdf.pdfObject, argsComptaPdf)
}

try {
  await main();
  console.log('DONE')
} catch (e) {
  console.log(e)
  console.log('Error is catched')
}
await helperJs.utils.sleep(60*60)   // sleep for 1 hour, so that the console does not disappear when ran from Excel
