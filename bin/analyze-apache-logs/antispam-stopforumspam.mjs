// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'

// data is the apache data from logs - see apache-data.mjs
// db is the ip database - see db-ip.mjs

// return stopforumspam data related to ips in data
async function _read(data) {
  let uniqueIps = new Set(data.map(function(a) {return a.remoteHost;}));
  if (uniqueIps.size === 0) {
    return undefined
  }
  if (uniqueIps.size === 1) {
    uniqueIps.push('0.0.0.0')   // to have a list of results
  }

  const url = 'https://api.stopforumspam.org/api?json&ip=' + [...uniqueIps].join('&ip=')
  try {
    const response = await fetch(url);
    return await response.json();
  } catch {
    return undefined
  }
}

// return updated db with data from stopforumspam.org
async function populateDbIp(data, db) {
  if (db === undefined) {
    return db
  }
  const spamdata = await _read(data)
  if (spamdata === undefined) {
    return db
  }

  spamdata.ip.forEach(element => {
    let dbIpItem = db[element.value]
    if (dbIpItem === undefined) {
      // create the entry for this ip
      db[element.value] = {
        epoch: 0,
      }
      console.log(`${element.value} NOT FOUND`)
    } else {
      console.log(`${element.value} FOUND`)
    }
  });

  return db
}
// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

export default {
  populateDbIp
}
