// Copyright (c) Pascal Brand
// MIT License

import Alpine from 'alpine'   // Apache Log Parser
import fs from 'fs'
import { DateTime } from '../../extend/luxon.mjs';
import assert from 'node:assert';
import helperJs from '../../helpers/helperJs.mjs';

class ApacheData {
  constructor() {
    this.logs = undefined

    /**
     * list of IPs considered as coming from real users (not spam)
     * @type {Array.<string>}
     */
    this.userIps = undefined    /** {Array.<string>} */

    /**
     * list of IPs considered as spams (bots, phishing,...)
     * @type {Array.<string>}
     */
    this.spamIps = undefined             // list of IPs considered as spams
    this.dbip = {}
    this.todayStr = DateTime.fromNowStartOfDay().toFormat('d/M/y')
  }

  /**
   * Read all log files, and populates this.logs
   * @param {Array.<string>} logFilenames
   */
  readLogs(logFilenames) {
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

    let lines = []
    logFilenames.forEach(logFilename => {
      const log = fs.readFileSync(logFilename).toString()
      lines = lines.concat(log.split('\n'))
    })

    this.logs = []
    for (const line of lines) {
      if (line.length !== 0) {
        this.logs.push(alpine.parseLine(line))
      }
    }
  }

  /**
   * Read the db file (containing spams), and populates this.dbip
   * @param {string} dbIpFilename
   */
  readDbIp(dbIpFilename) {
    try {
      if (dbIpFilename === undefined) {
        this.dbip = {}
      } else {
        this.dbip = JSON.parse(fs.readFileSync(dbIpFilename, 'utf8'))
      }
    } catch (e) {
      console.log(e)
      console.log(`CANNOT READ ${dbIpFilename}`)
      this.dbip = {}
    }
  }

  /**
   * Populate this.userIps and this.spamIps using this.logs and this.dbip
   */
  populateIps() {
    // populate this.userIps with all known ips, and spamIps to the empty list
    let setUnique = new Set(this.logs.map(function(a) {return a.remoteHost;}))
    this.userIps = [ ...setUnique ].sort()
    this.spamIps = []

    if (!this.dbip) {
      return
    }

    // get all spams from the db
    let newSpamIps = []
    this.userIps.forEach(ip => {
      if (this.dbip[ip]) {
        const antispams =  Object.keys(this.dbip[ip])
        if (antispams.some(s => this.dbip[ip][s].isSpam)) {
          newSpamIps.push(ip)
        }
      }
    });

    // populate this.spamIps, and remove these ips from this.userIps
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

  _printSingle(users, spams, title, usersText, spamsText, from=false, print=(size)=>size) {
    const composeText = (text, from) => {
      let cText = `    ${text}`
      if (from) {
        cText += ` from ${from}`
      }
      while (cText.length <= 30) {
        cText += '.'
      }
      return cText
    }
    const percentageSpams = Math.round(100 * spams / (spams + users))
    const uText = composeText(usersText, (from ? 'Real Users' : false))
    const sText = composeText(spamsText, (from ? 'Spams' : false))

    console.log(title)
    console.log(`${uText}: ${print(users)}`)
    console.log(`${sText}: ${print(spams)} (${percentageSpams}%)`)
  }

  /**
   * Print statistics on logs
   */
  print(options) {
    const statsConfig = options.config.stats
    const logsUsers = this.logs.filter(l => this.userIps.includes(l.remoteHost))
    const logsSpams = this.logs.filter(l => this.spamIps.includes(l.remoteHost))

    console.log(`\nStatistics (considering bots, phishing... as spams):`)

    this._printSingle(this.userIps.length, this.spamIps.length, '- IPS:', '#Real Users', '#Spams')
    this._printSingle(logsUsers.length, logsSpams.length, '- Requests:', '#Requests', '#Requests', true)

    const computeSize = (logs) => logs.reduce(
      (partialSum, log) => {
        const current = parseInt(log.sizeCLF)
        return (isNaN(current)) ? partialSum : partialSum + current
      },
      0
    )
    this._printSingle(computeSize(logsUsers), computeSize(logsSpams), '- Sizes:', '#Sizes', '#Sizes', true, helperJs.utils.beautifulSize)

    if (statsConfig && statsConfig['contact-post']) {
      const logUsersContact = logsUsers.filter(l => (l['request'].startsWith(statsConfig['contact-post'])))
      const logSpamsContact = logsSpams.filter(l => (l['request'].startsWith(statsConfig['contact-post'])))
      this._printSingle(logUsersContact.length, logSpamsContact.length, '- Requests:', '#Contact', '#Contact', true)
    }
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

  saveLogsUser(filename) {
    const userLogs = this.logs.filter(log => this.userIps.includes(log.remoteHost))
    let text = ''
    userLogs.forEach(log => text = text + log.originalLine + '\n')
    fs.writeFileSync(filename, text)
  }


  // private methods
}

export default ApacheData
