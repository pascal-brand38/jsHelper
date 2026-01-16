// Copyright (c) Pascal Brand
// MIT License

// @ts-ignore
import Alpine from 'alpine'   // Apache Log Parser
import * as fs from 'fs'
import { OptionValues } from 'commander';

export type ApacheLineIndexTypes = 'originalLine' | 'remoteHost' | 'logname' | 'remoteUser' | 'time' | 'request' | 'status' | 'sizeCLF' | 'RequestHeader Referer' | 'RequestHeader User-Agent'

export interface ApacheLineTypes {
  originalLine: string                // originalLine: '78.153.241.205 www.example.com - [27/Dec/2021:05:55:01 +0100] "GET /index.html HTTP/1.1" 200 3092 "-" "Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0"',
  remoteHost: string                  // remoteHost: '78.153.241.205',
  logname: string                     // logname: 'www.example.com',
  remoteUser: string                  // remoteUser: '-',
  time: string                        // time: '27/Dec/2021:05:55:01 +0100',
  request: string                     // request: 'GET /index.html HTTP/1.1',
  status: string                      // status: '200',
  sizeCLF: string                     // sizeCLF: '3092',
  'RequestHeader Referer': string     // 'RequestHeader Referer': '-',
  'RequestHeader User-Agent': string  // 'RequestHeader User-Agent': 'Mozilla/5.0 (Windows NT 10.0; WOW64; rv:43.0) Gecko/20100101 Firefox/43.0'
}

type ipCategoryType = 'all' | 'user' | 'bot' | 'spam'
class ApacheData {
  logs: ApacheLineTypes[]
  ips: { [key: string]: string[] }    // keys are of type ipCategoryType

  constructor() {
    this.logs = []
    this.ips = { all: [], user: [], bot: [], spam: [] }
  }

  /**
   * Read all log files, and populates this.logs
   * @param {Array.<string>} logFilenames
   */
  readLogs(logFilenames: string[]) {
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

    let lines: string[] = []
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

  /** return all logs related to an IP, excluding some of them that are in the JSON configuration */
  getLogsforIp(ip: string, config: any): ApacheLineTypes[] {
    return this.logs.filter((log: ApacheLineTypes) => {
      if (log.remoteHost === ip) {
        // check for exclude
        return !Object.keys(log).some((key: string) => {
          const exclude: string[] = config[key]?.exclude ?? []
          return exclude.some((e:string) => log[key as keyof ApacheLineTypes].includes(e))
        })
      } else {
        return false
      }
    })
  }

  // return 1 for user, 2 for bot, and 3 for spam
  categoriesIp(ip:string, logs: ApacheLineTypes[], config: any): number {
    let result = 1
    if (logs.length === 0) {
      return 1    // this is a user, with the mail signature being addressed
    }

    if (logs.length <= 2) {
      // TODO: weak
      result = 2
    }

    // same user-agent? if not, this is a spam => stop immediately
    // note different user-agent may occur when the user is looking with google and then with firefox, which may be rare enough
    const ua = logs[0]['RequestHeader User-Agent']
    if (logs.some((l: ApacheLineTypes) => l['RequestHeader User-Agent'] !== ua)) {
      return 3    // a spam, so stop immediatly
    }

    if ((result === 1) && (config.request.routes && config.request.routes.length!==0)) {
      // if no user route is used, then this is at least a bot
      if (!logs.some((l: ApacheLineTypes) => config.request.routes.some((route: string) => l['request'].includes(route)))) {
        result = 2
      }
    }

    // check if it is a spam, using the config.xxx.spam
    if (logs.some(log => Object.keys(log).some((key: string) => {
          // console.log(key, log[key as keyof ApacheLineTypes])
          const spam: string[] = config[key]?.spam ?? []
          return spam.some((e:string) => log[key as keyof ApacheLineTypes].includes(e))
        }))) {
        return 3
    }

    // check if it is a bot
    if ((result === 1) && (logs.some(log => Object.keys(log).some((key: string) => {
          const bot: string[] = config[key]?.bot ?? []
          return bot.some((e:string) => log[key as keyof ApacheLineTypes].includes(e))
        })))) {
        result = 2
    }

    // special rules
    if (config.special) {
      if (config.special['get php files']) {
        // no /GET of php files, otherwise is a spam
        if (logs.some(log => {
          const req = log.request.split(' ')
          return ((req[0] === 'GET') && (req[1].endsWith('.php') || req[1].includes('.php?')))
        })) {
          return 3
        }
      }
    }

    return result
  }

  /**
   * Populate ips, that is ips['all'], ips['user'], ips['bot'], and ips['spam']
   */
  populateIps(options: OptionValues) {
    const config = options.config
    let setUnique = new Set(this.logs.map(function(a) {return a.remoteHost;}))
    this.ips['all'] = [ ...setUnique ].sort()

    // array of 1, 2 or 3, 1 for user, 2 for bot, and 3 for spam
    this.ips['all'].forEach((ip: string) => {
      const logs: ApacheLineTypes[] = this.getLogsforIp(ip, config)
      const result = this.categoriesIp(ip, logs, config)
      switch (result) {
        case 1: this.ips['user'].push(ip); break;
        case 2: this.ips['bot'].push(ip); break;
        case 3: this.ips['spam'].push(ip); break;
      }
    })

  }




  //   // spam when requesting a wrong page, or robots,...
  //   if (requests.some((r, index) => {
  //     // immediate post
  //     if (r.request.startsWith('POST ') && (index >= 1)) {
  //       const secsPrev = _getNbSecs(requests[index-1].time)
  //       const secs = _getNbSecs(r.time)

  //       if (secs - secsPrev < 10) {   // less than 10secs between the page arrives, and the post
  //         reason = 'immediate post contact form'
  //         return true
  //       }
  //     }

  //     return false
  //   })) {
  //     return apacheData.spamDetected(ip, reason, antispam)
  //   }


  // }

  // private methods
}

export default ApacheData


/*
Statistics (considering bots, phishing... as spams):
- IPS:
    #Real Users................: 64
    #Spams.....................: 917 (93%)
- Requests:
    #Requests from Real Users..: 1451
    #Requests from Spams.......: 6918 (83%)
- Sizes:
    #Sizes from Real Users.....: 43.73MB
    #Sizes from Spams..........: 107.03MB (71%)
- Requests:
    #Contact from Real Users...: 0
    #Contact from Spams........: 24 (100%)
*/
