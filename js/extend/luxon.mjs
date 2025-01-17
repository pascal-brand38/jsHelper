// Copyright (c) Pascal Brand
// MIT License
//
// Extend DateTime from luxon library to deal with excel serial date
// https://stackoverflow.com/questions/34512832/best-way-to-extend-a-javascript-library
//
// In TS, extension can be shown as:
// https://www.typescriptlang.org/docs/handbook/declaration-merging.html#module-augmentation
import { DateTime, Info } from 'luxon';
DateTime.fromNowStartOfDay = () => DateTime.now().setZone('utc').startOf('day');
DateTime.fromEpochStartOfDay = (epoch) => DateTime.fromSeconds(epoch, { zone: 'utc' }).startOf('day');
DateTime.fromFormatStartOfDay = (str, format = 'd/M/y') => DateTime.fromFormat(str, format, { zone: 'utc' }).startOf('day');
// from a serial day in excel (nb of days since 01/01/1900),
// https://stackoverflow.com/questions/26792144/converting-days-since-jan-1-1900-to-todays-date
// Convert serial to seconds, minus the offset of the number of seconds between Jan-1-1900(Serial Date)
// and Jan-1-1970(UNIX Time). Which is 2208988800, this leaves us with UNIX time.
// remove 2 days as:
// - 1/1/1900 is day 1
// - according to Excel Feb 29, 1900 exists(a bug in their code they refuse to fix.)
DateTime.fromExcelSerialStartOfDay = (serial) => DateTime.fromEpochStartOfDay(serial * 60 * 60 * 24 - 2208988800 - 60 * 60 * 24 * 2);
DateTime.prototype.toEpoch = function () { return this.toSeconds(); };
DateTime.prototype.toExcelSerial = function () { return (this.toEpoch() + (2208988800 + 60 * 60 * 24 * 2)) / (60 * 60 * 24); };
DateTime.prototype.weekdayStr = function (length = 'long', opts = { locale: 'fr' }) {
    const weekdays = Info.weekdays(length, opts); // arrays of day strings, [0] being lundi
    return weekdays[this.weekday - 1]; // this.weekday from 1 to 7, 1 is Monday and 7 is Sunday
};
DateTime.prototype.epochNDays = (nDays) => 60 * 60 * 24 * nDays;
