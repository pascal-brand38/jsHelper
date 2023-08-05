/// Copyright (c) Pascal Brand
/// MIT License

import { DateTime } from 'luxon'


const date = {
  // now: () => { let d=DateTime.now(); d.c.hour=0; return d; },
  // epoch: (date) => date.ts,
  // fromEpoch: (epoch) => { let d=DateTime.fromSeconds(epoch); d.c.hour=0; return d; },
  // toFormat: (date, format='d/M/y') => date.DateTime.toFormat(format),
  // fromFormat: (str, format='d/M/y') => { let d=DateTime.fromFormat(str, format); d.c.hour=0; return d; },

  now: () => DateTime.now().startOf('day'),
  epoch: (date) => date.toSeconds(),
  fromEpoch: (epoch) => DateTime.fromSeconds(epoch).startOf('day'),
  toFormat: (date, format='d/M/y') => date.toFormat(format),
  fromFormat: (str, format='d/M/y') => DateTime.fromFormat(str, format).startOf('day'),
}

export default {
  date,
}
