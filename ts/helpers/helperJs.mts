/// Copyright (c) Pascal Brand
/// MIT License

import * as fs from 'fs'
import * as path from 'path'
import * as child_process from 'child_process'

// @ts-ignore
import pdfjsdist from '../../extend/pdfjs-dist.mjs'

import sha1 from './helperJs/sha1.mjs'

// https://nodejs.org/api/readline.html
// https://stackoverflow.com/questions/74903152/running-node-js-readline-functions
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

function warning(s: string) {
  console.log('WARNING');
  console.log('WARNING  ', s);
  console.log('WARNING');
}

function error(s: string) {
  console.log('***');
  console.log('***  ERREUR');
  console.log('*** ', s);
  console.log('***');

  throw('ERROR')    // throw so that when called from excel, it does not kill the window
                    // TODO: exit, without throw, but without killing the window
}

interface walkDirOptionsType {
  stepVerbose: number
  excludes: string[]
}

const question = {
  // question: async (text) =>  await new Promise(resolve => {
  //   const rl = readline.createInterface({ input, output })
  //   rl.question(`${text}`, resolve)
  // })
  question: async (text: string) => {
    const rl = readline.createInterface({ input, output })
    const answer = await rl.question(`${text}`)
    rl.close()
    return answer
  }
}

const thunderbird = {
  compose: async (
    email: string,
    subject: string,
    body: string,
    attachment: string|null = null,
    exe: string = '"C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe"',
    forbiddenWords: string[] = [ 'undefined', 'infinity', ' nan€', ' nan ', ],     // must be a lower case list
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
function _walkDir(rootDir: string, options: walkDirOptionsType, files: string[], subDir: string) {
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

function _createOptions(options: any, defaultOptions: any) {
  let currentOptions: any = {}
  if (options === undefined) {
    currentOptions = defaultOptions
  } else {
    Object.keys(defaultOptions).forEach(o => {
      currentOptions[o] = (options[o] === undefined) ? defaultOptions[o] : options[o]
    })
  }
  return currentOptions
}

function walkDir(rootDir: any, options: any) {
  // create options
  const defaultOptions = {
    excludes: [],       // list of files / directories to exclude from the list
    stepVerbose: -1,    // no verbose
  }
  const currentOptions = _createOptions(options, defaultOptions)

  let files: any[] = []
  _walkDir(rootDir, currentOptions, files, '.')
  return files
}

const utils = {
  getImmediateSubdirs: (dir: string) => {
    return fs.readdirSync(dir, { withFileTypes: true })
      .filter((item) => item.isDirectory())
      .map((item) => item.name);
  },
  error,
  warning,
  sleep: async (s: number) => new Promise(r => setTimeout(r, s * 1000)),
  walkDir,
  beautifulSize(s: number) {
    if (s < 1024) {
      return `${s.toFixed(2)}Bytes`
    } else if (s < 1024*1024) {
      return `${(s/1024).toFixed(2)}KB`
    } else if (s < 1024*1024*1024) {
      return `${(s/(1024*1024)).toFixed(2)}MB`
    } else {
      return `${(s/(1024*1024*1024)).toFixed(2)}GB`
    }
  },
  capitalizeFirstLetter(str: string) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
}


export default {
  question,
  thunderbird,
  utils,
  sha1: {
    getSha1: sha1.getSha1,
    initSha1List: sha1.initSha1List,
    updateSha1List: sha1.updateSha1List,
    isInSha1List: sha1.isInSha1List,
  },

  info: (text: string) => console.log('\x1b[34m' + text + '\x1b[0m'),           // blue
  logError: (text: string) => console.log('\x1b[31m' + text + '\x1b[0m'),       // red

  warning,
  error,
}
