#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'
import apacheData  from './analyze-apache-logs/apache-data.mjs'
import dbIp  from './analyze-apache-logs/db-ip.mjs'
import stopforumspam  from './analyze-apache-logs/antispam-stopforumspam.mjs'

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


/////////////////////////////////////////////////////////////////////////////////////

async function main() {
  const options = getArgs(process.argv)
  // console.log(options)
  const data = await apacheData.read(options)

  let db = await dbIp.read(options)
  db = await stopforumspam.populateDbIp(data, db)

  console.log('Done')
}


main();

/*
node.exe  ../../pascal-brand38/jsHelper/bin/analyze-apache-logs.mjs --log-file logs/2023/12/20231214-*
*/

/*
npm install -g . &&  analyse-apache-logs --log-file ../../other/web-design/logs/2023/12/20231214-* --db-ip ../../other/web-design/bin/log-statistics-ip-info.json

*/
