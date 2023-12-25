// Copyright (c) Pascal Brand
// MIT License

import fetch from 'node-fetch'

// data is the apache data from logs - see apache-data.mjs
// db is the ip database - see db-ip.mjs

// return stopforumspam data related to ips in data
async function get(uniqueIps) {
  if (uniqueIps.size === 0) {
    return {}
  }

  let result = {}
  const chunkSize = 15;   // stopforumspam sends 15 ip information at a time

  // https://stackoverflow.com/questions/37576685/using-async-await-with-a-foreach-loop
  let urls = []
  for (let i = 0; i < uniqueIps.length; i += chunkSize) {
    let chunk = uniqueIps.slice(i, i + chunkSize);
    if (chunk.size === 1) {
      chunk.push('0.0.0.0')   // add an extra one to ensure the result is a list
    }
    urls.push('https://api.stopforumspam.org/api?json&ip=' + chunk.join('&ip='))
  }

  try {
    await Promise.all(urls.map(async (url) => {
      await fetch(url)
        .then(response =>response.json())
        .then(rawDatas => {
          if (rawDatas.success === 1) {
            rawDatas.ip.forEach(element => {
              if (result[element.value].appears === 1) {  // only the ones that show a spam
                result[element.value] = element
              }
            })
          }
        })
    }))
  } catch {
  }

  return result
}

// jsonObject is the returned info from stopforumspam.org, typically
// {
//   value: '104.168.153.70',
//   appears: 1,
//   frequency: 17,
//   lastseen: '2023-12-17 10:39:57',
//   delegated: 'us',
//   asn: 54290,
//   country: 'us',
//   confidence: 79.07
// }

// TODO: return a status about unknown, crawler, spam...
function ipStatus(jsonObject) {
  if (jsonObject === undefined) {
    return true
  }
  if ((jsonObject.appears > 0) && (jsonObject.confidence > 0)) {
    // TODO: use a confidence threshold
    // TODO: use lastseen
    return false
  } else {
    return true
  }
}

// https://api.stopforumspam.org/api?json&ip=0.0.0.0&ip=85.68.121.4

export default {
  get,
  ipStatus,
}
