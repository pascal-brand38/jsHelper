// Copyright (c) Pascal Brand
// MIT License

import Alpine from 'alpine'   // Apache Log Parser
import fs from 'fs'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'
import { DateTime } from '../../extend/luxon.mjs';
import assert from 'node:assert';

async function _readLines(filename) {
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

async function _read(logFilename) {
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

  // var logs = alpine.parseLine('78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"');
  // console.log(logs);

  const lines = await _readLines(logFilename)
  let logs = []
  for (const line of lines) {
    logs.push(alpine.parseLine(line))
  }
  return logs
}

async function _readDbip(dbIpFilename) {
  try {
    if (dbIpFilename === undefined) {
      return {}
    }
    return JSON.parse(fs.readFileSync(dbIpFilename, 'utf8'))
  } catch (e) {
    console.log(e)
    console.log(`CANNOT READ ${dbIpFilename}`)
    return {}
  }
}

class ApacheData {
  constructor() {
    this.logs = []

    /**
     * list of IPs considered as coming from real users (not spam)
     * @type {Array.<string>}
     */
    this.userIps = []    /** {Array.<string>} */

    /**
     * list of IPs considered as spams (bots, phishing,...)
     * @type {Array.<string>}
     */
    this.spamIps = []             // list of IPs considered as spams
    this.dbip = undefined
    this.todayStr = DateTime.fromNowStartOfDay().toFormat('d/M/y')
  }

  async read(logFilename, dbIpFilename) {
    this.logs = await _read(logFilename)
    this.dbip = await _readDbip(dbIpFilename)
    this._setuserIps()

    // check spams in db
    let newSpamIps = []
    this.userIps.forEach(ip => {
      if (this.dbip[ip]) {
        const antispams =  Object.keys(this.dbip[ip])
        if (antispams.some(s => this.dbip[ip][s].isSpam)) {
          newSpamIps.push(ip)
        }
      }
    });

    this.addSpamIps(newSpamIps)
  }

  async saveDbip(dbIpFilename) {
    fs.writeFileSync(dbIpFilename, JSON.stringify(this.dbip, null, 2), 'utf8')
  }

  _addToDb(ip, isSpam, antispam, reason) {
    const value = { isSpam: isSpam, reason: reason, date: this.todayStr }
    if (this.dbip[ip] === undefined) {
      this.dbip[ip] = {}
    }
    if (this.dbip[ip][antispam] === undefined) {
      this.dbip[ip][antispam] = value
    } else {
      assert.equal(this.dbip[ip][antispam].isSpam, false)   // we add to db only the ones that are not already detected as spam
      if (isSpam) {
        this.dbip[ip][antispam] = value
      } else {
        this.dbip[ip][antispam].date = this.todayStr
      }
    }
  }

  _spamInformation(ip, isSpam, antispam, reason) {
    this._addToDb(ip, isSpam, antispam, reason)

    return { ip, isSpam, antispam, reason, date: this.todayStr }
  }

  spamCheckToday(ip, antispam) {
    if (!this.dbip[ip]) {
      return false
    } else if (!this.dbip[ip][antispam]) {
      return false
    } else {
      return this.dbip[ip][antispam].date === this.todayStr
    }
  }

  spamDetected(ip, reason, antispam) {
    return this._spamInformation(ip, true, antispam, reason)
  }

  noSpam(ip, antispam) {
    return this._spamInformation(ip, false, antispam, undefined)
  }

  /**
   * Print statistics on logs
   */
  print() {
    console.log(`\nStatistics:`)

    const nuserIps = this.userIps.length
    const nSpams =  this.spamIps.length
    const percentageSpams = Math.round(100 * nSpams / (nSpams + nuserIps))
    console.log(`- IPS:`)
    console.log(`    #Real Users: ${nuserIps}`)
    console.log(`    #Spams (bots, phishing...): ${nSpams} (${percentageSpams}%)`)

    const logsUsers = this.logs.filter(l => this.userIps.includes(l.remoteHost))
    const logsSpams = this.logs.filter(l => this.spamIps.includes(l.remoteHost))
    const percentageLogsSpams = Math.round(100 * logsSpams.length / (logsSpams.length + logsUsers.length))
    console.log(`- Requests:`)
    console.log(`    #Requests from Real Users: ${logsUsers.length}`)
    console.log(`    #Requests from Spams (bots, phishing...): ${logsSpams.length} (${percentageLogsSpams}%)`)
  }

  /**
   * Knowing new ips are spam, remove them from the list this.userIps,
   * and add them to the list this.spamIps
   * @param {Array.<string>} newSpamIps List of new ips detected as spam ip
   */
  addSpamIps(newSpamIps) {
    if (newSpamIps.some(ip => this.spamIps.includes(ip))) {
      console.trace('ERROR: new spam ips already in spam')
      process.exit(-1)
    }
    this.userIps = this.userIps.filter(ip =>
      (ip !== '0.0.0.0') && (!newSpamIps.some(spamip => (ip === spamip)))
    )
    this.spamIps = [ ...this.spamIps, ...newSpamIps ]
  }

  // private methods
  _setuserIps() {
    let setUnique = new Set(this.logs.map(function(a) {return a.remoteHost;}))
    this.userIps = [ ...setUnique ].sort()
  }
}

export default ApacheData
