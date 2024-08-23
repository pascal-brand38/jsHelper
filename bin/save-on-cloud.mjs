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

import path from 'path'
import fs from 'fs'
import fileSyncCmp from 'file-sync-cmp'
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';


let statistics = {
  identical: 0,
  updated: 0,
  new: 0,
}

let _dryrun = false
let _dirDated = '.save-with-dates'

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
      "dst-dir": {
        description: "dst directory to copy",
        requiresArg: true,
        required: true,
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

  options.excludes = [ 'tmp', '.tmp.drivedownload', 'desktop.ini', 'Thumbs.db', _dirDated ]

  return options
}



/// get the list of all files in rootDir, from subDir recursiveley
function walkDir(options, srcFiles, rootDir, subDir) {
  if (subDir === '') {
    console.log('--- walkDir')
  }
  console.log(`walkdir ${subDir}`)
  const thisDir = path.join(rootDir, subDir);
  fs.readdirSync(thisDir).forEach(file => {
    if (options.excludes.includes(file)) {
      return
    }
    const absolute = path.join(thisDir, file);
    const sub = path.join(subDir, file)
    if (fs.statSync(absolute).isDirectory()) {
      walkDir(options, srcFiles, rootDir, sub);
    } else {
      srcFiles.push(sub);
    }
  });
}

function equalFiles(file1, file2) {
  return fileSyncCmp.equalFiles(file1, file2)
}

function main(options) {
  let srcDir = options.srcDir
  let dstDir = options.dstDir

  let srcFiles = []
  walkDir(options, srcFiles, srcDir, '')
  // console.log(srcFiles)
  srcFiles.forEach(file => {
    const srcFile = path.join(srcDir, file);
    const dstFile = path.join(dstDir, file);

    let mustCopy = false
    let update = false
    if (fs.existsSync(dstFile)) {
      // the file already exists in the cloud
      const statDstFile = fs.statSync(dstFile)

      if (statDstFile.isDirectory()) {
        // oops should never appear: a file corresponds to a directory on the cloud
        throw (`THIS IS A DIRECTORY???: ${dstFile}  -  STOP`)
      } else {
        // file exists on the cloud. Are there the same?
        // console.log('FILE EXISTS: ', dstFile)
        if (equalFiles(srcFile, dstFile)) {
          // same files ==> nothing to do
          // console.log(`Same files: ${srcFile} and ${dstFile}`)
          statistics.identical++
        } else {
          mustCopy = true
          update = true
          statistics.updated++
        }
      }
    } else {
      // an error, so the file does not exist on the cloud
      statistics.new ++
      mustCopy = true
      const dirname = path.dirname(dstFile)
      if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
      }
    }

    if (mustCopy) {
      if (update) {
        const subdir = path.dirname(file)
        const stat = fs.statSync(dstFile)
        const fileParse = path.parse(dstFile)
        const dstDatedFile = path.join(dstDir, _dirDated, subdir, fileParse.name) + '-' + stat.mtime.toISOString().replaceAll(':', '-') + fileParse.ext
        // console.log(dstDatedFile)
        // throw('STOP')
        const dirname = path.dirname(dstDatedFile)
        if (!fs.existsSync(dirname)) {
          fs.mkdirSync(dirname, { recursive: true });
        }
        fs.copyFileSync(dstFile, dstDatedFile)
      }
      fs.copyFileSync(srcFile, dstFile)
      console.log(`${update ? 'Update' : 'Copy  '} ${path.basename(srcFile)}`)
    }
  })
}

const options = await getArgs(`save-on-cloud --src-dir=/c/Users/pasca/Desktop/save-on-cloud --dst-dir="/c/Users/pasca/Mon Drive/tmp/save-on-cloud"`)
main(options);
console.log('-------------------------------')
console.log(statistics)
console.log('Done')
