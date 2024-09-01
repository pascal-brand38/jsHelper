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

  const isCalls = (json['calls'] !== undefined)
  const isSms = (json['smses'] !== undefined)

  if (!isCalls && !isSms) {
    throw(`Neither calls nor sms backup`)
  }
  if (isCalls && isSms) {
    throw(`Calls AND sms backup`)
  }

  if (isSms) {
    console.log(`-- #sms: ${json['smses']['sms'].length} `)
    console.log(`-- #mms: ${json['smses']['mms'].length} `)
    // fs.writeFileSync('res.json', JSON.stringify(json, null, "  "))
  } else {
    console.log(`-- #calls: ${json['calls']['call'].length} `)
  }

  return { json, isSms }
}


//  html encode, from https://stackoverflow.com/questions/18749591/encode-html-entities-in-javascript
const encodedStr = rawStr => rawStr.replace(/[\u00A0-\u9999<>\&\n\r]/g, i => '&#'+i.charCodeAt(0)+';')
//const encodedStr = rawStr => rawStr.replace(/[\&\n\r]/g, i => '&#'+i.charCodeAt(0)+';')


const options = await getArgs(`sms-backup-merge --last-xml=<> --all-xml=<> --result-xml=<>`)

const { json: jsonNew, isSms: isSmsNew } = getJson(options.lastXml)
const { json: jsonOld, isSms: isSmsOld } = getJson(options.allXml)
if (isSmsNew !== isSmsOld) {
  throw('Trying to merge sms and calls')
}

if (isSmsNew) {
  console.log('Merge')
  merge(jsonNew['smses']['sms'], jsonOld['smses']['sms'])
  console.log(`-- #sms: ${jsonNew['smses']['sms'].length} `)

  merge(jsonNew['smses']['mms'], jsonOld['smses']['mms'])
  console.log(`-- #mms: ${jsonNew['smses']['mms'].length} `)

  jsonNew['smses']['sms'].forEach(sms => {
    sms['_attributes']['body'] = encodedStr(sms['_attributes']['body'])
  })

  jsonNew['smses']['mms'].forEach(mms => {
    mms['parts']['part'].forEach(part => {
      part['_attributes']['text'] = encodedStr(part['_attributes']['text'])
      part['_attributes']['cid'] = encodedStr(part['_attributes']['cid'])
    })
  })
} else {
  console.log('Merge calls')
  merge(jsonNew['calls']['call'], jsonOld['calls']['call'])
  console.log(`-- #calls: ${jsonNew['calls']['call'].length} `)
}
// fs.writeFileSync('C:\\Users\\pasca\\Desktop\\save\\res.json', JSON.stringify(jsonNew, null, "  "))

// jsonNew['_comment'].push('\nCreated using sms-backup-merge from\n\t\t\thttps://github.com/pascal-brand38/jsHelper\n')
console.log('Convert to xml')
let resxml = convert.js2xml(jsonNew, {compact: true, ignoreComment: false, spaces: 2})

console.log(`Write ${options.resultXml}`)
fs.writeFileSync(options.resultXml, resxml)

console.log(`\nTo view this file in a more readable format, visit https://synctech.com.au/view-backup/\n`)
console.log('DONE')
