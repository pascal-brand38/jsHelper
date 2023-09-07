/// Copyright (c) Pascal Brand
/// MIT License

import { DateTime } from 'luxon'
import { exit } from 'process';
import child_process from 'child_process'

// https://nodejs.org/api/readline.html
import * as readline from 'readline';
import { stdin as input, stdout as output } from 'process';
import helperPdf from './helperPdf.mjs';
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

const date = {
  fromNowStartOfDay: () => DateTime.now({zone: 'utc'}).startOf('day'),
  fromEpochStartOfDay: (epoch) => DateTime.fromSeconds(epoch, {zone: 'utc'}).startOf('day'),
  fromFormatStartOfDay: (str, format = 'd/M/y') => DateTime.fromFormat(str, format, {zone: 'utc'}).startOf('day'),

  // from a serial day in excel (nb of days since 01/01/1900),
  // https://stackoverflow.com/questions/26792144/converting-days-since-jan-1-1900-to-todays-date
  fromExcelSerialStartOfDay: (serial) =>
    // Convert serial to seconds, minus the offset of the number of seconds between Jan-1-1900(Serial Date)
    // and Jan-1-1970(UNIX Time). Which is 2208988800, this leaves us with UNIX time.
    // remove 2 days as:
    // - 1/1/1900 is day 1
    // - according to Excel Feb 29, 1900 exists(a bug in their code they refuse to fix.)
    date.fromEpochStartOfDay(serial * 60*60*24 - 2208988800 - 60*60*24 *2),

  toEpoch: (date) => date.toSeconds(),
  toFormat: (date, format = 'dd/MM/yyyy') => date.toFormat(format),
  toExcelSerial: (d) => (date.toEpoch(d) + (2208988800 + 60*60*24 *2)) / (60*60*24) ,

  epochNDays: nDays => 60 * 60 * 24 * nDays,
}

const question = {
  question: async (text) =>  await new Promise(resolve => {
    rl.question(`${text}`, resolve)
  })
}

const  thunderbird = {
  compose: async (
    email, 
    subject,
    body, 
    attachment = null, 
    exe = '"C:\\Program Files\\Mozilla Thunderbird\\thunderbird.exe"',
    forbiddenWords = [ 'undefined' ]) => {
    
    // check the email does not contain any fordden words
    const allWords = email + ' ' + subject + ' ' + body
    forbiddenWords.forEach(w => {
      if (allWords.includes(w)) {
        error(`The email contains the word ${w}: ${allWords}`)
      }
    })

    // TODO: check the PDF does not include forbiddenWords
    if (attachment != null) {
      // const doc = helperPdf.pdfjs.load(attachment)
      // console.log(doc)
      // const text = await helperPdf.pdfjs.pdfjsGetText(doc)

      // helperPdf.pdfjs.load(attachment)
      //   .then(doc => helperPdf.pdfjs.pdfjsGetText(doc))
      //   .then(text => console.log(text))

      // const doc = await helperPdf.pdfjs.load(attachment)
      // const text = await helperPdf.pdfjs.pdfjsGetText(doc)
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
  date,
  question,
  thunderbird,
  
  warning,
  error,
}
