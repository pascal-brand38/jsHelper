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
  constructor() { this.db = undefined }
  async read(dbIpFilename) { this.db = _read(dbIpFilename) }
  populate(antispamDatas, whichAntispam) {
    const ips = Object.keys(antispamDatas)
    ips.forEach(ip => {
      if (this.db[ip] === undefined) {
        this.db[ip] = {}
      }
      this.db[ip][whichAntispam] = antispamDatas[ip]
    })
  }
}

export default DbIp
