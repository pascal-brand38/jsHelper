#!/usr/bin/env node

// Copyright (c) Pascal Brand
// MIT License

import fs from 'fs';
import { program } from 'commander'
import shell from 'shelljs';

// https://nodejs.org/api/readline.html
// https://stackoverflow.com/questions/74903152/running-node-js-readline-functions
import * as readline from 'readline/promises';
import { stdin as input, stdout as output } from 'process';

const now = new Date()
const currentYear = now.getFullYear()
const currentMonth = now.getMonth() + 1
const currentDay = now.getDate()

const question = async (text) => {
  const rl = readline.createInterface({ input, output })
  const answer = await rl.question(`${text}`)
  rl.close()
  return answer
}

const daysInMonth = (monthIndex, year) => new Date(year, monthIndex, 0).getDate();

function getArgs() {
  program
    .name('flatten-mboxes')
    .usage('node bin/get-logs --login <login> --host <host> --site <site> [options]')
    .description('get log of ovh hosting')
    .requiredOption(
      '--login <login>',
      'login for the log server',
    )
    .requiredOption(
      '--host <host>',
      'host for the log server',
    )
    .requiredOption(
      '--site <site>',
      'site for the log server',
    )
    .option(
      '--first-year <First Year>',
      'first year to get logs',
      2025
    )
    .option(
      '--root-dir <Root Directory>',
      'root directory to download to',
      './logs'
    )

  program.parse()

  return program.opts()
}


const options = getArgs()

const password = await question(`Password: `)

console.log('Get logs for site:', options.site)

const url = `https://${options.host}/${options.site}`

let abort = false
for (let year = options.firstYear; year <= currentYear && !abort; year++) {
  const lastMonth = (year === currentYear) ? currentMonth : 12
  for (let month = 1; month <= lastMonth && !abort; month++) {
    const monthStr = month.toString().padStart(2, '0')

    const localDir = `${options.rootDir}/${year}/${monthStr}`
    shell.mkdir('-p', localDir)

    const remoteDir = `logs/logs-${monthStr}-${year}`

    const lastDay = (year === currentYear && month === currentMonth) ? currentDay : daysInMonth(month, year)
    for (let day = 1; day <= lastDay && !abort; day++) {
      const dayStr = day.toString().padStart(2, '0')
      const file = `${options.site}-${dayStr}-${monthStr}-${year}.log`

      if (fs.existsSync(`${localDir}/${file}`)) {
        console.log(`Skipping file: ${file}`)
        continue
      } else {
        console.log(`Getting file:  ${file}`)
        const cmd = `curl --no-clobber -k -s -O -u ${options.login}:${password} ${url}/${remoteDir}/${file}.gz && gzip -d ${file}.gz && mv ${file} ${localDir}/`
        const code = shell.exec(cmd)
        if (code.code !== 0) {
          console.error('Error executing command:', cmd)
          console.log('ABORTING further downloads.')
          abort = true
        } else {
        }
      }
    }
  }
}

console.log('Done')
