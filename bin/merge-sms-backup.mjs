#!/usr/bin/env node --max-old-space-size=1048576

// Copyright (c) Pascal Brand
// MIT License
//
// Merge 2 mbox, removing duplicate emails
// To be used to merge with google takeout

import fs from 'fs'
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import convert from 'xml-js'


async function getArgs(usage) {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  let options = yargs
    .usage(usage)
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "last-xml": {
        description: "Last xml file from SMS Backup & Restore application",
        requiresArg: true,
        required: true,
      },
      "all-xml": {
        description: "Previous xml backup. Can be the result of a merge",
        requiresArg: true,
        required: true,
      },
      "result-xml": {
        description: "Result of the merge",
        requiresArg: true,
        required: true,
      },
    })
    // .fail((msg, err, yargs) => {
    //   if (err) throw err // preserve stack
    //   console.error('You broke it!')
    //   console.error(msg)
    //   console.error('You should be doing', yargs.help())
    //   throw 'YARGS ERROR'
    // })
    .argv;

  return options
}


// adapt from https://stackoverflow.com/questions/1584370/how-to-merge-two-arrays-in-javascript-and-de-duplicate-items
// merge 2 arrays, in place in arrayDst, and removes the duplicates
function merge(arrayDst, arrayToAdd) {
  const equal = (item1, item2) => (item1["_attributes"]["date"] === item2["_attributes"]["date"])
  // add all items from arrayToAdd to copy to arrayDst if they're not already present
  arrayToAdd.forEach((addItem) => (arrayDst.some((dstItem) => equal(addItem, dstItem)) ? null : arrayDst.push(addItem)))
}

function getJson(filename) {
  console.log(`Reading file ${filename}`)
  var xml = fs.readFileSync(filename)
  console.log('-- Convert to json')
  const json = convert.xml2js(xml,  {compact: true})
  console.log(`-- #sms: ${json['smses']['sms'].length} `)
  console.log(`-- #mms: ${json['smses']['mms'].length} `)
  return json
}




const options = await getArgs(`merge-sms-backup --last-xml=<> --all-xml=<> --result-xml=<>`)

const jsonNew = getJson(options.lastXml)
const jsonOld = getJson(options.allXml)

console.log('Merge sms')
merge(jsonNew['smses']['sms'], jsonOld['smses']['sms'])
console.log(`-- #sms: ${jsonNew['smses']['sms'].length} `)

console.log('Merge mms')
merge(jsonNew['smses']['mms'], jsonOld['smses']['mms'])
console.log(`-- #mms: ${jsonNew['smses']['mms'].length} `)

jsonNew['_comment'].push('Merge using merge-sms-backup from https://github.com/pascal-brand38/jsHelper')
console.log('Convert to xml')
// fs.writeFileSync('C:\\Users\\pasca\\Desktop\\save\\res.json', json)
const resxml = convert.js2xml(jsonNew, {compact: true, ignoreComment: false, spaces: 4})
console.log(`Write ${options.resultXml}`)
fs.writeFileSync(options.resultXml, resxml)

console.log(`\nTo view this file in a more readable format, visit https://synctech.com.au/view-backup/\n`)
console.log('DONE')
