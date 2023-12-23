// Copyright (c) Pascal Brand
// MIT License

import { readFileSync } from 'fs'

async function read(options) {
  if (options.dbIp === '') {
    return undefined
  }
  return JSON.parse(readFileSync(options.dbIp, 'utf8'))
}

export default {
  read,
}
