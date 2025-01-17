#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License
//
// Merge 2 mbox, removing duplicate emails
// To be used to merge with google takeout

import fs from 'fs'
import path from 'path'
import os from 'os'
import _yargs from 'yargs'
import { hideBin } from 'yargs/helpers';
import crypto from 'node:crypto'
import helperJs from '../js/helpers/helperJs.mjs'

let statistics = {
  nTotal: 0,
  nTotalSize: 0,
  nRemoved: 0,
  nRemovedSize: 0,
  nTrash: 0,
  nDuplicated: 0,
}

async function getArgs(usage) {
  console.log(process.argv)
  const yargs = _yargs(hideBin(process.argv));

  let options = yargs
    .usage(usage)
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "last-mbox": {
        description: "the last mbox file",
        requiresArg: true,
        required: true,
      },
      "all-mbox": {
        description: "all emails mbox",
        requiresArg: true,
        required: true,
      },
      "result-mbox": {
        description: "result of the merge of the 1st 2 mboxes",
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


function mboxParse(messagesDic, filename, fResult){
  console.log(`mboxParse(${filename})`)

  let offset = 0;
  // let chunkSize = 100 * 1024*1024;    // 100MB for very large email
  let chunkSize = 1 * 1024*1024;    // 100MB for very large email
  let chunkBuffer = Buffer.alloc(chunkSize);

  let fp = fs.openSync(filename, 'r');
  let bytesRead = 0;
  let nMessage = 0

  while(bytesRead = fs.readSync(fp, chunkBuffer, 0, chunkSize, offset)) {
    // read a chunk of file of 100MB
    let prevIndex = 0
    // const mbox = chunkBuffer.toString().slice(0, bytesRead);
    const mbox = chunkBuffer

    let lastIndex
    do {
      // console.log(`-------------------------------------------------------------------`)

      lastIndex = mbox.indexOf('\r\nFrom ', prevIndex)
      // console.log(`lastIndex = ${lastIndex}`)
      if ((lastIndex === -1) || (lastIndex >= bytesRead)) {
        // this message is not entirely contained in this chunk,
        // apart if it is the last chunk
        if (bytesRead === chunkSize) {
          lastIndex = -1          // not the last chunk
          if (prevIndex === 0) {
            chunkSize = chunkSize * 2
            console.log(`Double chunck size: ${helperJs.utils.beautifulSize(chunkSize)}`)
            chunkBuffer = Buffer.alloc(chunkSize);
          }
          // console.log(`lastIndex = ${lastIndex}`)
        } else {
          lastIndex = bytesRead   // last chunk - end of message is the end of this buffer
          // console.log(`lastIndex = ${lastIndex}`)
        }
      } else {
        lastIndex = lastIndex + 2   // include \r\n
      }

      if (lastIndex !== -1) {
        const message = mbox.subarray(prevIndex, lastIndex).toString()
        if (!message.startsWith('From ')) {
          // console.log(`Start with: ${message.slice(0,16)}`)
          // console.log(`bytesRead = ${bytesRead}`)
          // console.log(`chunkSize = ${chunkSize}`)
          // console.log(`prevIndex = ${prevIndex}`)
          // console.log(`offset = ${offset}`)
          throw(`mbox does not start with From  at index ${offset+prevIndex}`)
        }
        if (!message.endsWith('\r\n')) {
          throw(`mbox does not end with \\r\\n  at index ${offset+lastIndex}`)
        }

        statistics.nTotal ++
        statistics.nTotalSize += message.length

        let remove = false
        const labelIndex = message.search('X-Gmail-Labels')
        if (labelIndex !== -1) {
          const eol = message.slice(labelIndex).search('\n')
          if (eol === -1) {
            throw('No end of line at X-Gmail-Labels')
          }
          const label = message.slice(labelIndex, eol+labelIndex)
          if (label.search('Corbeille') !== -1) {
            remove = true
            statistics.nTrash ++
          }
        }

        if (!remove) {
          const sha1sum = crypto.createHash('sha1').update(message).digest("hex");
          if (messagesDic[sha1sum] === undefined) {
            messagesDic[sha1sum] = true
          } else {
            // sha1 is found, so remove as a duplicate
            remove = true
            statistics.nDuplicated ++
          }
        }

        if (remove) {
          // console.log(`Message already found!   ${messagesDic[sha1sum]}`)
          statistics.nRemoved ++
          statistics.nRemovedSize += message.length
        } else {
          // console.log('                 NEW MESSAGE! +++++++++++++++++++++++++++++++++++++')
          fs.writeSync(fResult, message)
        }
        prevIndex = lastIndex
        nMessage ++
        // resStream.write(message)
      }

    } while ((prevIndex !== bytesRead) && (lastIndex !== -1))
    offset = offset + prevIndex
  }
  // resStream.end();
  fs.closeSync(fp)

  console.log(`Number of messages: ${nMessage}`)
  console.log(`Number of remaining messages: ${Object.keys(messagesDic).length}`)

  return messagesDic
}

function main(options) {
  // const messages = mboxParse("C:\\Users\\pasca\\Desktop\\merge-mbox\\20240623-tous les messages.mbox")
  const tmpFile = path.join(os.tmpdir(), 'merge-mbox.mbox')
  let messagesDic = {}
  let fResult = fs.openSync(tmpFile, 'w');
  messagesDic = mboxParse(messagesDic, options.lastMbox, fResult)
  messagesDic = mboxParse(messagesDic, options.allMbox, fResult)
  fs.closeSync(fResult)
  fs.copyFileSync(tmpFile, options.resultMbox)
}

const options = await getArgs(`merge-mbox --last-mbox=<> --all-mbox=<> --result-mbox=<>`)
main(options);

console.log(`Number of processed emails: ${statistics.nTotal}, that is ${helperJs.utils.beautifulSize(statistics.nTotalSize)}`)
console.log(`Number of removed emails: ${statistics.nRemoved}, that is ${helperJs.utils.beautifulSize(statistics.nRemovedSize)}`)
console.log(`  - number removed because in the trash: ${statistics.nTrash}`)
console.log(`  - number removed because duplicated:   ${statistics.nDuplicated}`)
console.log('DONE')