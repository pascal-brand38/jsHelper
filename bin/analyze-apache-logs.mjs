#!/usr/bin/env node

import yargs from 'yargs'
import { createReadStream, readFileSync } from 'fs'
import { createInterface } from 'readline'
import { hideBin } from 'yargs/helpers'
import Alpine from 'alpine'
import fetch from 'node-fetch'

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

async function readLines(filename) {
  const fileStream = createReadStream(filename);

  const rl = createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });
  // Note: we use the crlfDelay option to recognize all instances of CR LF
  // ('\r\n') as a single line break.

  let lines = []
  for await (const line of rl) {
    lines.push(line)
  }
  return lines
}

async function readApacheData(options) {
  // Apache logs: https://httpd.apache.org/docs/current/mod/mod_log_config.html
  // On
  //    '78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"'
  // returns:
  //   {
  //     originalLine: '78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"',
  //     remoteHost: '78.153.241.205',
  //     logname: 'www.example.com',
  //     remoteUser: '-',
  //     time: '27/Dec/2021:05:55:01 +0100',
  //     request: 'GET /index.html HTTP/1.1',
  //     status: '200',
  //     sizeCLF: '3092',
  //     'RequestHeader Referer': '-',
  //     'RequestHeader User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0'
  //   }
  var alpine = new Alpine('%h %l %u %t "%r" %>s %b "%{Referer}i" "%{User-Agent}i"');

  // var data = alpine.parseLine('78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"');
  // console.log(data);

  const lines = await readLines(options.logFile)
  let data = []
  for (const line of lines) {
    data.push(alpine.parseLine(line))
  }
  return data
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
