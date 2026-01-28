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

  console.log()
  console.log(`#users: ${apacheData.ips['user'].length}`)
  console.log(`#bots:  ${apacheData.ips['bot'].length}`)
  console.log(`#spams: ${apacheData.ips['spam'].length}`)
  console.log()

  apacheData.print(options)
}
