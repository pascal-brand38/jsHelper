#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import path from 'path'
import fs from 'fs'
import url from 'url';
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import ApacheData  from './analyze-apache-logs/apache-data.mjs'
import local from './analyze-apache-logs/antispam-local.mjs'

function _setDbIpFilename(options) {
  // https://stackoverflow.com/questions/8817423/why-is-dirname-not-defined-in-node-repl
  // get dir where analyze-apache-logs.mjs is stored
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  options.dbIpFilename = path.join(__dirname, 'analyze-apache-logs', 'db-ip.json')
}

function _readConfig(options) {
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  let configFilename
  if (options.config) {
    configFilename = options.config
  } else {
    configFilename = path.join(__dirname, 'analyze-apache-logs', 'analyze-apache-logs.json')
  }

  const configText = fs.readFileSync(configFilename)
  options.config = JSON.parse(configText)
}

function getArgs(argv) {
  // console.log(argv)

  let options = yargs(hideBin(argv))
    .usage('DESCRIPTION TODO')
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .demandCommand(1)   // at least 1 arg without options, which is the log
    .options({
      "dbip": {
        description: 'Do not use an existing DB IP to know spams',
        type: 'boolean',
        default: true,
      },
      "config": {
        description: 'Config json file. Default is analyze-apache-logs.json',
      },
    })
    .argv;

  _setDbIpFilename(options)
  _readConfig(options)

  return options;
}

async function main() {
  const options = getArgs(process.argv)

  const apacheData = new ApacheData(options)
  apacheData.readLogs(options['_'])
  if (options.dbip) {
    apacheData.readDbIp(options.dbIpFilename)
  }
  apacheData.populateIps()

  await local.spamDetection(apacheData, options)
  // await stopforumspam.spamDetection(apacheData)
  // await abuseipdb.spamDetection(apacheData)
  // await ipqualityscore.spamDetection(apacheData)   NOT ACCURATE because of 37.66.21.18

  apacheData.print(options)
  if (options.dbip) {
    apacheData.saveDbip(options.dbIpFilename)
  }

  console.log('Done')
}


main();

/*
node.exe  ../../pascal-brand38/jsHelper/bin/analyze-apache-logs.mjs --log-file logs/2023/12/20231214-*
*/

/*
npm install -g .
analyze-apache-logs --log-file ../../other/web-design/logs/2023/12/20231214-* --db-ip ../../other/web-design/bin/log-statistics-ip-info.json
analyze-apache-logs --log-file ../../other/web-design/logs/2023/12/20231214-*
*/


/* Localisation
http://ip-api.com/json/35.180.22.238
https://ip-api.com/docs/api:json
*/
