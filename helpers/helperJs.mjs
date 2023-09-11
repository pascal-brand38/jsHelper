/// Copyright (c) Pascal Brand
/// MIT License

import { DateTime } from 'luxon'
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

  exit(-1)
}

///////////////////////////////////////////////////////////////////////////////////////////
// Extend DateTime from luxon library to deal with excel serial date
// https://stackoverflow.com/questions/34512832/best-way-to-extend-a-javascript-library 
// Extend DateTime library from luxon
// zone 'utc' is used to get real dates at noon, not bothering about timezone
DateTime.fromNowStartOfDay = () => DateTime.now({zone: 'utc'}).startOf('day') 
DateTime.fromEpochStartOfDay = (epoch) => DateTime.fromSeconds(epoch, {zone: 'utc'}).startOf('day')
DateTime.fromFormatStartOfDay = (str, format = 'd/M/y') => DateTime.fromFormat(str, format, {zone: 'utc'}).startOf('day')

// from a serial day in excel (nb of days since 01/01/1900),
// https://stackoverflow.com/questions/26792144/converting-days-since-jan-1-1900-to-todays-date
// Convert serial to seconds, minus the offset of the number of seconds between Jan-1-1900(Serial Date)
// and Jan-1-1970(UNIX Time). Which is 2208988800, this leaves us with UNIX time.
// remove 2 days as:
// - 1/1/1900 is day 1
// - according to Excel Feb 29, 1900 exists(a bug in their code they refuse to fix.)
DateTime.fromExcelSerialStartOfDay = (serial) => DateTime.fromEpochStartOfDay(serial * 60*60*24 - 2208988800 - 60*60*24 *2)

DateTime.prototype.toEpoch = function () { return this.toSeconds() }
DateTime.prototype.toExcelSerial = function () { return (this.toEpoch() + (2208988800 + 60*60*24 *2)) / (60*60*24) }

DateTime.epochNDays = (nDays)  => 60 * 60 * 24 * nDays
///////////////////////////////////////////////////////////////////////////////////////////


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
    forbiddenWords = [ 'undefined', ],     // must be a lower case list
  ) => {
    
    // check the email does not contain any forbidden words
    const allWords = (email + ' ' + subject + ' ' + body).toLowerCase()
    forbiddenWords.forEach(w => {
      if (allWords.includes(w)) {
        error(`The email contains the word ${w}: ${allWords}`)
      }
    })

    // check the attachement does not contain any forbidden word
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
  DateTime,     // extends luxon libray
  question,
  thunderbird,
  
  warning,
  error,
}
