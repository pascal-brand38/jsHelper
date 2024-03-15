/// Copyright (c) Pascal Brand
/// MIT License

import { exit } from 'process';
import child_process from 'child_process'
import pdfjsdist from '../extend/pdfjs-dist.mjs'

// https://nodejs.org/api/readline.html
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';
const rl = readline.createInterface({ input, output });

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


export default {
  question,
  thunderbird,

  warning,
  error,
}
