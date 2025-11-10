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
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import fileSyncCmp from 'file-sync-cmp'
import helperJs from '../js/helpers/helperJs.mjs'

let statistics = {
  identical: 0,
  updated: 0,
  new: 0,
  removed: 0,
}

let _dryrun = false
let _dirDated = '.save-with-dates'

function getArgs(usage) {
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
      "remove-moved-files": {
        description: 'remove file of the dstdir, which are not in srcdir, but have a copy somewhere else in srcdir',
        type: 'boolean'
      },
      "skip-list": {
        description: "files / dir to skip, separated by comma",
        requiresArg: true,
        required: false,
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

  options.walkDirOptions = {
    excludes: [ 'tmp', '.tmp.drivedownload', 'desktop.ini', 'Thumbs.db', _dirDated ],
    stepVerbose: 1,
    antiSlashR: true,
  }
  return options
}


function equalFiles(file1, file2) {
  return fileSyncCmp.equalFiles(file1, file2)
}


function removeMovedFiles(options, sha1List) {
  let srcDir = options.srcDir
  let dstDir = options.dstDir

  console.log(`--- Remove moved files step`)
  console.log(`------ Scan dir ${dstDir}`)
  let dstFiles = helperJs.utils.walkDir(dstDir, options.walkDirOptions)

  console.log(`------ Remove moved files from ${dstDir}`)
  // console.log(dstFiles)
  dstFiles.forEach(file => {
    const srcFile = path.join(srcDir, file)
    const dstFile = path.join(dstDir, file)

    if (!fs.existsSync(srcFile)) {
      // this file in dst dir DOES NOT exist any more in source
      // if it exits somewhere else in the srcDir, then that means it has been
      // moved. So we can remove it from the dstDir
      const correspondingSrcFile = helperJs.sha1.isInSha1List(sha1List, dstFile)
      if (correspondingSrcFile) {
        console.log(`remove ${dstFile}`)
        console.log(`  same as ${correspondingSrcFile}`)
        fs.unlinkSync(dstFile)
        statistics.removed ++
      }
    }
  })
}

function main(options) {
  let srcDir = options.srcDir
  let dstDir = options.dstDir
  let skipList = (options.skipList ? options.skipList.split(',') : [])

  console.log(`--- Copy files step`)

  let sha1List = helperJs.sha1.initSha1List()

  console.log(`------ Scan dir ${srcDir}`)
  let srcFiles = helperJs.utils.walkDir(srcDir, options.walkDirOptions)
  // console.log(srcFiles)

  console.log(`------ Save non-existing files`)
  srcFiles.forEach((file, index) => {
    const lenWhite = 10
    process.stdout.write(`${" ".repeat(lenWhite)}\r`)
    process.stdout.write(`--- ${index}\r`)

    const srcFile = path.join(srcDir, file);
    const dstFile = path.join(dstDir, file);

    const skip = skipList.some(s => s === file)

    let mustCopy = false
    let update = false
    if (!skip) {
      sha1List = helperJs.sha1.updateSha1List(sha1List, helperJs.sha1.getSha1(srcFile), srcFile)
    }
    if (!skip && fs.existsSync(dstFile)) {
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
      // file to copy only
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

  if (options.removeMovedFiles) {
    removeMovedFiles(options, sha1List)
  }
}

const options = getArgs(`save-on-cloud --src-dir=/c/Users/pasca/Desktop/save-on-cloud --dst-dir="/c/Users/pasca/Mon Drive/tmp/save-on-cloud"`)
main(options);
console.log('-------------------------------')
console.log(statistics)
console.log('Done')
