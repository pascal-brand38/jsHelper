/// Copyright (c) Pascal Brand
/// MIT License

import { DateTime } from 'luxon'
import { exit } from 'process';

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

const date = {
  fromNowStartOfDay: () => DateTime.now().startOf('day'),
  fromEpochStartOfDay: (epoch) => DateTime.fromSeconds(epoch).startOf('day'),
  fromFormatStartOfDay: (str, format = 'd/M/y') => DateTime.fromFormat(str, format).startOf('day'),

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

export default {
  date,
  question,
  
  warning,
  error,
}
