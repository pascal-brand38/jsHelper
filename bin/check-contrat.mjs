#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License

import path from 'path'

import helperCattery from '../helpers/helperCattery.mjs'
import helperJs from '../helpers/helperJs.mjs'
import { DateTime } from '../extend/luxon.mjs'


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
