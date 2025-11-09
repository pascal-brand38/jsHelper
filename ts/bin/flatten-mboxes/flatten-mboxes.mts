#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import * as fs from 'fs'
import * as path from 'path'

// @ts-ignore
import { mboxReader } from 'mbox-reader'  // scan messages

import * as crypto from 'node:crypto'

import { simpleParser, } from 'mailparser' // parse a single message

import pLimit from 'p-limit'                          // limit the number of processed emails in parallel

import { program } from 'commander'
import type { OptionValues } from 'commander'
import { LIB_VERSION } from './version.mjs'

// var colors = require('colors');
import 'colors'

const skipPaths = [
  "[Gmail].sbd\\Important",
  "[Gmail].sbd\\Suivis",
  "[Gmail].sbd\\Tous les messages",
  "[Gmail].sbd\\Corbeille",
]

interface statsType {
  nTotal: number,
  nNew: number,
}
const _stats: statsType = {
  nTotal: 0,            // total number of emails
  nNew: 0,              // new emails that have been pdfed
}


function getDirectories(source: string) {
  try {
    return fs.readdirSync(source, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name)
  } catch {
    return []
  }
}


function getArgs() {
  program
    .name('flatten-mboxes')
    .version(LIB_VERSION)   // TODO: use dynamic version from package.json
    .usage('node dist/mail-to-pdf <options> --output-dir <dir>')
    .description('Create a single mbox from several ones, removing duplicates')
    .option(
      '--input <dir|mbox>',
      'input, either a directory or a mbox file. When not provided, is looking at thunderbird mbox files (working on windows only)'
    )
    .requiredOption(
      '--output <mbox>',
      'output mbox, that includes all messages from input, and the one of output if it already exists',
    )
    .option(
      '--no-parallel',
      'Use --no-parallel to run sequentially',
      true
    )
    .option(
      '--dry-run',
      'dryrun - nothing is generated',
      false,
    )
    .option(
      '--no-skip',
      `Use --no-skip not to skip ${skipPaths}`,
      true
    ),

  program.parse()

  return program.opts()
}


async function getHash(options: OptionValues, message: any) {
  const parser = await simpleParser(message.content);
  const date = (parser.headers.get('date') as Date)
  const subject = parser.headers.get('subject')
  const messageId = parser.headers.get('message-id')

  const strToHash = subject + ( date ? date.toLocaleString() : '') + messageId

  const shasum = crypto.createHash('sha1')
  shasum.update(strToHash)
  return shasum.digest('hex')
}

async function getHashes(options: OptionValues, mboxFilename: string) {
  let nMessages = 0
  const display = () => {
    nMessages ++
    const lenWhite = 80 + 20
    process.stdout.write(`${" ".repeat(lenWhite)}\r`.green)
    process.stdout.write(`--- ${nMessages}\r`.green)
  }

  try {
    const stat = fs.statSync(mboxFilename)
    if (stat.isFile()) {
    } else {
      console.log(`ERROR: Output mbox ${mboxFilename} type is not recognized`.red)
      return null   // this is an error
    }
  } catch {
    // the output file does not exist
    // ==> create it, and return empty hashes
    console.log(`Output mbox ${mboxFilename} does not exist`.green)
    console.log(`Create it`.green)
    fs.closeSync(fs.openSync(mboxFilename, 'w'));
    return []
  }

  let result: string[]
  console.log(`Reading messages in ${mboxFilename}`.blue)
  const readStream = fs.createReadStream(mboxFilename)
  if (false && options.parallel) {
    // disable parallel as read all file in memory, which is huge
    let promises = []
    const limit = pLimit(5);      // max of 5 emails in parallel
    for await (let message of mboxReader(readStream)) {
      promises.push(limit(async () => { display() ; return await getHash(options, message) } ))
    }
    result = await Promise.all(promises).then(result => result)
  } else {
    result = []
    for await (let message of mboxReader(readStream)) {
      display()
      const hash = await getHash(options, message)
      if (result.some(r => r===hash)) {
        const parser = await simpleParser(message.content);
        console.log()
        console.log(`Duplicate: from=${parser.headers.get('from')}`)
        console.log(`Duplicate: subject=${parser.headers.get('subject')}`)
        console.log(`Duplicate: date=${parser.headers.get('date')}`)
        console.log(`Duplicate: message-id=${parser.headers.get('message-id')}`)
        console.log(message.content.toString())
      }
      result.push(hash)
    }
  }
  console.log()
  return result
}

