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
rm-duplicates --src-dir="F:\90 - SAVE\account.google.com\pascal.brand38\drive.google.com" --dup-dir="F:\99 - TO BE REMOVED\pascal.brand38\20210628-drive.google.com"
rm-duplicates --nameonly --src-dir="C:\Users\pasca\Pictures" --dup-dir="C:\tmp"

*/

import path from 'path'
import fs from 'fs'
import os from 'os'
import mv from 'mv'
import fileSyncCmp from 'file-sync-cmp'
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import helperJs from '../helpers/helperJs.mjs'

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
        required: false,
      },
      "self": {
        description: "check duplicates in source directory",
        type: 'boolean',
        required: false,
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
    }).check((argv) => {
      if ((!argv['dup-dir']) && (!argv['self'])) {
        throw new Error('You must supply either --dup-dir or --self');
      } else if ((argv['dup-dir']) && (argv['self'])) {
        throw new Error('You must supply either --dup-dir or --self, but not both');
      } else {
        return true;
      }
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


function equalFiles(file1, file2) {
  return fileSyncCmp.equalFiles(file1, file2)
}

function getHashes(dir, options) {
  console.log(`--- getHashes of ${dir} ---`)

  console.log(`    --- Get files list of ${dir} ---`)
  let files = helperJs.utils.walkDir(dir, { stepVerbose: 1000, })

  console.log(`    --- Computes Hashes of ${dir} ---`)
  let hashes = helperJs.sha1.initSha1List()
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
        sha1sum = helperJs.sha1.getSha1(fullname)
      }
      helperJs.sha1.updateSha1List(hashes, sha1sum, fullname, false)
    } catch (e) {
      console.log(e)
    }
  })

  return hashes
}

function removeDup(srcHashes, options) {
  let dupHashes = getHashes(options.dupDir, options)

  console.log(`--- Move duplicates in ${path.join(os.tmpdir(), 'rm-duplicate')} ---`)
  Object.keys(dupHashes).forEach((key, index) => {
    if ((index % _step) === 0) {
      console.log(`      ${index} / ${Object.keys(dupHashes).length} unique hashes`)
    }

    const srcs = srcHashes[key]
    const dups = dupHashes[key]
    statistics.nTotal = statistics.nTotal + dups.length

    // check this may be the same
    dups.forEach(dup => {
      let candidate = undefined
      let mustRemove = options.forceRm.includes(path.basename(dup))
      if (mustRemove) {
        candidate = dup
      } else if (srcs) {
        if (options.nameonly) {
          mustRemove = true
          candidate = srcs[0]
        } else {
          mustRemove = srcs.some(src => {
            candidate = src
            return equalFiles(src, dup)
          })
        }
      }

      if (mustRemove) {
        statistics.nRemove++
        if (options.move) {
          console.log(`MOVE         ${path.basename(dup)} in ${path.dirname(dup)}`)
          console.log(`  same as    ${path.basename(candidate)} in ${path.dirname(candidate)}`)
          const newDirname = path.join(os.tmpdir(), 'rm-duplicate', path.dirname(dup).replace(options.dupDir, '.'))
          if (!fs.existsSync(newDirname)) {
            fs.mkdirSync(newDirname, { recursive: true });
          }
          // fs.renameSync(dup, path.join(newDirname, path.basename(dup)))
          mv(dup, path.join(newDirname, path.basename(dup)), () => {})
        } else if (options.remove) {
          console.log(`REMOVE       ${path.basename(dup)} in ${path.dirname(dup)}`)
          console.log(`  same as    ${path.basename(candidate)} in ${path.dirname(candidate)}`)
          fs.unlinkSync(dup)
        } else {
          console.log(`DRYRUN       ${path.basename(dup)} in ${path.dirname(dup)}`)
          console.log(`  same as    ${path.basename(candidate)} in ${path.dirname(candidate)}`)
        }
      }
    })
  })

  if (options.remove) {
    console.log(`--- Remove empty dirs of ${options.dupDir} ---`)
    rmEmptyDir(options, options.dupDir, '')
  }
}

async function removeSelf(srcHashes, options) {
  const keys = Object.keys(srcHashes)
  for (let index=0; index <= keys.length; index++) {
    const key = keys[index]
    if (key === undefined) {
      break
    }

    if ((index % _step) === 0) {
      console.log(`      ${index} / ${Object.keys(srcHashes).length} unique hashes`)
    }
    statistics.nTotal = statistics.nTotal + srcHashes[key].length

    if ((options.self) && (srcHashes[key].length >= 2)) {
      console.log()
      console.log('Which ones to keep:')
      console.log('0- All')
      srcHashes[key].forEach((filename, index) => console.log(`${index+1}- ${filename}`))

      let which = -1
      while ((which<0) || (which>srcHashes[key].length)) {
        which = await helperJs.question.question('Which one to keep?  ')
      }
      which = parseInt(which)
      if (which === 0) {
        console.log('Keep all')
      } else {
        for (let i=0; i<srcHashes[key].length; i++) {
          if (i+1 !== which) {
            statistics.nRemove++

            const dup = srcHashes[key][i]
            if (options.move) {
              const newDirname = path.join(os.tmpdir(), 'rm-duplicate', path.dirname(dup).replace(options.srcDir, '.'))
              if (!fs.existsSync(newDirname)) {
                fs.mkdirSync(newDirname, { recursive: true });
              }
              // fs.renameSync(dup, path.join(newDirname, path.basename(dup)))
              mv(dup, path.join(newDirname, path.basename(dup)), () => {})
            } else if (options.remove) {
              fs.unlinkSync(dup)
            } else {
              console.log(`DRYRUN REMOVE ${dup}`)
            }
          }
        }
      }
    }

  }
}

async function main(options) {
  let srcHashes = getHashes(options.srcDir, options)
  if (options.self) {
    await removeSelf(srcHashes, options)
  } else {
    removeDup(srcHashes, options)
  }
}

const options = await getArgs(`rm-duplicates --src-dir="C:\\Users\\pasca\\Pictures" --dup-dir="C:\\tmp"`)
await main(options);
console.log('-------------------------------')
console.log(statistics)
if (options.move) {
  console.log(`Removed files can be found in ${path.join(os.tmpdir(), 'rm-duplicate')}`)
}
console.log('Done')
