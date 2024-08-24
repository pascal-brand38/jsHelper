#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License
///
/// Save files on the cloud
/// - if it does not exist: mv
/// - if it exists and not the same: copy with -{date} the previous version, and move
///
/// node bin/save-on-cloud.mjs <local-dir> <remote-dir>
/// node bin/save-on-cloud.mjs /c/Users/pasca/Desktop/save-on-cloud "/c/Users/pasca/Mon Drive/tmp/save-on-cloud"

/*
https://github.com/ditesh/node-mbox/tree/master
*/

import path from 'path'
import fs from 'fs'
import os from 'os'
import mv from 'mv'
import fileSyncCmp from 'file-sync-cmp'
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import crypto from 'node:crypto'



let statistics = {
  nTotal: 0,
  nRemove: 0,
}

const _step = 1000

async function getArgs(usage) {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  let options = yargs
    .usage(usage)
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "src-dir": {
        description: "source directory to copy",
        requiresArg: true,
        required: true,
      },
      "dup-dir": {
        description: "directory that may contain duplicates",
        requiresArg: true,
        required: true,
      },
      "remove": {
        description: 'remove - otherwise this is only a dryrun',
        type: 'boolean'
      },
      "move": {
        description: 'move - otherwise this is only a dryrun',
        type: 'boolean'
      },
      "nameonly": {
        description: 'do not check content, but only the name',
        type: 'boolean'
      },
    })
    // .fail((msg, err, yargs) => {
    //   if (err) throw err // preserve stack
    //   console.error('You broke it!')
    //   console.error(msg)
    //   console.error('You should be doing', yargs.help())
    //   throw 'YARGS ERROR'
    // })
    .argv;

  options.forceRm = [ 'Thumbs.db', 'desktop.ini' ]
  return options
}



/// get the list of all files in rootDir, from subDir recursiveley
function rmEmptyDir(options, rootDir, subDir) {
  const thisDir = path.join(rootDir, subDir);
  fs.readdirSync(thisDir).forEach(file => {
    const absolute = path.join(thisDir, file);
    const sub = path.join(subDir, file)
    if (fs.statSync(absolute).isDirectory()) {
      rmEmptyDir(options, rootDir, sub);
    }
  });

  const items = fs.readdirSync(thisDir)
  if (items.length === 0) {
    // rm this empty directory
    console.log(`      rmdir of ${thisDir}`)
    // fs.rmSync(thisDir, { maxRetries:10, recursive:true })
    fs.rmSync(thisDir, { force:true, recursive:true })
  }
}

/// get the list of all files in rootDir, from subDir recursiveley
function walkDir(options, srcFiles, rootDir, subDir) {
  // if (subDir === '') {
  //   console.log('--- walkDir')
  // }
  // console.log(`walkdir ${subDir}`)
  const thisDir = path.join(rootDir, subDir);
  fs.readdirSync(thisDir).forEach(file => {
    // if (options.excludes.includes(file)) {
    //   return
    // }
    const absolute = path.join(thisDir, file);
    const sub = path.join(subDir, file)
    if (fs.statSync(absolute).isDirectory()) {
      walkDir(options, srcFiles, rootDir, sub);
    } else {
      srcFiles.push(sub);
      if ((srcFiles.length % _step) === 0) {
        console.log(`      ${srcFiles.length} files found`)
      }
    }
  });
}

function equalFiles(file1, file2) {
  return fileSyncCmp.equalFiles(file1, file2)
}

function getHashes(dir, options) {
  console.log(`--- getHashes of ${dir}---`)

  console.log(`    --- Get files list of ${dir}---`)
  let files = []
  walkDir(options, files, dir, '')

  console.log(`    --- Computes Hashes of ${dir}---`)
  let hashes = {}
  files.forEach((file, index) => {
    try {
      if ((index % _step) === 0) {
        console.log(`      ${index} / ${files.length}`)
      }
      const fullname = path.join(dir, file);
      let sha1sum
      if (options.nameonly) {
        sha1sum = path.basename(file)
      } else {
        const text = fs.readFileSync(fullname);
        sha1sum = crypto.createHash('sha1').update(text).digest("hex");
      }
      if (hashes[sha1sum] === undefined) {
        hashes[sha1sum] = [ ]
      }
      hashes[sha1sum].push(fullname)
    } catch (e) {
      console.log(e)
    }
  })

  return hashes
}


async function mboxParse(filename, resultName){
  console.log(`mboxParse(${filename})`)
  let mbox = fs.readFileSync(filename).toString();

  let resStream = fs.createWriteStream(resultName);


  let lastIndex = mbox.indexOf('From ', 0)
  if (lastIndex !== 0) {
    throw('ERROR: mbox does not with From ')
  }
  let prevIndex = lastIndex

  let nMessage = 0
  do {
    lastIndex = mbox.indexOf('\r\nFrom ', prevIndex + 1)
    if (lastIndex === -1) {
      lastIndex = mbox.length
    }
    const message = mbox.substring(prevIndex, lastIndex)
    const sha1sum = crypto.createHash('sha1').update(message).digest("hex");
    console.log(sha1sum)
    prevIndex = lastIndex
    nMessage ++
    resStream.write(message)

  } while (prevIndex !== mbox.length)
  resStream.end();
  console.log(`Number of messages: ${nMessage}`)
}

function main(options) {
  // const messages = mboxParse("C:\\Users\\pasca\\Desktop\\merge-mbox\\20240623-tous les messages.mbox")
  const messages = mboxParse("C:\\Users\\pasca\\Desktop\\merge-mbox\\mail-pbr.venon.mbox", "C:\\Users\\pasca\\Desktop\\merge-mbox\\mail-result.mbox")

}

// const options = await getArgs(`rm-duplicates --src-dir="C:\\Users\\pasca\\Pictures" --dup-dir="C:\tmp"`)
const options = {}
main(options);
// console.log('-------------------------------')
// console.log(statistics)
// console.log(`Removed files can be found in ${path.join(os.tmpdir(), 'rm-duplicate')}`)
// console.log('Done')
console.log('DONE')