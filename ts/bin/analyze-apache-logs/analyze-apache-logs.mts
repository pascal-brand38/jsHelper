#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import * as fs from 'fs'
import { program } from 'commander'
import type { OptionValues } from 'commander'
import ApacheData  from './apache-data.mjs'

function _readConfig(options: OptionValues) {
  if (options.config) {
    const configText = fs.readFileSync(options.config)
    options.config = JSON.parse(configText.toString())
  } else {
    options.config = {}
  }
}

function getArgs(argv: string[]): OptionValues {
  program
    .name('analyze-apache-logs')
    .usage('node analyze-apache-logs <options>')
    .description('Analyze apache logs')
    .arguments('<log-files...>')
    .option(
      '--config <path>',
      'Config json file. Default is analyze-apache-logs.json'
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

  console.log()
  console.log(`#users: ${apacheData.ips['user'].length}`)
  console.log(`#bots:  ${apacheData.ips['bot'].length}`)
  console.log(`#spams: ${apacheData.ips['spam'].length}`)
}
