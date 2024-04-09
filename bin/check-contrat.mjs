#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License

import helperCattery from '../helpers/helperCattery.mjs'


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
