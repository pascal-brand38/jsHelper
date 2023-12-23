// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'

async function populateDbIp(apacheData, dbIp) {
  if (dbIp === undefined) {
    return undefined
  }
  let uniqueIps = new Set(apacheData.map(function(a) {return a.remoteHost;}));
  if (uniqueIps.size === 0) {
    return
  }
  if (uniqueIps.size === 1) {
    uniqueIps.push('0.0.0.0')   // to have a list of results
  }
  const url = 'https://api.stopforumspam.org/api?json&ip=' + [...uniqueIps].join('&ip=')
  let results
  try {
    const response = await fetch(url);
    results = await response.json();
    console.log(results)
  } catch {
    return undefined
  }

  //
  results.ip.forEach(element => {
    let dbIpItem = dbIp[element.value]
    if (dbIpItem === undefined) {
      // create the entry for this ip
      dbIp[element.value] = {
        epoch: 0,
      }
      console.log(`${element.value} NOT FOUND`)
    } else {
      console.log(`${element.value} FOUND`)
    }
  });

  return dbIp
}
// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

export default {
  populateDbIp
}
