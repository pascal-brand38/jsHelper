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

  // Reading compta and agenda data
  let srcDir = argv[2]
  let dstDir = argv[3]

  let srcFiles = []
  walkDir(srcFiles, srcDir, '')
  // console.log(srcFiles)
  srcFiles.forEach(file => {
    const srcFile = path.join(srcDir, file);
    const dstFile = path.join(dstDir, file);

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
          // file version has been modified ==>
          // - rename the one on the cloud, using a version number
          // - mv the one locally on the cloud
          // console.log(`Update file: ${dstFile}`)
          for (let step = 0; step < 1000; step++) {
            let zerofilled = ('000' + step).slice(-3);
            let dstFileRenamed = dstFile + '-v' + zerofilled
            if (!fs.existsSync(dstFileRenamed)) {
              fs.renameSync(dstFile, dstFileRenamed)
              fs.renameSync(srcFile, dstFile)
              statistics.updated++
              console.log(`Update ${path.basename(srcFile)}`)
              break
            }
          }
        }
      }
    } else {
      // the file does not exist
      // an error, so the file does not exist on the cloud
      // mv it now
      const dirname = path.dirname(dstFile)
      if (!fs.existsSync(dirname)) {
        fs.mkdirSync(dirname, { recursive: true });
      }
      fs.renameSync(srcFile, dstFile)
      statistics.new ++
      console.log(`New ${path.basename(srcFile)}`)
    }
  })
}

main();
console.log('-------------------------------')
console.log(statistics)
console.log('Done')
