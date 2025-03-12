#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License
//

import * as fs from 'fs'
import * as path from 'path'

// @ts-ignore
import fileSyncCmp from 'file-sync-cmp'

import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import helperJs from '../../helpers/helperJs.mjs'

async function getArgs(usage: string) {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  let options = yargs
    .usage(usage)
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "dir1": {
        description: "1st dir",
        type: "string",
        requiresArg: true,
        required: true,
      },
      "dir2": {
        description: "2nd dir",
        type: "string",
        requiresArg: true,
        required: true,
      },
    }).check((argv) => {
      return true;
    }).strict()   // raise an error if an option is unknown

    // .fail((msg, err, yargs) => {
    //   if (err) throw err // preserve stack
    //   console.error('You broke it!')
    //   console.error(msg)
    //   console.error('You should be doing', yargs.help())
    //   throw 'YARGS ERROR'
    // })
    .argv;

  return options
}



function equalFiles(file1: string, file2: string) {
  return fileSyncCmp.equalFiles(file1, file2)
}

function checkDir(rootDir1: string, rootDir2: string, subDir: string, checkIdentical: boolean =true) {
  const excludes =  [ 'desktop.ini', 'Thumbs.db']
  const thisDir1 = path.join(rootDir1, subDir);
  const thisDir2 = path.join(rootDir2, subDir);

  if (!fs.existsSync(thisDir1) || !fs.statSync(thisDir1).isDirectory()) {
    console.log(helperJs.textColor(`Directory ${subDir} does not exist in ${rootDir1}`, 'FgRed'))
    return
  }
  if (!fs.existsSync(thisDir2) || !fs.statSync(thisDir2).isDirectory()) {
    console.log(helperJs.textColor(`Directory ${subDir} does not exist in ${rootDir2}`, 'FgRed'))
    return
  }

  fs.readdirSync(thisDir1).forEach(file => {
    if (excludes.includes(file)) {
      return;
    }
    const absolute1 = path.join(thisDir1, file);
    const absolute2 = path.join(thisDir2, file);
    const sub = path.join(subDir, file);
    if (fs.statSync(absolute1).isDirectory()) {
      checkDir(rootDir1, rootDir2, sub, checkIdentical);
    }
    else {
      if (!fs.existsSync(absolute2)) {
        console.log(helperJs.textColor(`File ${file} does not exist in ${subDir} of ${rootDir2}`, 'FgYellow'))
      } else if (!fs.statSync(absolute2).isFile()) {
        console.log(helperJs.textColor(`${file} is NOT a file in ${subDir} of ${rootDir2}`, 'FgCyan'))
      } else if (checkIdentical && !equalFiles(absolute1, absolute2)) {
        console.log(helperJs.textColor(`File ${file} does NOT idendical in ${subDir}`, 'FgBlue'))
      }
    }
  });
}


export async function sameDir() {
  const options = await getArgs(`same-dir --dir1="save" --dir2="backup"`)
  checkDir(options.dir1, options.dir2, '.')
  checkDir(options.dir2, options.dir1, '.', false)
}
