/// Copyright (c) Pascal Brand
/// MIT License

import { DateTime } from 'luxon'


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

  epochNDays: nDays => 60 * 60 * 24 * nDays,
}

export default {
  date,
}
