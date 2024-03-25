#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License
///

import _yargs from 'yargs'
import fs from 'fs'
import path from 'path';
import child_process from 'child_process'
import helperCattery from '../helpers/helperCattery.mjs';
import helperJs from '../helpers/helperJs.mjs';


async function main() {
  const options = await helperCattery.getArgs({
    usage: 'Create new directory of a new customer',
    exactPdf: false,
    checkError: false,
  })

  // create dir
  const who = helperCattery.normalizeContractDir(options.who, true)
  const dir = path.join(options.contractRootDir, who)
  console.log(dir)
  if (fs.existsSync(dir)) {
    child_process.exec('explorer ' + dir);
    throw(`ALREADY A CUSTOMER: ${dir}`)
  }

  // create directory
  fs.mkdirSync(dir);

  // copy pdf file
  const originalCatName = who.split('-')[0].trim()
  console.log(`Nom des chats: ${originalCatName}`)
  let catName = await helperJs.question.question(`Entrée pour conserver, ou autre nom: `)
  if (catName === '') {
    catName = originalCatName
  }
  const src = path.join(options.contractRootDir, options.enterprise.toLowerCase() + '-contrat.pdf')
  const dst = path.join(dir, '2000 - 01 - 01 - ' + catName + '-' + options.enterprise.toLowerCase() + '-contrat.pdf')
  fs.copyFileSync(src, dst, fs.constants.COPYFILE_EXCL)

  child_process.exec('explorer ' + dir);
  child_process.exec('explorer ' + dst);
}

try {
  await main();
  console.log('DONE')
} catch (e) {
  console.log(e)
  console.log('Error is catched')
}
