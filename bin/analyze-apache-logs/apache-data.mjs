// Copyright (c) Pascal Brand
// MIT License

import Alpine from 'alpine'
import { createReadStream } from 'fs'
import { createInterface } from 'readline'

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


class ApacheData {
  constructor() {
    this.logs = undefined
    this.uniqueIps = undefined
  }

  async read(logFilename) {
    this.logs = await _read(logFilename)
    this._setUniqueIps()
  }

  // private methods
  _setUniqueIps() {
    let setUnique = new Set(this.logs.map(function(a) {return a.remoteHost;}))
    this.uniqueIps = [ ...setUnique ].sort()
  }
}

export default ApacheData
