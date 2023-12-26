// Copyright (c) Pascal Brand
// MIT License

import fs from 'fs'

async function _read(dbIpFilename) {
  try {
    if (dbIpFilename === '') {
      return {}
    }
    return JSON.parse(fs.readFileSync(dbIpFilename, 'utf8'))
  } catch {
    console.log(`CANNOT READ ${dbIpFilename}`)
    return {}
  }
}

class DbIp {
  constructor() { this.db = undefined; this.providers = [] }

  // async read(dbIpFilename) { this.db = await _read(dbIpFilename); }
  async read(dbIpFilename) { _read(dbIpFilename).then(result => this.db = result) }
  async save(dbIpFilename) { fs.writeFileSync(dbIpFilename, JSON.stringify(this.db, null, 2)), 'utf8' }

  populate(antispamDatas, spamProvider, ipStatus) {
    this.providers.push({ provider: spamProvider, ipStatus: ipStatus, })
    const ips = Object.keys(antispamDatas)
    ips.forEach(ip => {
      if (this.db[ip] === undefined) {
        this.db[ip] = {}
      }
      if (this.db[ip][spamProvider] === undefined) {
        this.db[ip][spamProvider] = {}
      }
      Object.assign(this.db[ip][spamProvider], antispamDatas[ip]);
    })
  }

  status(apacheData) {
    let nTrue = 0
    let nFalse = 0
    apacheData.uniqueIps.forEach(ip => {
      let thisOne = true  // default is: ip is correct
      this.providers.forEach(provider => {
        // console.log(`${ip} ${this.db[ip]}`)
        if (thisOne && this.db[ip]) {
          // console.log(`${ip} ${provider.ipStatus(this.db[ip][provider.provider])}`)
          thisOne = provider.ipStatus(this.db[ip][provider.provider])
        }
      })
      if (thisOne) {
        // ip is correct... but?
        nTrue++
        console.log(`Correct IP?  ${ip}`)
      } else {
        nFalse++
      }
    })
    console.log(`Correct Ips: ${nTrue}`)
    console.log(`Spams: ${nFalse}`)
  }
}

export default DbIp
