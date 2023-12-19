#!/usr/bin/env node

/// Copyright (c) Pascal Brand
/// MIT License
///
/// Save files on the cloud
/// - if it does not exist: mv
/// - if it exists and not the same: copy with -v000 the previous version, and move
///
/// node bin/save-on-cloud.mjs <local-dir> <remote-dir>
/// node bin/save-on-cloud.mjs /c/Users/pasca/Desktop/save-on-cloud "/c/Users/pasca/Mon Drive/tmp/save-on-cloud"

import path from 'path'
import fs from 'fs'
import fileSyncCmp from 'file-sync-cmp'

let statistics = {
  identical: 0,
  updated: 0,
  new: 0,
}

let _dryrun = false
let _dirDated = 'save-with-dates'

/// get the list of all files in rootDir, from subDir recursiveley
function walkDir(srcFiles, rootDir, subDir) {
  const thisDir = path.join(rootDir, subDir);
  fs.readdirSync(thisDir).forEach(file => {
    const absolute = path.join(thisDir, file);
    const sub = path.join(subDir, file)
    if (fs.statSync(absolute).isDirectory()) {
      walkDir(srcFiles, rootDir, sub);
    } else {
      srcFiles.push(sub);
    }
  });
}


function main() {
  const argv = process.argv
  // console.log(argv)

  let today = new Date()
  let dateExt = '' + today.getFullYear() + ("0" + (today.getMonth() + 1)).slice(-2) + ("0" + today.getDate()).slice(-2)

  // Reading compta and agenda data
  let srcDir = argv[2]
  let dstDir = argv[3]

  let srcFiles = []
  walkDir(srcFiles, srcDir, '')
  // console.log(srcFiles)
  srcFiles.forEach(file => {
    const srcFile = path.join(srcDir, file);
    const dstFile = path.join(dstDir, file);

    if (path.basename(srcFile) === 'desktop.ini') {
      return
    }

    let mustCopy = false
    if (fs.existsSync(dstFile)) {
      // the file already exists in the cloud
      const statDstFile = fs.statSync(dstFile)

      if (statDstFile.isDirectory()) {
        // oops should never appear: a file corresponds to a directory on the cloud
        throw (`THIS IS A DIRECTORY???: ${dstFile}  -  STOP`)
      } else {
        // file exists on the cloud. Are there the same?
        // console.log('FILE EXISTS: ', dstFile)
        if (fileSyncCmp.equalFiles(srcFile, dstFile)) {
          // same files ==> nothing to do
          // console.log(`Same files: ${srcFile} and ${dstFile}`)
          statistics.identical++
        } else {
          mustCopy = true
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
      let fileExt = dstFile.split('.').pop();
      const dstDatedFile = path.join(dstDir, _dirDated, file) + '.' + dateExt + '.' + fileExt

      const dirname = path.dirname(dstDatedFile)
      if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
      }

      if (_dryrun) {
        console.log(`fs.copyFileSync(${srcFile}, ${dstFile})`)
        console.log(`fs.copyFileSync(${srcFile}, ${dstDatedFile})`)
      } else {
        fs.copyFileSync(srcFile, dstFile)
        fs.copyFileSync(srcFile, dstDatedFile)
      }
      console.log(`Copy ${path.basename(srcFile)}`)
    }
  })
}

if (process.argv.length !== 4) {
  console.log(`save-on-cloud /c/Users/pasca/Desktop/save-on-cloud "/c/Users/pasca/Mon Drive/tmp/save-on-cloud"`)
} else {
  main();
  console.log('-------------------------------')
  console.log(statistics)
  console.log('Done')
}
