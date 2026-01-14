#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import * as path from 'path'
import * as fs from 'fs'
import * as url from 'url';
import { program } from 'commander'
import type { OptionValues } from 'commander'
import ApacheData  from './apache-data.mjs'

function _readConfig(options: OptionValues) {
  const configText = fs.readFileSync(options.config)
  options.config = JSON.parse(configText.toString())
}

function getArgs(argv: string[]): OptionValues {
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);

  program
    .name('analyze-apache-logs')
    .usage('node analyze-apache-logs <options>')
    .description('Analyze apache logs')
    .arguments('<log-files...>')
    .option(
      '--config <path>',
      'Config json file. Default is analyze-apache-logs.json',
      path.join(__dirname, 'analyze-apache-logs', 'analyze-apache-logs.json')
    );

  program.parse()

  const options = program.opts()
  _readConfig(options)
  return { options, logs: program.args }

}

export async function analyzeApacheLogs() {
  const { options, logs } = getArgs(process.argv)

  const apacheData = new ApacheData()
  apacheData.readLogs(logs)
  apacheData.populateIps(options)

  // await local.spamDetection(apacheData, options)

  // apacheData.print(options)

  // // print error codes of real users
  const logsUsers = apacheData.logs.filter(l => apacheData.ips['user'].includes(l.remoteHost))
  // const logsSpams = apacheData.logs.filter(l => apacheData.spamIps.includes(l.remoteHost))

  const statusUsers: {[key: string]: string[]} = {}
  logsUsers.forEach(log => {
    if (statusUsers[log.status] === undefined) {
      statusUsers[log.status] = [log.request]
    } else {
      statusUsers[log.status].push(log.request)
    }
  })
  console.log('\n- Status codes of Real Users:')
  Object.keys(statusUsers).forEach(status => {
    if (!status.startsWith('2')) {
      const uniqueStatus = new Set(statusUsers[status])
      console.log(`    ${status}:`)
      uniqueStatus.forEach(request => {
        console.log(`        ${request}`)
      })
    }
  })
}
