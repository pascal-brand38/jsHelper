#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import * as fs from 'fs'
import { program } from 'commander'
import type { OptionValues } from 'commander'
import ApacheData, { ApacheLineTypes }  from './apache-data.mjs'

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

  // // print error codes of real users
  const logsUsers = apacheData.logs.filter(l => apacheData.ips['user'].includes(l.remoteHost))
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

  console.log()
  const logsAll = apacheData.logs
  const requests = [
    "GET /sitemap",
  ]
  const statusRequest: { [request: string]: {[status: string]: number} } = {}
  logsAll.forEach((log: ApacheLineTypes) => {
    if (requests.some(request => log['request'].includes(request))) {
      const request = log['request']
      if (statusRequest[request] === undefined) {
        statusRequest[request] = {}
      }
      const status = log['status']
      if (statusRequest[request][status] === undefined) {
        statusRequest[request][status] = 0
      }
      statusRequest[request][status]++
    }
  })
  console.log('- Status codes for sitemap requests:')
  Object.keys(statusRequest).forEach(request => {
    console.log(`    ${request}:`)
    Object.keys(statusRequest[request]).forEach(status => {
      console.log(`        ${status}: ${statusRequest[request][status]}`)
    })
  })
  console.log()

  apacheData.print(options)

}
