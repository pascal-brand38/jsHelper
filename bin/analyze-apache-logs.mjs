#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import ApacheData  from './analyze-apache-logs/apache-data.mjs'
import DbIp  from './analyze-apache-logs/db-ip.mjs'
import stopforumspam  from './analyze-apache-logs/antispam-stopforumspam.mjs'
import abuseipdb  from './analyze-apache-logs/antispam-abuseipdb.mjs'
import path from 'path'
import url from 'url';
// import fs from 'fs'

function setDbIpFilename(options) {
  // https://stackoverflow.com/questions/8817423/why-is-dirname-not-defined-in-node-repl
  // get dir where analyze-apache-logs.mjs is stored
  const __filename = url.fileURLToPath(import.meta.url);
  const __dirname = path.dirname(__filename);
  options.dbIpFilename = path.join(__dirname, 'analyze-apache-logs', 'dbip.json')
}

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
    })
    .argv;

  setDbIpFilename(options)

  return options;
}

async function main() {
  const options = getArgs(process.argv)
  // console.log(options)

  const apacheData = new ApacheData(options)
  await apacheData.read(options.logFile)
  // console.log(apacheData.uniqueIps)

  const dbIp = new DbIp()
  await dbIp.read(options.dbIpFilename)
  // console.log(dbIp.db)

  const stopforumspamDatas = await stopforumspam.get(apacheData.uniqueIps)
  // console.log(stopforumspamDatas)
  dbIp.populate(stopforumspamDatas, 'stopforumspam', stopforumspam.ipStatus)
  // console.log(dbIp.db)

  const abuseipdbBlacklist = await abuseipdb.getBlacklist()
  // console.log(abuseipdbBlacklist)
  dbIp.populate(abuseipdbBlacklist, 'abuseipdb', abuseipdb.ipStatus)
  // fs.writeFileSync('C:\\tmp\\blacklist.txt', JSON.stringify(abuseipdbBlacklist))

  // dbIp.status(apacheData.uniqueIps)

  dbIp.save(options.dbIpFilename)

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