async function flattenMbox(options: OptionValues, hashes: string[], outputMbox: string, inputMbox: string) {
  const processOneMessage = async (message: any) => {
    const hash = await getHash(options, message)
    nTotal ++
    if (!hashes.some(h => (h === hash))) {
      nNew ++
      hashes.push(hash)
      const regEx = /^From/gm   // m is the multiline
      fs.appendFileSync(outputMbox, `From - ${message.time}\n${message.content.toString().replaceAll(regEx, '>From')}\n\n`)
    }
    const lenWhite = 80 + 20
    process.stdout.write(`${" ".repeat(lenWhite)}\r`.green)
    process.stdout.write(`--- ${nNew}/${nTotal}\r`.green)
  }

  if (skipPaths.some(skipPath => inputMbox.endsWith(skipPath))) {
    console.log(`Skip mbox file: ${inputMbox}`.yellow)
    return
  }

  const readStream = fs.createReadStream(inputMbox)
  console.log(`Processing mbox file: ${inputMbox}`.blue)

  let nTotal = 0
  let nNew = 0
  if (options.parallel) {
    let promises = []
    const limit = pLimit(5);      // max of 5 emails in parallel
    for await (let message of mboxReader(readStream)) {
      promises.push(limit(async () => processOneMessage(message)))
    }
    await Promise.all(promises)
  } else {
    for await (let message of mboxReader(readStream)) {
      await processOneMessage(message)
    }
  }

  if (nTotal !== 0) {
    _stats.nTotal += nTotal
    _stats.nNew += nNew
    console.log('Adding '.blue + `${nNew}`.green + ' messages, and skipped as duplicate '.blue + `${nTotal - nNew}`.green + ' messages'.blue)
  }
}

async function flattenInput(options: OptionValues, hashes: string[], outputMbox: string, input: string) {
  try {
    const stat = fs.statSync(input)
    if (stat.isFile()) {
      await flattenMbox(options, hashes, outputMbox, input)
    } else {
      const contents = fs.readdirSync(input, { withFileTypes: true })
      for (const i in contents) {
        await flattenInput(options, hashes, outputMbox, path.join(input, contents[i].name))
      }
    }
  } catch {
  }
}

export async function flattenMboxes() {
  const options: OptionValues = getArgs()

  let inputs: string[] = []

  if (options.input === undefined) {
    // thunderbird on windows is used by default
    const appdata = process.env['APPDATA']
    if (!appdata) {
      throw '$APPDATA is not defined in the environment variables'
    }
    const thunderbirdProfileDir = path.join(appdata, 'Thunderbird', 'Profiles')
    inputs = getDirectories(thunderbirdProfileDir).map(dir => path.join(thunderbirdProfileDir, dir, 'ImapMail'))
  } else {
    inputs = [ options.input ]
  }

  const hashes = await getHashes(options, options.output)

  if (hashes === null) {
    return  // Error. Stop the process
  }

  const set = new Set(hashes)
  if (set.size !== hashes.length) {
    console.log(`DUPLICATES in ${options.output}: ${set.size} vs ${hashes.length}`)
    return
  }

  console.log(inputs)
  for await (let input of inputs) {
    console.log(input)
    await flattenInput(options, hashes || [], options.output, input)
  }

  console.log()
  console.log(`Number of emails in new mbox:           ${(hashes!==null) ? hashes?.length : 0}`.green)
  console.log(`Number of new emails:                   ${_stats.nNew}`.green)
  console.log(`Number of skipped as duplicates emails: ${_stats.nTotal - _stats.nNew}`.green)

  console.log('DONE'.green)
}
