/// Copyright (c) Pascal Brand
/// MIT License

import fs from 'fs'
import path from 'path'
import child_process from 'child_process'
import pdfjsdist from '../extend/pdfjs-dist.mjs'
import crypto from 'node:crypto'
import fileSyncCmp from 'file-sync-cmp'

// https://nodejs.org/api/readline.html
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';

function warning(s) {
  console.log('WARNING');
  console.log('WARNING  ', s);
  console.log('WARNING');
}

function error(s) {
  console.log('***');
  console.log('***  ERREUR');
  console.log('*** ', s);
  console.log('***');

  throw('ERROR')    // throw so that when called from excel, it does not kill the window
                    // TODO: exit, without throw, but without killing the window
}

const question = {
  question: async (text) =>  await new Promise(resolve => {
    const rl = readline.createInterface({ input, output })
    rl.question(`${text}`, resolve)
  })
}

const thunderbird = {
  compose: async (
    email,
    subject,
    body,
    attachment = null,
    exe = '"C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe"',
    forbiddenWords = [ 'undefined', 'infinity', ' nan€', ' nan ', ],     // must be a lower case list
  ) => {

    // check the email does not contain any forbidden words
    const allWords = (email + ' ' + subject + ' ' + body).toLowerCase()
    forbiddenWords.forEach(w => {
      if (allWords.includes(w)) {
        error(`The email contains the word ${w}: ${allWords}`)
      }
    })

    // check the pdf attachement does not contain any forbidden words
    if (attachment != null) {
      if (attachment.endsWith('.pdf')) {    // only for pdf
        const doc = await pdfjsdist.load(attachment)
        const texts = await doc.getText()
        const str = texts.join(' ').toLowerCase()
        forbiddenWords.forEach(w => {
          if (str.includes(w)) {
            error(`The pdf ${attachment} contains the word ${w}`)
          }
        })
      }
    }

    // http://kb.mozillazine.org/Command_line_arguments_-_Thunderbird
    const to = `to='${email}'`
    subject = `subject=${encodeURIComponent(subject)}`
    body = `body=${encodeURIComponent(body)}`

    let cmd
    if (attachment != null) {
      attachment = `attachment=${attachment.replace(/\\/g, '/')}`
      cmd = `${exe} -compose "${to},${subject},${body},${attachment}"`
    } else {
      cmd = `${exe} -compose "${to},${subject},${body}"`
    }
    console.log(cmd)
    child_process.exec(cmd)
  },
}

/// get the list of all files in rootDir, from subDir recursiveley
function _walkDir(rootDir, options, files, subDir) {
  const thisDir = path.join(rootDir, subDir);
  fs.readdirSync(thisDir).forEach(file => {
    if (options.excludes.includes(file)) {
      return
    }
    const absolute = path.join(thisDir, file);
    const sub = path.join(subDir, file)
    if (fs.statSync(absolute).isDirectory()) {
      _walkDir(rootDir, options, files, sub);
    } else {
      files.push(sub);
      if ((options.stepVerbose > 0) && ((files.length % options.stepVerbose) === 0)) {
        console.log(`      ${files.length} files found`)
      }
    }
  });

  if ((subDir === '.') && (options.stepVerbose > 0)) {
    console.log(`      ${files.length} files found`)
  }

}

function _createOptions(options, defaultOptions) {
  let currentOptions = {}
  if (options === undefined) {
    currentOptions = defaultOptions
  } else {
    Object.keys(defaultOptions).forEach(o => {
      currentOptions[o] = (options[o] === undefined) ? defaultOptions[o] : options[o]
    })
  }
  return currentOptions
}

function walkDir(rootDir, options) {
  // create options
  const defaultOptions = {
    excludes: [],       // list of files / directories to exclude from the list
    stepVerbose: -1,    // no verbose
  }
  const currentOptions = _createOptions(options, defaultOptions)

  let files = []
  _walkDir(rootDir, currentOptions, files, '.')
  return files
}

const utils = {
  getImmediateSubdirs: (dir) => {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name);
  },
  error,
  warning,
  sleep: (seconds) => setInterval(() => {}, seconds),
  walkDir,
}

const sha1 = {
  getSha1: (file) => {
    let fp = fs.openSync(file, 'r');
    let chunkSize = 1 * 1024*1024
    let chunkBuffer = Buffer.alloc(chunkSize);
    let bytesRead = 0;
    let offset = 0
    let sha1Struct = crypto.createHash('sha1')

    while(bytesRead = fs.readSync(fp, chunkBuffer, 0, chunkSize, offset)) {
      const data = chunkBuffer.subarray(0, bytesRead)
      sha1Struct.update(data)
      offset += bytesRead
    }

    fs.closeSync(fp)
    return sha1Struct.digest("hex");
  },

  initSha1List: () => { return {} },

  updateSha1List: (sha1List, sha1sum, file) => {
    if (sha1List[sha1sum] === undefined) {
      sha1List[sha1sum] = [ ]
    } else {
      // check files are the same
      if (!fileSyncCmp.equalFiles(file, sha1List[sha1sum][0])) {
        throw(`Different files, but same sha1: ${file} vs ${sha1List[sha1sum][0]}`)
      }
    }
    sha1List[sha1sum].push(file)
    return sha1List
  },

  isInSha1List: (sha1List, file) => {
    const sha1sum = sha1.getSha1(file)
    if (sha1List[sha1sum] === undefined) {
      return undefined
    } else {
      if (!fileSyncCmp.equalFiles(file, sha1List[sha1sum][0])) {
        throw(`Different files, but same sha1: ${file} vs ${sha1List[sha1sum][0]}`)
      }
      return sha1List[sha1sum][0]
    }
  },
}

export default {
  question,
  thunderbird,
  utils,
  sha1,

  warning,
  error,
}
