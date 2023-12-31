// Copyright (c) Pascal Brand
// MIT License

import Alpine from 'alpine'
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
    this.logs = undefined
    this.uniqueIps = undefined    // list of IPs considered as OK
    this.spamIps = []             // list of IPs considered as spams
    this.dbip = undefined
    this.todayStr = DateTime.fromNowStartOfDay().toFormat('d/M/y')
  }

  async read(logFilename, dbIpFilename) {
    this.logs = await _read(logFilename)
    this.dbip = await _readDbip(dbIpFilename)
    this._setUniqueIps()

    // check spams in db
    let spamIps = []
    this.uniqueIps.forEach(ip => {
      if (this.dbip[ip]) {
        const antispams =  Object.keys(this.dbip[ip])
        if (antispams.some(s => this.dbip[ip][s].isSpam)) {
          spamIps.push({ ip: ip, isSpam: true })
        }
      }
    });

    this.filter(spamIps)
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

    const spam = { ip: ip, isSpam: isSpam, antispam: antispam, date: this.todayStr, reason: reason }
    return spam
  }

  spamDetected(ip, reason, antispam) {
    return this._spamInformation(ip, true, antispam, reason)
  }

  noSpam(ip, antispam) {
    return this._spamInformation(ip, false, antispam, undefined)
  }

  print() {
    console.log(this.spamIps)
    console.log(this.uniqueIps)
    console.log(`Nb unique IPS not being spams: ${this.uniqueIps.length}`)
    console.log(`Nb spams: ${this.spamIps.length}`)
  }

  filter(spamIps) {
    // this.uniqueIps = spamIps.filter(ip => ip.isSpam === false).map(ip => ip.ip)
    this.uniqueIps = this.uniqueIps.filter(ip =>
      (ip !== '0.0.0.0') && (!spamIps.some(spam => (ip === spam.ip)  && (spam.isSpam)))
    )
    this.spamIps = [ ...this.spamIps, ...spamIps.filter(ip => ip.isSpam) ]
  }


  // private methods
  _setUniqueIps() {
    let setUnique = new Set(this.logs.map(function(a) {return a.remoteHost;}))
    this.uniqueIps = [ ...setUnique ].sort()
  }
}

export default ApacheData
