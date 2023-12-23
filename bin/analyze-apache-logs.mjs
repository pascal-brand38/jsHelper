#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import { readFileSync } from 'fs'
import fetch from 'node-fetch'
import { readApacheData }  from './analyze-apache-logs/read-apache-data.mjs'

function getArgs(argv) {
  console.log(argv)

  let options = yargs(hideBin(argv))
    .usage('DESCRIPTION TODO')
    .help('help').alias('help', 'h')
    .version('version', '1.0').alias('version', 'V')
    .options({
      "log-file": {
        description: "TODO",
        requiresArg: true,
        required: true,
      },
      "db-ip": {
        description: "private db filename, containing info about ips: spam, crawler,...",
        default: '',
        requiresArg: true,
        required: false,
      },
    })
    .argv;

  return options;
}



/////////////////////////////////////////////////////////////////////////////////////

async function readDbIp(options) {
  if (options.dbIp === '') {
    return undefined
  }
  return JSON.parse(readFileSync(options.dbIp, 'utf8'))
}

async function populateStopforumspam(apacheData, dbIp) {
  if (dbIp === undefined) {
    return undefined
  }
  let uniqueIps = new Set(apacheData.map(function(a) {return a.remoteHost;}));
  if (uniqueIps.size === 0) {
    return
  }
  if (uniqueIps.size === 1) {
    uniqueIps.push('0.0.0.0')   // to have a list of results
  }
  const url = 'https://api.stopforumspam.org/api?json&ip=' + [...uniqueIps].join('&ip=')
  let results
  try {
    const response = await fetch(url);
    results = await response.json();
    console.log(results)
  } catch {
    return undefined
  }

  //
  results.ip.forEach(element => {
    let dbIpItem = dbIp[element.value]
    if (dbIpItem === undefined) {
      // create the entry for this ip
      dbIp[element.value] = {
        epoch: 0,
      }
      console.log(`${element.value} NOT FOUND`)
    } else {
      console.log(`${element.value} FOUND`)
    }
  });

  return dbIp
}
// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

/////////////////////////////////////////////////////////////////////////////////////

async function main() {
  const options = getArgs(process.argv)
  // console.log(options)
  const apacheData = await readApacheData(options)

  let dbIp = await readDbIp(options)
  dbIp = await populateStopforumspam(apacheData, dbIp)

  console.log('Done')
}


main();

/*
node.exe  ../../pascal-brand38/jsHelper/bin/analyze-apache-logs.mjs --log-file logs/2023/12/20231214-*
*/

/*
npm install -g . &&  analyse-apache-logs --log-file ../../other/web-design/logs/2023/12/20231214-* --db-ip ../../other/web-design/bin/log-statistics-ip-info.json

*/
