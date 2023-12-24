// Copyright (c) Pascal Brand
// MIT License

import { readFileSync } from 'fs'

async function _read(dbIpFilename) {
  if (dbIpFilename === '') {
    return {}
  }
  return JSON.parse(readFileSync(dbIpFilename, 'utf8'))
}

class DbIp {
  constructor() { this.db = undefined; this.providers = [] }

  async read(dbIpFilename) { this.db = _read(dbIpFilename) }

  populate(antispamDatas, spamProvider, ipStatus) {
    this.providers.push({ provider: spamProvider, ipStatus: ipStatus, })
    const ips = Object.keys(antispamDatas)
    ips.forEach(ip => {
      if (this.db[ip] === undefined) {
        this.db[ip] = {}
      }
      this.db[ip][spamProvider] = antispamDatas[ip]
    })
  }

  status(uniqueIps) {
    uniqueIps.forEach(ip => {
      this.providers.forEach(provider => {
        // console.log(`${ip} ${this.db[ip]}`)
        console.log(`${ip} ${provider.ipStatus(this.db[ip][provider.provider])}`)
      })
    })
  }
}

export default DbIp
